# Fix: Run Qwen 27B Through Claude Code (Not OpenCode)

## The Problem
OpenCode doesn't support the `Agent` tool for spawning sub-agents. The `rfe.speedrun` skill needs this for Phase 2 (auto-fix) and review. That's why Qwen 27B only completed Phase 1.

## The Solution
vLLM implements the **Anthropic Messages API** natively. We can run Claude Code pointing at our vLLM Qwen 27B endpoint. Claude Code handles all the orchestration (Agent tool, sub-agents, permissions) while Qwen 27B generates the content.

This is exactly how the Nemotron report was produced: `Agent: claude-code`, `Model: nemotron-3-ultra`.

## Steps

### 1. Get fresh cluster token
```bash
oc login  # if token expired
TOKEN=$(oc whoami -t)
```

### 2. Launch Claude Code pointing at vLLM Qwen 27B
```bash
cd /Users/knema/Project/agentic-ai-skills/rfe-creator

ANTHROPIC_BASE_URL=https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com \
ANTHROPIC_API_KEY=dummy \
ANTHROPIC_AUTH_TOKEN=$TOKEN \
ANTHROPIC_DEFAULT_OPUS_MODEL=qwen36-27b \
ANTHROPIC_DEFAULT_SONNET_MODEL=qwen36-27b \
ANTHROPIC_DEFAULT_HAIKU_MODEL=qwen36-27b \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
claude
```

### 3. Run the eval inside Claude Code
```
/eval-run --model opus --run-id 2026-06-09-qwen27b-via-claude --baseline 2026-06-08-opus-baseline
```

Note: `--model opus` maps to `ANTHROPIC_DEFAULT_OPUS_MODEL=qwen36-27b`, so it actually uses Qwen.

### 4. For overnight run (tmux)
```bash
tmux new -s qwen-eval

cd /Users/knema/Project/agentic-ai-skills/rfe-creator

TOKEN=$(oc whoami -t)

ANTHROPIC_BASE_URL=https://qwen36-27b-ksuta-nemotron.apps.oai-kft-ibm.ibm.rh-ods.com \
ANTHROPIC_API_KEY=dummy \
ANTHROPIC_AUTH_TOKEN=$TOKEN \
ANTHROPIC_DEFAULT_OPUS_MODEL=qwen36-27b \
ANTHROPIC_DEFAULT_SONNET_MODEL=qwen36-27b \
ANTHROPIC_DEFAULT_HAIKU_MODEL=qwen36-27b \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
claude

# Inside Claude Code:
/eval-run --model opus --run-id 2026-06-09-qwen27b-via-claude --baseline 2026-06-08-opus-baseline

# Detach: Ctrl-B D
```

## Why This Works
- Claude Code sends requests in Anthropic Messages format
- vLLM v0.8.4+ translates these to its internal format
- Qwen 27B generates responses (including tool calls)
- Claude Code handles Agent tool, sub-agents, permissions natively
- The eval-harness sees `runner: claude-code` so the full pipeline runs

## Important Notes
- The `$TOKEN` is an OpenShift bearer token for the vLLM route auth. It expires after ~24h.
- `ANTHROPIC_API_KEY=dummy` is required but not used (vLLM auth is via the bearer token in the route).
- The model name `qwen36-27b` must match the `--served-model-name` in the vLLM deployment.
- The vLLM endpoint already has `--enable-auto-tool-choice --tool-call-parser qwen3_coder` which handles Claude Code's tool calling format.
