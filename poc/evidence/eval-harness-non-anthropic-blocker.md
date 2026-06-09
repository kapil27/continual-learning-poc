# Status: Running Eval-Harness with Non-Anthropic Models

**Date**: 2026-06-10
**Blocker**: The eval-harness pipeline cannot run end-to-end with Qwen 27B

## What Works

- Claude Code interactively with Qwen 27B via `ANTHROPIC_BASE_URL` pointing at vLLM
- Phase 1 (RFE creation) -- 20-25 RFE task files generated successfully
- Phase 2 (auto-fix) partially -- pipeline enters ASSESS phase, starts review
- Local proxy handles vLLM's system-role message limitation

## What Doesn't Work

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| Session restore rejects model name | Claude Code validates model names against hardcoded list on restore | Subprocess falls back to real Anthropic API mid-run |
| `ANTHROPIC_API_KEY=dummy` rejected | Claude Code validates API key against api.anthropic.com | Can't use fake key with `ANTHROPIC_BASE_URL` redirect |
| vLLM rejects system role messages | vLLM 0.8.x Anthropic adapter doesn't support inline system messages | Requires local proxy to strip/convert system messages |
| Sub-agent spawning incomplete | Qwen 27B doesn't reliably continue multi-phase pipelines | Phase 2 auto-fix produces partial results |
| OpenCode sub-agent bugs | Task tool hangs/aborts in headless mode | PR #90 OpenCode runner can't complete Phase 2+ |

## Confirmed by Team

A teammate got Claude Code running with Qwen interactively but said: "to run the actual eval harness properly needed some custom changes" and "hacked it locally just to get it running properly."

## Options Forward

1. **Get the teammate's custom hacks** -- ask what specific changes they made to the eval-harness
2. **Upgrade vLLM** -- newer versions handle system role messages natively, eliminating the proxy
3. **Use Nemotron's gateway setup** -- ask Rob/Antonin how the Nemotron eval was configured (it worked end-to-end with a non-Anthropic model through claude-code runner)
4. **Use the eval-harness Responses API runner** -- this runner uses the OpenAI Responses API which might work better with vLLM's OpenAI endpoint (bypasses Anthropic API entirely)
5. **Report Phase 1 results only** -- document the quality gap based on RFE creation alone (Phase 1), noting that multi-phase pipeline completion is a separate capability gap

## Recommended Next Step

Ask the teammate for their local hacks. If those are small patches to the eval-harness, we can apply them and get the full pipeline running immediately.
