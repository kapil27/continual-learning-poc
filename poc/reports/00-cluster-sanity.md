# Cluster Sanity Report

**Date**: 2026-06-05
**Cluster**: `kap-test-pool-tfxhm` (AWS us-east-2)
**API**: `https://api.kap-test-pool-tfxhm.aws.rh-ods.com:6443`
**User**: `htpasswd-cluster-admin-user`
**OCP Version**: 4.21.15 (Kubernetes v1.34.6)

---

## GPU Infrastructure

| Property | Expected (Epic Doc) | Actual | Status |
|----------|-------------------|--------|--------|
| Cluster | IDM Cluster | kap-test-pool (AWS) | DIFFERENT |
| GPU Nodes | 2 | 2 | OK |
| GPUs per Node | 8x A100 80GB | 4x Tesla T4 15GB | MISMATCH |
| Total GPUs | 16 | 8 | MISMATCH |
| Total VRAM | 1.28 TB | 120 GB | MISMATCH (10.7x less) |
| GPU Family | Ampere (compute 8.0) | Turing (compute 7.5) | DIFFERENT |
| Instance Type | Unknown | g4dn.12xlarge | AWS |
| Interconnect | NVLink + InfiniBand | No NVLink, no IB | DIFFERENT |

### Impact on Model Selection

The epic doc recommended Qwen2.5-Coder-32B-Instruct (needs ~64GB FP16). With T4 GPUs at 15GB each, the model choices change significantly:

| Model | FP16 VRAM | INT8 VRAM | Fits on This Cluster? | Notes |
|-------|-----------|-----------|----------------------|-------|
| Qwen2.5-Coder-7B-Instruct | ~14GB | ~7GB | YES (1 GPU) | Best fit for T4 |
| Qwen2.5-Coder-14B-Instruct | ~28GB | ~14GB | YES (2 GPUs) | Good middle ground |
| Qwen2.5-Coder-32B-Instruct | ~64GB | ~32GB | MAYBE (4-8 GPUs, INT4/GPTQ) | Tight, may OOM |
| Llama 3.1 70B | ~140GB | ~70GB | NO | Exceeds cluster VRAM |
| DeepSeek-Coder-V2 236B MoE | ~120GB active | ~60GB | NO | Exceeds cluster VRAM |

**Recommendation**: Start with **Qwen2.5-Coder-14B-Instruct** (2 GPUs, FP16) as the primary candidate. Fall back to 7B if 14B is too slow. The 32B model could work with INT4 quantization across 4 GPUs but adds complexity. Confirm with Rob whether the IDM cluster is a separate environment we should target instead.

## RHOAI Platform Status

| Component | State | Version | Notes |
|-----------|-------|---------|-------|
| OpenShift AI Operator | Succeeded | 3.5.0-ea.2 | Early access build |
| KServe | Managed | - | Ready for model serving |
| Trainer (v2) | Managed | - | New Kubeflow Trainer |
| MLflow Operator | Managed | - | Operator running, no MLflow instance/route found |
| Model Registry | Managed | - | Running in rhoai-model-registries |
| Ray | Managed | - | Available |
| TrustYAI | Managed | - | MCP guardrails mode: false |
| NVIDIA GPU Operator | Succeeded | 26.3.2 | CUDA driver 580.126.20, runtime 13.0 |
| Kueue | Removed | - | Not managed in this cluster |
| Training Operator (legacy) | Removed | - | Replaced by Trainer v2 |

### MLflow Status

- MLflow Operator controller-manager pod is **running** in `redhat-ods-applications`
- **No MLflow server instance found** -- no route, no pods beyond the operator
- Need to create an MLflow CR to deploy an actual server instance

### Existing Workloads

| Namespace | What's Running | Status |
|-----------|---------------|--------|
| `grpo-trainer` | vLLM rollout deployment | **CrashLoopBackOff** (FIPS selftest failure) |
| `grpo-trainer` | grpo-test-notebook | Running |
| `grpo-trainer` | vllm-async-init builds | 1 failed, 1 completed |
| `redhat-ods-applications` | Model registry, serving API, model controller | Running |
| `rhoai-model-registries` | Model catalog + postgres | Running |

The existing vLLM deployment in `grpo-trainer` is broken with a FIPS error (`FATAL FIPS SELFTEST FAILURE`), likely a container image incompatibility with FIPS-enabled nodes.

## Prerequisites Checklist

### Ready (no action needed)
- [x] Cluster access with admin privileges
- [x] NVIDIA GPU Operator installed and functional
- [x] GPU nodes available (2 nodes, 8 GPUs total)
- [x] RHOAI 3.5.0-ea.2 installed with KServe, Trainer, Model Registry
- [x] MLflow Operator installed (needs instance creation)
- [x] Agent eval-harness repo cloned locally with PR #90 fetched

### Needs Setup
- [ ] **Deploy MLflow server instance** -- Operator is running but no server exists. Need to create MLflow CR.
- [ ] **Deploy vLLM with open-weight model** -- Existing vLLM is broken (FIPS error). Need fresh deployment with a T4-compatible image and model.
- [ ] **Create namespace for POC** -- Use dedicated namespace to avoid interfering with `grpo-trainer` workloads.
- [ ] **Install OpenCode locally** -- Need `opencode` CLI for the eval-harness OpenCode runner.
- [ ] **Clone RFE Creator** -- Need the skill and its eval config for benchmarking.
- [ ] **Validate eval-harness with PR #90** -- Checkout `feat/otel-opencode-runner` branch, run tests.

### Open Questions for Rob
1. **Is the IDM cluster (16x A100 80GB) accessible?** This AWS cluster has T4s, which limits model size to ~14B FP16. The epic doc specifies A100s.
2. **Model selection given T4 GPUs**: Should we proceed with Qwen2.5-Coder-14B on this cluster, or wait for IDM access?
3. **Namespace**: Should we create a new namespace or reuse `grpo-trainer`?
4. **MLflow**: Should we deploy a new MLflow instance or is there a shared one we should connect to?

## Approach Decision (2026-06-05)

**Use this T4 cluster as a dry-run environment** to validate the full setup process. Document every step into a reproducible runbook. Then replay the runbook on the IDM cluster (A100s) with production-sized models.

- **This cluster**: Qwen2.5-Coder-7B-Instruct (fits 1 T4). Purpose: validate pipeline, configs, tooling.
- **IDM cluster**: Qwen2.5-Coder-32B+ (A100s). Purpose: real benchmarks for the POC deliverables.

## Next Steps

1. Create POC namespace on this cluster
2. Deploy MLflow server instance
3. Deploy vLLM with Qwen2.5-Coder-7B-Instruct
4. Install and validate OpenCode + eval-harness PR #90
5. Run a smoke eval to validate the full pipeline
6. Package everything into a reproducible runbook
7. Replay on IDM cluster with larger model
