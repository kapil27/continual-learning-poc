# Agentic Continual Learning: Technical Research

## Status: Phase 1 Complete (Infrastructure Validated on T4 Cluster, Awaiting IDM A100 Access)

**Last Updated**: 2026-06-05
**JIRA**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327)
**Perspective**: Principal Engineer technical validation of the POC
**Source documents**:
- [Strategy & Reference Architecture](https://docs.google.com/document/d/12KEjkoxoObtZbC1uG5TcIN-Se_3KtqelUWiVu6UZaTM/edit)
- [Sprint 1 Implementation Plan](https://docs.google.com/document/d/1-dSeayRiTIdB2SxQKzuSP25NDYOMa6bXghDcgrlg914/edit)
- [Epic Details: Claude vs Open-Weight](https://docs.google.com/document/d/1KuCsdsG3buxEK7oh70Pfl1n-HTfHkRJcnle7ucLhSrs/edit)
- [Agent Eval Harness OpenCode Runner PR #90](https://github.com/opendatahub-io/agent-eval-harness/pull/90)

---

## Executive Summary

The Agentic Continual Learning architecture proposes a unified system that improves AI agents autonomously from their own production experience. It combines two nested optimization loops:

- **Outer Loop** (token-space): Optimizes agent skill instructions via the agent-eval-harness. Fast iteration (minutes). Output: improved `SKILL.md`.
- **Inner Loop** (weight-space): Fine-tunes model weights from production traces via SFT/DPO/GRPO on Training Hub. Slow iteration (hours/days). Output: improved model checkpoints.

Both loops share MLflow as their data plane and are eval-gated at every stage transition.

**Principal engineer verdict**: The architecture is **sound and well-designed**. The two-loop structure is the right abstraction. The highest-risk gaps are integration-level (judge-to-training bridge, trace-to-dataset pipeline), not architectural. Recommend proceeding with focused de-risking.

---

## Document Index

| Document | Contents |
|----------|----------|
| [01-architecture-overview.md](01-architecture-overview.md) | Full two-loop architecture, component map, progressive compression pipeline, comparison to OpenAI's proprietary pipeline |
| [02-outer-loop-analysis.md](02-outer-loop-analysis.md) | Agent-eval-harness deep dive: runners (Claude Code, CLI, Responses API), judge system, scoring mechanics, eval-optimize workflow, CLI runner for OpenCode |
| [03-inner-loop-analysis.md](03-inner-loop-analysis.md) | Training pipeline: SFT vs DPO vs GRPO comparison, Kubeflow Trainer v2, progressive compression (NVIDIA SLM research, SAD, Agent-as-Annotators), judge-to-DPO bridge design |
| [04-bridge-mlflow.md](04-bridge-mlflow.md) | MLflow as shared data plane: trace schema, export capabilities, annotation workflows, DPO preference generation, gaps (trace-to-training pipeline missing) |
| [05-sprint1-assessment.md](05-sprint1-assessment.md) | Sprint 1 deliverable assessment: baseline benchmark (70% ready), FT benchmark (40% ready), cron agent (50% ready), open questions, blockers |
| [06-risks-and-gaps.md](06-risks-and-gaps.md) | 7 risks rated by severity: loop interference (HIGH), eval noise (MED), tool-use fidelity (HIGH), cross-provider legality (HIGH), credit assignment (MED), safety gaps (MED), data availability (MED) |
| [07-recommendations.md](07-recommendations.md) | Sprint 2 priority stack (P0-P5), technical decisions to make, 4-week timeline, what to defer to Sprint 3+ |
| [08-implementation-progress.md](08-implementation-progress.md) | **NEW** -- Phase 1 cluster setup: infrastructure deployed, 9 issues found/solved, validated configs for IDM |

---

## Top 3 Findings

### 1. The judge-to-training-data bridge is the highest-value missing piece
The eval-harness produces rich reward signals (pairwise preferences, numeric scores, bool pass/fail, full trajectories). Training Hub needs these as training data (SFT pairs, DPO preferences, GRPO rewards). No pipeline connects the two today. Building this bridge is the single most impactful Sprint 2 deliverable.

### 2. PR #90 adds a dedicated OpenCode runner (supersedes CLI runner approach)
Antonin's PR #90 adds a native `OpenCodeRunner` with OTel-based trace capture, eliminating our earlier concern about empty `events.json`. The runner has been validated end-to-end on the RFE Creator with 20 cases. Key discovery during setup: OpenCode 1.16.0 requires piped stdin (`echo "msg" | opencode run`) and the `@ai-sdk/openai-compatible` npm adapter for custom endpoints.

### 3. Loop interference is a real but manageable risk
If the outer loop optimizes a skill for Model A and the inner loop then changes the model, the skill optimization may be invalidated. Sequential scheduling (inner loop first, then outer loop re-optimization) is the simplest mitigation. This should be the default for Sprint 2.

---

## Quick Reference: What Exists vs What Needs Building

| Component | Exists? | Location |
|-----------|---------|----------|
| Outer loop (eval-harness) | Yes | `agent-eval-harness/` |
| **OpenCode runner (PR #90)** | **Yes (validated)** | `agent_eval/agent/opencode.py` |
| CLI runner (generic fallback) | Yes | `agent_eval/agent/cli_runner.py` |
| Judge system (builtin + custom) | Yes | `agent_eval/judges/`, `score.py` |
| Pairwise comparison | Yes | `score.py compare_runs()` |
| EvalHub adapter | Yes (hardcodes Claude) | `agent_eval/evalhub/adapter.py` |
| MLflow trace capture | Yes | MLflow auto-tracing |
| MLflow trace export | Yes | `mlflow.search_traces()` + `to_json()` |
| Judge-to-DPO bridge | **No** | Needs building |
| Trace-to-training pipeline | **No** | Needs building |
| Cron-based agent deployment | **No** | Needs Helm chart |
| Tool-use fidelity judges | **Partial** | `tool_call_validation.py` exists, needs extension |
| Safety eval pipeline | **Partial** | `no_harmful_content.md` exists, needs Garak |
