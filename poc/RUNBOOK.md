# Setup Runbook: Agentic Eval POC on OpenShift AI

This runbook documents every step to set up the POC environment. Developed on the `kap-test-pool` (T4) cluster, reproducible on the IDM (A100) cluster.

## Prerequisites

- `oc` CLI logged into the target cluster with cluster-admin
- RHOAI 3.5+ installed with KServe, Trainer, MLflow Operator managed
- NVIDIA GPU Operator installed

## Step 1: Create POC Namespace

```bash
oc new-project eval-poc
```

## Step 2: Deploy PostgreSQL for MLflow Backend

MLflow needs a SQL backend. SQLite on PVC fails due to OpenShift SCC permission issues on gp3-csi volumes.

```bash
oc apply -f configs/mlflow-postgres.yaml
oc wait --for=condition=Available deployment/mlflow-postgres -n eval-poc --timeout=120s
```

## Step 3: Create MLflow DB Secret

The MLflow operator deploys to `redhat-ods-applications`, so the secret must exist there.

```bash
oc create secret generic mlflow-db-credentials \
  -n redhat-ods-applications \
  --from-literal=MLFLOW_BACKEND_STORE_URI="postgresql://mlflow:mlflow@mlflow-postgres.eval-poc.svc:5432/mlflow?sslmode=disable"
```

**Critical**: `?sslmode=disable` is required -- the Red Hat PostgreSQL container doesn't have TLS. Without it, psycopg2 demands SSL and the migration loops forever.

## Step 4: Deploy MLflow Instance

```bash
oc apply -f configs/mlflow-instance.yaml
oc wait --for=jsonpath='{.status.conditions[?(@.type=="Available")].status}'=True mlflow/mlflow --timeout=180s
```

**Verification**:
```bash
oc get mlflow mlflow -o jsonpath='{.status.version}'  # Expected: 3.12.0
```

**Internal URL**: `https://mlflow.redhat-ods-applications.svc:8443/mlflow`

## Step 5: Download Model to PVC

KServe's storage initializer uses HuggingFace's xorbs CDN which stalls on this cluster. Use the `huggingface_hub` Python library instead.

```bash
oc apply -f configs/model-download-job.yaml
oc wait --for=condition=complete job/download-qwen-3b -n eval-poc --timeout=600s
```

For the IDM cluster (A100), change the model to `Qwen/Qwen2.5-Coder-32B-Instruct` in the job YAML.

### Model Sizing Reference

| GPU | VRAM | Max Model (FP16) | Recommended |
|-----|------|-------------------|-------------|
| T4 | 15 GB | ~6B params | Qwen2.5-Coder-3B-Instruct |
| A100 40GB | 40 GB | ~20B params | Qwen2.5-Coder-14B-Instruct |
| A100 80GB | 80 GB | ~40B params | Qwen2.5-Coder-32B-Instruct |
| 2x A100 80GB | 160 GB | ~80B params | Llama 3.1 70B Instruct |

## Step 6: Deploy vLLM

```bash
oc apply -f configs/vllm-deployment.yaml
oc wait --for=condition=Available deployment/vllm-qwen-7b -n eval-poc --timeout=300s
```

**Verification**:
```bash
# From inside the cluster (exec into any pod):
curl http://vllm-qwen-7b.eval-poc.svc:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-coder-3b","messages":[{"role":"user","content":"Say hello"}],"max_tokens":20}'
```

**Key vLLM args to tune per GPU**:

| Param | T4 (15GB) | A100 (80GB) |
|-------|-----------|-------------|
| `--max-model-len` | 8192 | 32768 |
| `--gpu-memory-utilization` | 0.9 | 0.9 |
| `--dtype` | float16 | bfloat16 |
| `--tensor-parallel-size` | 1 | 1 (32B) or 2 (70B) |

**Internal endpoint**: `http://vllm-qwen-7b.eval-poc.svc:8000/v1`

## Step 7: Install OpenCode Locally

```bash
# macOS
brew install opencode
# or via Go
go install github.com/anomalyco/opencode@latest
```

Configure to point at the cluster vLLM endpoint:
```bash
# Port-forward to access from local machine
oc port-forward svc/vllm-qwen-7b 8000:8000 -n eval-poc
```

## Step 8: Setup Agent Eval Harness with PR #90

```bash
cd /path/to/agent-eval-harness
git fetch origin pull/90/head:feat/otel-opencode-runner
git checkout feat/otel-opencode-runner
pip install -e ".[mlflow]"
```

## Step 9: Run Smoke Eval

*TODO: Configure eval.yaml for OpenCode + vLLM and run a minimal test*

---

## Troubleshooting

### MLflow migration loops with OSError (SQLite)
**Root cause**: SQLite on network PVCs (gp3-csi) fails with permission issues under OpenShift SCC.
**Fix**: Use PostgreSQL backend instead of SQLite.

### MLflow migration loops with "server does not support SSL"
**Root cause**: Red Hat PostgreSQL container has no TLS.
**Fix**: Add `?sslmode=disable` to the connection string.

### RHOAI vLLM image returns "manifest unknown"
**Root cause**: The sha256 digest in `kserve-parameters` ConfigMap may be stale for EA builds.
**Fix**: Use the public `vllm/vllm-openai:v0.8.4` image instead.

### HuggingFace model download stalls at ~4.6GB
**Root cause**: HuggingFace xorbs/xet CDN drops connections from this cluster (`IncompleteMessage` error).
**Fix**: Use a Job with `huggingface_hub` Python library to download to a PVC, then mount the PVC in vLLM.

### vLLM OOM on T4 with 7B model
**Root cause**: Qwen 7B FP16 = 14.25 GiB, T4 = 14.56 GiB total. Zero headroom for KV cache.
**Fix**: Use Qwen 3B on T4 (5.76 GiB, leaves 8.8 GiB for KV cache). Save 7B+ for A100.

### vLLM "Compute Capability < 8.0 not supported by V1 Engine"
**Root cause**: T4 is Turing (compute 7.5), vLLM V1 requires Ampere+ (8.0).
**Fix**: Not a problem -- vLLM automatically falls back to V0 engine. FP8 quantization won't work on T4 though.

### Existing vLLM crashes with "FATAL FIPS SELFTEST FAILURE"
**Root cause**: `docker.io/vllm/vllm-openai:latest` is not FIPS-compatible.
**Fix**: Use a tagged version (`v0.8.4`) or the RHOAI image (if digest is valid).
