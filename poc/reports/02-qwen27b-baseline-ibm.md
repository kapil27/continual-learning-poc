# Eval Report: Qwen 27B Baseline (IBM Cluster) — Full Skill Context

**Date**: 2026-06-08
**Cluster**: oai-kft-ibm (2x8 A100 SXM4 80GB)
**Model**: Qwen 3.6 27B Instruct (vLLM, TP=2, 262K context, tool calling enabled)
**Runner**: OpenCode 1.16.0 via eval-harness PR #90
**Skill**: rfe.speedrun (--dry-run)

## Results: Run 2 (Full Skill Context)

| Case | Problem Statement | Status | Duration | Input Tokens | Output Tokens | Files |
|------|------------------|--------|----------|--------------|---------------|-------|
| rfe-001 | GPU auto-scaling for model serving | PASS | 20.3s | 36,787 | 1,080 | 0 |
| rfe-002 | Prometheus metrics for Training Operator | PASS | 15.4s | 36,788 | 753 | 1 (`speedrun-config.yaml`) |
| rfe-003 | MLflow experiment comparison filtering | PASS | 15.4s | 36,788 | 746 | 1 (`speedrun-config.yaml`) |

**Total execution time**: 52 seconds (3 cases)
**All cases**: Exit code 0

## Results: Run 1 (No Skill Context -- infrastructure validation only)

| Case | Status | Duration | Input Tokens | Output Tokens |
|------|--------|----------|--------------|---------------|
| rfe-001 | PASS | 8.2s | 15,821 | 357 |
| rfe-002 | PASS | 4.6s | 7,822 | 177 |
| rfe-003 | PASS | 4.1s | 7,822 | 153 |

## Observations

### What Worked
1. **Full pipeline connectivity**: OpenCode -> Qwen 27B (vLLM, TP=2, 262K context) -> tool calling -> file writes.
2. **Skill discovery**: The model found and read the `rfe.speedrun` skill definition (evidenced by 36K input tokens -- reading skill + CLAUDE.md).
3. **Step 0 execution**: Cases 2 & 3 correctly executed Step 0 of rfe.speedrun -- parsed `--dry-run` flag and wrote `speedrun-config.yaml`.
4. **Tool usage**: Each case used 3 tool steps (read skill, glob, write).
5. **No crashes**: Zero CUDA OOM, zero context overflow, zero timeouts.

### What Didn't Work (Gap vs Claude Opus)
1. **Multi-step pipeline not completed**: The model executed Step 0 (flag parsing) but did NOT continue to Step 1+ (create RFE, review, auto-fix, submit). It stopped after initialization.
2. **`headless` flag not set correctly**: Config shows `headless: false` -- should be `true` when called from an eval harness.
3. **No RFE artifacts produced**: No markdown files with YAML frontmatter in `artifacts/rfe-tasks/`. The expected end state is a complete RFE document.
4. **Conversation-heavy, action-light**: The model spent tokens reasoning about the skill but didn't execute the full multi-step workflow autonomously.

## Assessment

**This is exactly the baseline gap we need to measure.** The model can:
- Read and understand complex skill definitions
- Parse arguments correctly
- Execute simple tool calls (glob, write)

But it CANNOT:
- Follow a complex multi-step pipeline end-to-end without human guidance
- Chain skill invocations (create -> review -> auto-fix -> submit)
- Maintain state across many sequential steps

This gap is what skill optimization (`/eval-optimize`) and fine-tuning should address.

## What This Proves

- The eval pipeline is **fully operational** on the IBM cluster
- Qwen 27B has the **raw capability** (context window, tool calling, reasoning) but lacks **multi-step execution discipline**
- The performance gap is in **agentic follow-through**, not in understanding or tool use
- This is a valid baseline for measuring improvement from skill optimization and fine-tuning

## Next Steps

1. **Run Claude Opus baseline** on the same 3 cases for direct comparison (measures the gap)
2. **Run `/eval-optimize`** to adapt the skill prompt for Qwen 27B (measures prompt-level improvement)
3. **Document the gap** quantitatively for the RHOAIENG-62327 deliverable
