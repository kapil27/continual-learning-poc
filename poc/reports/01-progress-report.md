# RHOAIENG-62327: POC Progress Report
## Evaluate Claude Code vs Open-Weight Model Performance

**Date**: 2026-06-05
**Author**: Neeraj Kumar (knema)
**Epic**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327)
**Reporter**: Rob Bell (robell@redhat.com)

---

## Executive Summary

We have completed Phase 1 (infrastructure setup and validation) of the POC to evaluate open-weight model performance against Claude Code (Opus) on agentic tasks. Using a T4 GPU cluster as a dry-run environment, we validated the entire deployment pipeline, identified and solved 9 infrastructure issues, and produced a reproducible runbook for the real IDM (A100) cluster.

**Bottom line**: The infrastructure is ready. The only blocker for running actual evaluations is access to the IDM cluster with A100 GPUs, where the target model (Qwen2.5-Coder-32B) has sufficient context window for OpenCode's agentic framework.

---

## What We Did

### 1. Architecture Research

Conducted a principal-engineer-level review of the Agentic Continual Learning architecture by reading and analyzing:
- The Strategy & Reference Architecture doc (two-loop design: outer loop for skill optimization, inner loop for model weight optimization)
- The Sprint 1 Implementation Plan (3 goals: baseline benchmark, fine-tuned benchmark, cron-based skill optimizer)
- The Claude vs OpenCode comparison epic doc (5 user stories, infrastructure specs, success metrics)
- Antonin's PR #90 on agent-eval-harness (OpenCode runner + OTel traces)

Produced 7 detailed research documents covering architecture, outer/inner loop analysis, MLflow bridge, Sprint 1 assessment, risks, and recommendations.

### 2. Cluster Infrastructure Setup

Set up a complete evaluation environment on the `kap-test-pool` OpenShift cluster (AWS, OCP 4.21.15, RHOAI 3.5.0-ea.2):

| Component | Status | Endpoint |
|-----------|--------|----------|
| Namespace `eval-poc` | Created | - |
| PostgreSQL (MLflow backend) | Running | `mlflow-postgres.eval-poc.svc:5432` |
| MLflow 3.12.0 | Running, Available | `mlflow.redhat-ods-applications.svc:8443/mlflow` |
| vLLM 0.8.4 + Qwen2.5-Coder-3B | Running, Serving | `vllm-qwen-7b.eval-poc.svc:8000` |
| Model download pipeline | Validated | `huggingface_hub` Job to PVC |

### 3. Tooling Setup

