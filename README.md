# Continual Learning POC

**JIRA**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327) | **Status**: Phase 2 In Progress (First Eval Runs Complete)

Evaluate how close a self-hosted open-weight model can get to Claude Code (Opus) on agentic tasks, using the [Agent Eval Harness](https://github.com/opendatahub-io/agent-eval-harness) for automated skill evaluation and optimization.

## Objective

Answer three questions:
1. How much worse does an agent get when we use an open-weight model instead of Claude Opus?
2. How much can we fix the gap by optimizing the skill prompt alone (no fine-tuning)?
3. How much does full fine-tuning close the remaining gap?

Target skill: [RFE Creator](https://github.com/jwforres/rfe-creator)

## Repository Structure

```
├── 00-INDEX.md                          # Research index and top findings
├── 01-architecture-overview.md          # Two-loop continual learning architecture
├── 02-outer-loop-analysis.md            # Eval-harness: runners, judges, eval-gating
├── 03-inner-loop-analysis.md            # Training: SFT/DPO/GRPO, progressive compression
├── 04-bridge-mlflow.md                  # MLflow as shared data plane
├── 05-sprint1-assessment.md             # Sprint 1 goal-by-goal review
├── 06-risks-and-gaps.md                 # 7 risks, gap summary
├── 07-recommendations.md               # Sprint 2 priorities and decisions
├── 08-implementation-progress.md        # Phase 1 cluster setup results
│
├── poc/                                 # POC execution artifacts
│   ├── RUNBOOK.md                       # Reproducible setup guide (every step documented)
│   ├── configs/                         # Kubernetes manifests (MLflow, vLLM, model download)
│   ├── reports/                         # Progress report, eval results, comparison
│   └── evidence/                        # OpenCode findings, generated RFE artifacts
│
└── knowledge-base/                      # Interactive HTML learning site
    ├── index.html                       # Landing page (7 chapters)
    ├── ai-server.js                     # Local AI assistant proxy
    └── pages/                           # 7 interactive pages (Tailwind, Mermaid, quizzes)
```

## What's Been Done

### Phase 1: Infrastructure (2026-06-05)
- **Architecture research**: 8 detailed technical documents analyzing the two-loop continual learning design
- **T4 cluster dry-run**: Validated full deployment pipeline, discovered and solved 9 infrastructure issues
- **IBM cluster setup**: Deployed MLflow + connected to existing Qwen 27B (2x A100, 262K context, tool calling)
- **Tooling**: OpenCode 1.16.0 + Agent Eval Harness [PR #90](https://github.com/opendatahub-io/agent-eval-harness/pull/90) — all 4 runners verified
- **Reproducible runbook**: Every step documented in [poc/RUNBOOK.md](poc/RUNBOOK.md)

### Phase 2: Evaluation Runs (2026-06-08)
- **Qwen 27B vs Claude Opus comparison**: 3 RFE Creator cases, both models evaluated
- **Pipeline fix**: Identified and fixed root cause of "0/3 completed" (wrong execution args + missing skill context)
- **First RFE artifact generated**: Qwen 27B produced a [production-quality RFE document](poc/evidence/rfe-artifacts/RFE-001-qwen27b.md) through the full `rfe.speedrun` pipeline
- **Interactive knowledge base**: 7-page site with diagrams, quizzes, AI assistant

## What's Next (Phase 3)

1. Complete full pipeline run for all 3 cases (case 1 in progress)
2. Run Claude Opus with fixed args for fair comparison
3. Run `/eval-optimize` to adapt skill prompts for Qwen 27B
4. Scale to 20 cases for statistical significance
5. Generate final comparison report for RHOAIENG-62327

## Quick Start: Knowledge Base

```bash
cd knowledge-base
npm install
node ai-server.js
# Open http://localhost:3847 in your browser
```

## Quick Start: Cluster Setup

See [poc/RUNBOOK.md](poc/RUNBOOK.md) for the full step-by-step guide.

```bash
oc new-project eval-poc
oc apply -f poc/configs/mlflow-postgres.yaml
oc apply -f poc/configs/mlflow-instance.yaml
oc apply -f poc/configs/model-download-job.yaml
oc apply -f poc/configs/vllm-deployment.yaml
```

## Key References

| Resource | Link |
|----------|------|
| JIRA Epic | [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327) |
| Agent Eval Harness | [opendatahub-io/agent-eval-harness](https://github.com/opendatahub-io/agent-eval-harness) |
| OpenCode Runner PR | [PR #90](https://github.com/opendatahub-io/agent-eval-harness/pull/90) |
| RFE Creator | [jwforres/rfe-creator](https://github.com/jwforres/rfe-creator) |
| Strategy Doc | [Agentic Continual Learning](https://docs.google.com/document/d/12KEjkoxoObtZbC1uG5TcIN-Se_3KtqelUWiVu6UZaTM/edit) |
| Epic Details | [Claude vs Open-Weight](https://docs.google.com/document/d/1KuCsdsG3buxEK7oh70Pfl1n-HTfHkRJcnle7ucLhSrs/edit) |
