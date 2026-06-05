# OpenCode + vLLM Context Window Constraint

**Date**: 2026-06-05

## Finding

OpenCode 1.16.0 hardcodes `max_tokens: 32000` in all LLM API calls. Combined with its system prompt (~7.6K tokens including tool definitions), this requires a model context window of at least **40K tokens**.

Qwen2.5-Coder-3B-Instruct has a native max context of **32,768 tokens**. The math doesn't work:
- System prompt + tools: ~7,600 tokens
- max_tokens (hardcoded): 32,000 tokens  
- **Total needed: ~39,600 tokens > 32,768 available**

## Evidence

```
ContextOverflowError: This model's maximum context length is 32768 tokens.
However, you requested 39615 tokens (7615 in the messages, 32000 in the completion).
```

vLLM rejects `max-model-len=40960` because it exceeds the model's `max_position_embeddings=32768`.

## What Works

- OpenCode DOES connect to vLLM via the `@ai-sdk/openai-compatible` provider (with piped stdin)
- Title generation (smaller system prompt, ~421 tokens + 32K = fits) succeeds
- Tool calling works when `--enable-auto-tool-choice --tool-call-parser hermes` is enabled in vLLM

## Impact

The T4 dry-run cluster can validate everything EXCEPT the actual agentic execution. The infrastructure pipeline (MLflow, vLLM, OpenCode config, port-forward) is fully validated.

## Resolution

On the IDM cluster with A100s, use **Qwen2.5-Coder-32B-Instruct** (128K context, 64GB FP16). This solves the context window constraint entirely:
- 128K context >> 40K needed
- A100 80GB >> 64GB model + KV cache

## Validated Config for IDM Cluster

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "vllm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "vLLM (IDM)",
      "options": {
        "baseURL": "http://vllm-endpoint:8000/v1"
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

## OpenCode `run` Mode Quirks Discovered

1. **Stdin pipe required**: `opencode run` hangs on macOS when there's no TTY. Must pipe the message: `echo "prompt" | opencode run --format json`
2. **Provider config format**: Must use `"npm": "@ai-sdk/openai-compatible"` with `"options": {"baseURL": "..."}`, NOT `"api": "openai"` with top-level `"baseURL"`
3. **Tool calling**: vLLM must have `--enable-auto-tool-choice --tool-call-parser hermes` for OpenCode's tool use to work