| Tool | Version | Status |
|------|---------|--------|
| OpenCode CLI | 1.16.0 | Installed, configured for vLLM provider |
| Agent Eval Harness (PR #90) | 1.4.0 | Installed on `feat/otel-opencode-runner` branch |
| Available runners | claude-code, cli, **opencode**, responses-api | All registered |
| RFE Creator skill | main branch | Cloned locally |

### 4. End-to-End Validation

Verified that OpenCode connects to the self-hosted vLLM endpoint, authenticates, and makes API calls. The title-generation pipeline (small context) succeeds. The full agentic pipeline (large context with tool definitions) is blocked by a context window constraint specific to the T4 dry-run model (see Findings below).

---

## Key Findings

### Infrastructure Issues Discovered and Solved

| # | Issue | Root Cause | Solution | Time Saved on IDM |
|---|-------|-----------|----------|-------------------|
| 1 | MLflow migration fails with OSError | SQLite on PVC + OpenShift SCC = write permission denied | Use PostgreSQL backend instead of SQLite | ~2 hours |
| 2 | MLflow SSL connection error | psycopg2 demands SSL; Red Hat PostgreSQL has no TLS | Add `?sslmode=disable` to connection string | ~1 hour |
| 3 | Model download stalls at 4.6GB | HuggingFace xet/xorbs CDN drops connections | Use `huggingface_hub` Python library in a download Job | ~3 hours |
| 4 | RHOAI vLLM image returns 404 | EA build image digest is stale in `kserve-parameters` ConfigMap | Use public `vllm/vllm-openai:v0.8.4` | ~1 hour |
| 5 | Qwen 7B OOMs on T4 | 14.25 GiB model on 14.56 GiB GPU = zero KV cache headroom | Use 3B on T4; 7B+ requires A100 | ~2 hours |
| 6 | `opencode run` hangs indefinitely | No TTY detection on macOS — blocks waiting for stdin | Pipe input: `echo "msg" \| opencode run --format json` | ~2 hours |
| 7 | OpenCode URL parsing error | Wrong provider config format (`api: "openai"`) | Use `npm: "@ai-sdk/openai-compatible"` with `options.baseURL` | ~1 hour |
| 8 | Tool calling returns 400 | vLLM default config has no tool call parser | Add `--enable-auto-tool-choice --tool-call-parser hermes` | ~1 hour |
| 9 | Context overflow (39K > 32K) | OpenCode sends 32K `max_tokens` + 8K system prompt; 3B model max is 32K | NOT a blocker on A100: Qwen 32B supports 128K context | Informational |

### T4 vs A100 Cluster Comparison

| | T4 Cluster (dry-run) | IDM Cluster (target) |
|---|---------------------|---------------------|
| GPUs | 8x Tesla T4 (15GB each) | 16x A100 (80GB each) |
| Total VRAM | 120 GB | 1,280 GB |
| Max model (FP16) | ~6B params | ~40B params (1 GPU) |
| Recommended model | Qwen2.5-Coder-3B | Qwen2.5-Coder-32B |
| Model context window | 32K tokens | 128K tokens |
| OpenCode compatible? | No (needs 40K) | Yes (128K >> 40K) |

### Validated OpenCode Configuration for vLLM

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "vllm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "vLLM (cluster)",
      "options": {
        "baseURL": "http://<vllm-endpoint>:8000/v1"
      },
      "models": {
        "qwen-coder-32b": {
          "name": "Qwen 2.5 Coder 32B"
        }
      }
    }
  },
  "model": "vllm/qwen-coder-32b"
}
```

---

## Deliverables Produced

### Research Documents (`research-docs/continual-learning-architecture-implementation/`)

| Document | Content |
|----------|---------|
| `00-INDEX.md` | Executive summary, top findings, what exists vs what needs building |
| `01-architecture-overview.md` | Two-loop architecture with Mermaid diagrams, component map |
| `02-outer-loop-analysis.md` | Eval-harness deep dive: runners, judges, eval-gating |
| `03-inner-loop-analysis.md` | Training pipeline: SFT/DPO/GRPO comparison, progressive compression |
| `04-bridge-mlflow.md` | MLflow as shared data plane, trace-to-training-data gap analysis |
| `05-sprint1-assessment.md` | Sprint 1 goal-by-goal assessment with blockers |
| `06-risks-and-gaps.md` | 7 risks rated HIGH/MEDIUM, gap summary table |
| `07-recommendations.md` | Sprint 2 priorities P0-P4 with effort estimates |

### POC Artifacts (`poc/`)

| Artifact | Purpose |
|----------|---------|
| `RUNBOOK.md` | Step-by-step reproducible setup guide (every command documented) |
| `configs/mlflow-postgres.yaml` | PostgreSQL deployment for MLflow backend |
| `configs/mlflow-instance.yaml` | MLflow CR with PostgreSQL secret reference |
| `configs/model-download-job.yaml` | HuggingFace download Job to PVC |
| `configs/vllm-deployment.yaml` | vLLM Deployment + Service with tool calling |
| `evidence/opencode-1.16-run-hang.md` | TTY hang bug documentation |
| `evidence/opencode-vllm-context-constraint.md` | 40K context requirement analysis |
| `reports/00-cluster-sanity.md` | Cluster hardware assessment |

### Interactive Knowledge Base (`knowledge-base/`)

6-page interactive HTML site (Tailwind CSS, Mermaid diagrams, quizzes, AI chat) for onboarding anyone to the architecture. Available at `http://localhost:3847/` when the AI server is running.

---

## Next Steps

### Immediate (requires IDM cluster access)

1. **Replay runbook on IDM cluster** — all configs are ready, all gotchas documented
2. **Deploy Qwen2.5-Coder-32B** — fits on 1x A100 80GB with full 128K context
3. **Run Claude Code baseline** (Story 2) — eval-harness with `claude-code` runner
4. **Run open-weight initial eval** (Story 4) — eval-harness with `opencode` runner pointing at vLLM
5. **Run `/eval-optimize`** (Story 5) — iterative skill refinement for the open-weight model

### Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Target model on IDM | Qwen2.5-Coder-32B vs Llama 3.1 70B vs DeepSeek-Coder-V2 | Qwen2.5-Coder-32B (best code perf/size ratio, 1 GPU) |
| Eval skill | RFE Creator (needs JIRA) vs simpler skill | RFE Creator (matches epic), use `--dry-run` to avoid JIRA writes |
| Fine-tuning approach (Sprint 1 Goal 2) | SFT vs DPO vs GRPO | Start with SFT on production traces |

### Note on Antonin's PR #90

The eval-harness OpenCode runner (PR #90) is installed and functional. Two things to validate once we have a working OpenCode + large model:
1. The runner's `echo "prompt" | opencode run` piped-stdin behavior (our workaround matches what the runner does internally)
2. OTel trace capture (currently blocked by an upstream OpenCode bug — anomalyco/opencode#30087)

Per Rob's guidance, we should reach out to Rob first if we hit issues, to use Antonin's time efficiently.

---

## Time Investment

| Activity | Time |
|----------|------|
| Architecture research (reading docs, codebase analysis, writing reports) | ~3 hours |
| Cluster setup (MLflow, PostgreSQL, vLLM, model download) | ~2 hours |
| OpenCode debugging (hang, provider config, context window) | ~1.5 hours |
| Documentation and runbook | ~1 hour |
| **Total** | **~7.5 hours** |

Estimated time saved on IDM deployment by having the runbook: **~12 hours** (based on the 9 issues that would have required independent debugging).
