# POC: Evaluate Claude Code vs Open-Weight Model
# RHOAIENG-62327

## Directory Structure

```
continual-learning-architecture-implementation/
├── 00-INDEX.md                        # Architecture research index
├── 01-architecture-overview.md        # Two-loop architecture deep-dive
├── 02-outer-loop-analysis.md          # Eval-harness / outer loop analysis
├── 03-inner-loop-analysis.md          # Training pipeline / inner loop analysis
├── 04-bridge-mlflow.md                # MLflow as shared data plane
├── 05-sprint1-assessment.md           # Sprint 1 plan review
├── 06-risks-and-gaps.md               # Risk register
├── 07-recommendations.md             # Sprint 2+ recommendations
├── knowledge-base/                    # Interactive HTML learning site
│
└── poc/                               # POC execution artifacts
    ├── README.md                      # This file -- project structure and conventions
    ├── reports/                        # Evaluation reports and analysis
    │   ├── 00-cluster-sanity.md       # Cluster readiness assessment
    │   ├── 01-baseline-claude.md      # Claude Opus baseline results (Story 2)
    │   ├── 02-baseline-openweight.md  # Open-weight model initial results (Story 4)
    │   ├── 03-optimized-openweight.md # Post-optimization results (Story 5)
    │   └── 04-final-comparison.md     # Pairwise analysis and recommendations
    ├── configs/                        # eval.yaml variants and deployment configs
    │   ├── eval-claude.yaml           # Eval config for Claude Code runner
    │   ├── eval-opencode.yaml         # Eval config for OpenCode runner
    │   └── vllm-deployment.yaml       # vLLM serving deployment manifest
    ├── scripts/                        # Automation scripts
    │   ├── deploy-vllm.sh             # Deploy vLLM on cluster
    │   ├── run-baseline.sh            # Run baseline eval
    │   └── run-comparison.sh          # Run pairwise comparison
    ├── logs/                           # Raw eval-harness run logs
    └── evidence/                       # Screenshots, terminal captures, cluster state
```

## Conventions

1. **Reports**: Numbered sequentially. Each report includes: date, cluster state, model version, eval config hash, and raw scores.
2. **Configs**: All eval.yaml variants checked in. Never modify the upstream eval.yaml -- create project-specific variants.
3. **Evidence**: Timestamped captures of cluster state, GPU utilization, pod logs for reproducibility.
4. **Logs**: Raw eval-harness output. Named by run-id.

## Key References

- **JIRA Epic**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327)
- **Agent Eval Harness**: https://github.com/opendatahub-io/agent-eval-harness
- **OpenCode Runner PR**: [PR #90](https://github.com/opendatahub-io/agent-eval-harness/pull/90) (branch: `feat/otel-traces-opencode-runner`)
- **RFE Creator**: https://github.com/jwforres/rfe-creator
- **Epic Details Doc**: https://docs.google.com/document/d/1KuCsdsG3buxEK7oh70Pfl1n-HTfHkRJcnle7ucLhSrs/edit
- **Strategy Doc**: https://docs.google.com/document/d/12KEjkoxoObtZbC1uG5TcIN-Se_3KtqelUWiVu6UZaTM/edit
