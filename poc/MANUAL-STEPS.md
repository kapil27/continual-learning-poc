# Manual Steps: Run Eval and Generate Report

## Prerequisites (already done)
- IBM cluster logged in: `oc whoami` shows `knema@redhat.com`
- MLflow running: https://mlflow-kapil-continual-test.apps.oai-kft-ibm.ibm.rh-ods.com
- Qwen 27B running: https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com
- Agent eval-harness installed: `pip install -e ".[mlflow]"` on branch `feat/otel-opencode-runner`
- OpenCode installed: `opencode --version` → 1.16.0
- RFE Creator cloned: `/Users/knema/Project/agentic-ai-skills/rfe-creator`

## Step 1: Set Environment Variables

```bash
# In your terminal:
export NODE_TLS_REJECT_UNAUTHORIZED=0   # Skip self-signed cert errors
export ANTHROPIC_API_KEY="your-key"      # Needed for Claude Opus judges
export MLFLOW_TRACKING_URI="https://mlflow-kapil-continual-test.apps.oai-kft-ibm.ibm.rh-ods.com"
```

## Step 2: Run Opus Baseline (via Claude Code)

Open a terminal in the rfe-creator directory:

```bash
cd /Users/knema/Project/agentic-ai-skills/rfe-creator
```

Start Claude Code:
```bash
claude
```

Inside Claude Code, run:
```
/eval-run --model opus --run-id 2026-06-08-opus-baseline
```

This will:
1. Set up workspaces for each test case
2. Execute rfe.speedrun with Claude Opus on each case
3. Collect artifacts (RFE markdown files)
4. Score with all judges
5. Generate HTML report at `eval/runs/2026-06-08-opus-baseline/report.html`

**Expected time**: ~60-90 minutes for 20 cases.

## Step 3: Run Qwen 27B (via OpenCode)

Make sure `opencode.json` is in the rfe-creator directory with the IBM cluster config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "vllm-ibm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "vLLM IBM Cluster",
      "options": {
        "baseURL": "https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com/v1",
        "headers": {
          "Authorization": "Bearer <your-oc-token>"
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
```

Get your token:
```bash
oc whoami -t
```

Then in Claude Code:
```
/eval-run --model vllm-ibm/qwen36-27b --agent opencode --run-id 2026-06-08-qwen27b --baseline 2026-06-08-opus-baseline
```

This will:
1. Run the same cases with Qwen 27B via OpenCode
2. Score with the same judges
3. **Compare against the Opus baseline** (pairwise A/B judging)
4. Generate HTML report with comparison, diffs, and analysis

**Expected time**: ~90-120 minutes for 20 cases.

## Step 4: View Reports

```bash
open eval/runs/2026-06-08-opus-baseline/report.html
open eval/runs/2026-06-08-qwen27b/report.html
```

## Important Notes

1. The `/eval-run` command must be run **inside Claude Code** (not opencode). Claude Code orchestrates the full pipeline including the analysis section.
2. The `--baseline` flag enables pairwise comparison and side-by-side diffs in the report.
3. If you get token expiry errors, refresh with `oc login` and update `opencode.json`.
4. The eval.yaml in the rfe-creator repo needs to have proper judges (frontmatter_valid, rfe_quality, etc.). If the current eval.yaml only has our simple judges, we need to get the proper config from Antonin's setup.

## Overnight Run

To run overnight without losing the session:

```bash
# Option 1: tmux
tmux new -s eval
claude
# ... run /eval-run commands ...
# Ctrl-B D to detach

# Option 2: nohup (for the execute step only)
nohup claude --print "/eval-run --model opus --run-id overnight-opus" > /tmp/eval-opus.log 2>&1 &
```

## Key Question: Where is the proper eval.yaml?

The reference report (nemotron-3-ultra-vs-opus4-8.html) used an eval.yaml with:
- 20 test cases in batch mode
- 8 judges (frontmatter_valid, has_review, has_content, rfe_quality, revision_quality, etc.)
- LLM judges using Claude Opus for quality scoring

This config is NOT in the rfe-creator repo on any branch. It was likely in Antonin's working directory. You may need to ask Rob or Antonin where it lives, or we can reconstruct it from the report.
