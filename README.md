# Continual Learning POC

**JIRA**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327) | **Status**: Phase 1 Complete (Infrastructure Validated)

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
│   ├── reports/                         # Cluster sanity report, progress report
│   └── evidence/                        # OpenCode findings, context window analysis
│
└── knowledge-base/                      # Interactive HTML learning site
    ├── index.html                       # Landing page (7 chapters)
    ├── ai-server.js                     # Local AI assistant proxy
    └── pages/                           # 7 interactive pages (Tailwind, Mermaid, quizzes)
```

## What's Been Done (Phase 1)

- **Architecture research**: 8 detailed technical documents analyzing the two-loop continual learning design, component integration, risks, and recommendations
- **Cluster setup on T4 (dry-run)**: Deployed MLflow 3.12.0, PostgreSQL, vLLM 0.8.4 serving Qwen2.5-Coder-3B on OpenShift AI (RHOAI 3.5)
- **Tooling**: Installed OpenCode 1.16.0 + Agent Eval Harness with [OpenCode runner PR #90](https://github.com/opendatahub-io/agent-eval-harness/pull/90)
- **9 infrastructure issues** found and solved, all documented in the [runbook](poc/RUNBOOK.md)
- **Interactive knowledge base**: 7-page site with diagrams, quizzes, and AI assistant

## What's Next (Phase 2 — requires IDM cluster)

1. Replay runbook on IDM cluster (16x A100 80GB)
2. Deploy Qwen2.5-Coder-32B-Instruct (128K context)
3. Run Claude Opus baseline via eval-harness
4. Run open-weight evaluation, then `/eval-optimize` to close the gap
5. Generate comparison report with pairwise analysis

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
