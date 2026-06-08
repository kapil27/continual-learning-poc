# Manual Steps: Run Eval Overnight

## What You Have (already set up)
- IBM cluster: `oc whoami` → `knema@redhat.com`
- MLflow running: https://mlflow-kapil-continual-test.apps.oai-kft-ibm.ibm.rh-ods.com (returns OK)
- Qwen 27B running: https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com
- RFE Creator repo with 20 test cases + proper eval.yaml (8 judges, batch mode)
- Agent eval-harness on `feat/otel-opencode-runner` branch
- OpenCode 1.16.0 with `opencode.json` pointing at Qwen 27B

## Step 1: Set Up Terminal (tmux recommended)

```bash
tmux new -s eval-overnight
```

## Step 2: Set Environment

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
export ANTHROPIC_API_KEY="your-anthropic-key"
cd /Users/knema/Project/agentic-ai-skills/rfe-creator
```

## Step 3: Update opencode.json with fresh token

```bash
# Get fresh token
TOKEN=$(oc whoami -t)

cat > opencode.json <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "vllm-ibm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "vLLM IBM Cluster",
      "options": {
        "baseURL": "https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com/v1",
        "headers": {
          "Authorization": "Bearer $TOKEN"
        }
      },
      "models": {
        "qwen36-27b": {
          "name": "Qwen 3.6 27B"
        }
      }
    }
  },
  "model": "vllm-ibm/qwen36-27b"
}
EOF
```

## Step 4: Run Claude Opus Baseline (~60-90 min)

```bash
claude
```

Inside Claude Code:
```
/eval-run --model opus --run-id 2026-06-08-opus-baseline
```

Wait for it to complete. Report will be at: `eval/runs/2026-06-08-opus-baseline/report.html`

## Step 5: Run Qwen 27B with Baseline Comparison (~90-120 min)

Still inside Claude Code:
```
/eval-run --model vllm-ibm/qwen36-27b --agent opencode --run-id 2026-06-08-qwen27b --baseline 2026-06-08-opus-baseline
```

This will:
- Run all 20 cases through Qwen 27B via OpenCode
- Score with 8 judges (6 deterministic + 2 LLM quality judges using Claude Opus)
- Run pairwise A/B comparison against the Opus baseline
- Generate HTML report with diffs, scores, analysis

Report: `eval/runs/2026-06-08-qwen27b/report.html`

## Step 6: View Reports

```bash
open eval/runs/2026-06-08-opus-baseline/report.html
open eval/runs/2026-06-08-qwen27b/report.html
```

## Detach tmux (if running overnight)

```
Ctrl-B then D
```

Re-attach next morning:
```bash
tmux attach -s eval-overnight
```

## Notes

- Token expiry: `oc` tokens expire after ~24h. If the Qwen 27B run fails with 401, re-login (`oc login`) and update `opencode.json` with a fresh token.
- Cost: The Opus baseline will cost ~$5-10 (20 cases × ~$0.25-0.50 each). Qwen 27B is free. LLM judges use Claude Opus too (~$2-3 for scoring).
- The eval.yaml uses `execution.mode: batch` which means all 20 cases are bundled into a single `batch.yaml` and processed in one skill invocation.
