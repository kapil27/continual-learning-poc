# 08 Implementation Progress: Cluster Setup & Validation

## Status: Phase 1 Complete (Dry-Run on T4 Cluster)

**Date**: 2026-06-05
**Cluster**: `kap-test-pool-tfxhm` (AWS us-east-2, OCP 4.21.15, RHOAI 3.5.0-ea.2)
**JIRA**: [RHOAIENG-62327](https://redhat.atlassian.net/browse/RHOAIENG-62327)

## Infrastructure Deployed

| Component | Version | Status | Endpoint |
|-----------|---------|--------|----------|
| Namespace | `eval-poc` | Created | - |
| PostgreSQL | 16 (RHEL9) | Running | `mlflow-postgres.eval-poc.svc:5432` |
| MLflow | 3.12.0 | Running, Available | `mlflow.redhat-ods-applications.svc:8443/mlflow` |
| vLLM | 0.8.4 | Running | `vllm-qwen-7b.eval-poc.svc:8000` |
| Model | Qwen2.5-Coder-3B-Instruct | Loaded, FP16 | 5.76 GiB VRAM, 32K context |

## Local Tooling

| Tool | Version | Status |
|------|---------|--------|
| OpenCode | 1.16.0 | Installed, provider configured for vLLM |
| Agent Eval Harness | 1.4.0 (PR #90) | Branch `feat/otel-opencode-runner`, pip-installed |
| Runners registered | claude-code, cli, opencode, responses-api | All 4 verified |
| RFE Creator | main branch | Cloned at `agentic-ai-skills/rfe-creator` |

## Issues Found and Solved

### 1. MLflow: SQLite on PVC Fails Under OpenShift SCC
**Symptom**: Migration job loops with `OSError`, `Permission denied` on `/mlflow/test-write`.
**Root cause**: OpenShift SCC assigns random UIDs. The PVC mount has `drwxrwsr-x root:1000920000` but the container running as uid `1000920000` still can't create files due to SELinux context mismatch on gp3-csi volumes.
**Fix**: Use PostgreSQL as MLflow backend instead of SQLite. Deploy via `configs/mlflow-postgres.yaml`.

### 2. MLflow: psycopg2 Demands SSL
**Symptom**: Migration loops with `server does not support SSL, but SSL was required`, retrying with exponential backoff.
**Root cause**: MLflow's psycopg2 driver defaults to `sslmode=require`. Red Hat's PostgreSQL 16 container has no TLS configured.
**Fix**: Append `?sslmode=disable` to the PostgreSQL connection string in the secret.

### 3. Model Download: HuggingFace xorbs CDN Stalls
**Symptom**: KServe storage initializer downloads shard 1 (4.6GB) then shard 2 hangs at 4.6GB for 20+ minutes with no growth.
**Root cause**: HuggingFace's new xet/xorbs CDN backend drops connections from this AWS cluster (`IncompleteMessage` error from the xet HTTP client).
**Fix**: Bypass KServe's storage initializer entirely. Use a Kubernetes Job with `huggingface_hub` Python library to download to a PVC (`configs/model-download-job.yaml`). Downloads complete in under 2 minutes.

### 4. vLLM: RHOAI Image Digest Returns 404
**Symptom**: `ErrImagePull` -- `manifest unknown` for the RHOAI vLLM CUDA image.
**Root cause**: The sha256 digest in the `kserve-parameters` ConfigMap is stale for this RHOAI 3.5 Early Access build.
**Fix**: Use the public `vllm/vllm-openai:v0.8.4` image instead.

### 5. vLLM: Qwen 7B OOMs on T4
**Symptom**: `torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 112.00 MiB. GPU 0 has a total capacity of 14.56 GiB of which 32.81 MiB is free.`
**Root cause**: Qwen 7B FP16 = 14.25 GiB. T4 has 14.56 GiB total. After model loading, only 32 MiB remains -- zero headroom for KV cache.
**Fix**: Use Qwen 3B on T4 (5.76 GiB model, leaves 8.8 GiB for KV cache). 7B+ models require A100.

### 6. OpenCode: `run` Mode Hangs on macOS
**Symptom**: `opencode run --format json "message"` hangs indefinitely after `service=vcs branch=master initialized`. No API calls made.
**Root cause**: OpenCode 1.16.0 expects stdin to be piped in non-interactive mode. When run with a message argument but no piped stdin, it blocks waiting for input.
**Fix**: Pipe the message: `echo "prompt" | opencode run --format json`. This matches what the eval-harness OpenCode runner does internally.

### 7. OpenCode: Wrong Provider Config Format
**Symptom**: `"openai/chat/completions" cannot be parsed as a URL` -- the API type string is used as a URL path component.
**Root cause**: Using `"api": "openai"` with top-level `"baseURL"` is the wrong config schema. OpenCode uses AI SDK adapters selected by `npm` package name.
**Fix**: Use `"npm": "@ai-sdk/openai-compatible"` with `"options": {"baseURL": "http://..."}`. This is documented in the Atomic Chat / llama.cpp sections of the OpenCode provider docs.

### 8. vLLM: Tool Calling Returns 400
**Symptom**: `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`.
**Root cause**: vLLM default config does not enable tool call parsing. OpenCode sends `"tool_choice": "auto"` with every request.
**Fix**: Add `--enable-auto-tool-choice --tool-call-parser hermes` to vLLM args. Hermes parser works with Qwen models.

### 9. OpenCode: Context Window Overflow (T4-Specific)
**Symptom**: `This model's maximum context length is 32768 tokens. However, you requested 39615 tokens (7615 in the messages, 32000 in the completion).`
**Root cause**: OpenCode hardcodes `max_tokens: 32000` in all API calls. Its system prompt with tool definitions consumes ~7,600 tokens. Total needed: ~40K. Qwen 3B's native max is 32,768.
**Resolution**: NOT a blocker on the IDM cluster. Qwen2.5-Coder-32B supports 128K context natively. This issue is specific to the T4 dry-run with the 3B model.

## Validated Configuration for IDM Cluster

### OpenCode Provider Config
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "vllm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "vLLM (IDM cluster)",
      "options": {
        "baseURL": "http://<vllm-service>:8000/v1"
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

### vLLM Deployment Args (A100)
```
--model Qwen2.5-Coder-32B-Instruct
--max-model-len 65536
--gpu-memory-utilization 0.9
--dtype bfloat16
--enforce-eager
--enable-auto-tool-choice
--tool-call-parser hermes
--served-model-name qwen-coder-32b
```

## What This Validates for the POC

| What | Validated? | Notes |
|------|-----------|-------|
| MLflow deployment on RHOAI | Yes | PostgreSQL backend, kubernetes-auth |
| Model download to PVC | Yes | `huggingface_hub` Job, bypasses CDN issues |
| vLLM serving with tool calling | Yes | Hermes parser, OpenAI-compatible API |
| OpenCode -> vLLM connectivity | Yes | API calls confirmed, title generation works |
| Eval-harness OpenCode runner | Yes | PR #90 installed, runner registered |
| Full agentic execution | No | Blocked by 32K context on T4; works on A100 with 32B model |

## Next: IDM Cluster Deployment

Replay the runbook (`poc/RUNBOOK.md`) on the IDM cluster with these changes:
1. Model: `Qwen2.5-Coder-32B-Instruct` (was 3B)
2. `max-model-len`: 65536 (was 32768)
3. `dtype`: bfloat16 (was float16 -- A100 supports BF16 natively)
4. `tensor-parallel-size`: 1 (32B fits on a single A100 80GB)

Then execute the eval stories: Claude baseline -> Open-weight eval -> `/eval-optimize` -> Comparison report.
