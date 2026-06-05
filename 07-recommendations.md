# Recommendations for Sprint 2

## Executive Recommendation

The architecture is **sound and well-designed**. The two-loop structure is the right abstraction, MLflow is a defensible choice for the data plane, and the progressive compression pipeline has strong research backing. The principal-engineer verdict: **proceed, with focused de-risking on the integration gaps**.

Sprint 1 should focus on proving the outer loop works with an openweight model. Sprint 2 should build the bridges between loops.

---

## Sprint 2 Priority Stack

### P0: Judge-to-Training-Data Bridge (Highest Value)

**What**: Build a pipeline that exports eval-harness judge results and agent traces into training-ready formats (SFT pairs, DPO preference pairs, GRPO reward-labeled trajectories).

**Why**: This is the single highest-value integration and has no existing open-source solution. It connects the outer loop's reward signal to the inner loop's training input.

**Concrete deliverables**:
1. Script: `export_sft_data.py` -- converts successful eval-run cases (all judges pass) into `(instruction, completion)` JSONL
2. Script: `export_dpo_pairs.py` -- converts pairwise comparison results into `(prompt, chosen, rejected)` JSONL
3. Script: `export_grpo_rewards.py` -- converts judge scores into reward-labeled trajectories for GRPO
4. Integration with MLflow: export from MLflow traces + eval-harness annotations

**Estimated effort**: 1-2 weeks for a senior engineer.

### P1: OpenCode CLI Runner Validation

**What**: Validate and document running eval-harness with OpenCode via the `cli` runner.

**Concrete deliverables**:
1. Working `eval.yaml` config with `runner.type: cli` and OpenCode command template
2. Documentation of what works and what doesn't (events, tool interception, etc.)
3. Graceful handling of empty `events.json` in judges that depend on it

**Estimated effort**: 2-3 days.

### P2: EvalHub Adapter Runner Flexibility

**What**: Fix the EvalHub adapter (`agent_eval/evalhub/adapter.py`) to honor `runner.type` from eval.yaml instead of hardcoding `ClaudeCodeRunner`.

**Concrete deliverable**: Update `run_benchmark_job()` to use the runner registry (`RUNNERS`) instead of importing `ClaudeCodeRunner` directly.

**Estimated effort**: 1 day (code change is small, testing is the work).

### P3: Tool-Use Fidelity Judges

**What**: Add dedicated judges for tool-calling accuracy to the eval suite.

**Concrete deliverables**:
1. Builtin judge: `tool_schema_valid` -- validates tool call JSON against expected schemas
2. Builtin judge: `tool_selection_correct` -- checks if the right tools were called for the task
3. Threshold: `min_pass_rate: 1.0` on tool schema validity (hard gate for compression)

**Estimated effort**: 3-5 days.

### P4: Cron-Based Skill Optimization Agent

**What**: Kubernetes CronJob that runs the eval-run → eval-optimize loop on a schedule.

**Concrete deliverables**:
1. Helm chart for deploying the cron agent
2. ConfigMap for skill target configuration
3. Git integration for committing optimized SKILL.md
4. MLflow integration for tracking iteration history

**Estimated effort**: 1 week.

### P5: Safety Evaluation Integration

**What**: Add Garak safety scans to the eval-gated progression pipeline.

**Concrete deliverables**:
1. Garak scan as a required step before model deployment
2. 5 adversarial test cases for the target skill
3. Safety threshold in eval.yaml

**Estimated effort**: 3-5 days.

---

## Technical Decisions to Make Before Sprint 2

| Decision | Options | Recommendation | Rationale |
|----------|---------|----------------|-----------|
| **Initial training method** | SFT, DPO, GRPO | LoRA SFT first | Simplest, proves the pipeline, low data requirement |
| **Teacher model for traces** | Claude, Qwen 27B, Nemotron | Qwen 27B | Avoids cross-provider ToS issues; already deployed |
| **Eval dataset size** | 5, 15, 30 cases | 15 minimum | Statistical significance for gating decisions |
| **Loop scheduling** | Sequential, concurrent, joint | Sequential | Avoids loop interference; simpler to reason about |
| **Skill target for ref arch** | RFE Creator, GitHub Triage | GitHub Issues Triage | No JIRA write access needed; simpler integration |
| **Training data source** | Production traces, synthetic, autofixer | Synthetic first | Don't wait for production trace availability |

---

## Sprint 2 Timeline (Suggested)

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | OpenCode runner validation + baseline benchmark analysis | Working eval-harness + OpenCode integration |
| 2 | Judge-to-training-data bridge (SFT export) | `export_sft_data.py` + 50 synthetic traces |
| 3 | First LoRA SFT fine-tune + eval comparison | Tuned model + comparison report |
| 4 | DPO preference pairs + cron agent deployment | `export_dpo_pairs.py` + Helm chart |

---

## What to Defer to Sprint 3+

- GRPO training (needs more infrastructure, verifiable reward functions)
- Process-level reward models (research-heavy)
- Agent trajectory format standardization (cross-team coordination needed)
- Full Kubeflow Pipeline orchestration (premature optimization)
- SLM compression (Stage 3 of the pipeline -- needs Stage 2 to prove value first)
- Kagenti integration (agent lifecycle management -- nice-to-have for POC)
