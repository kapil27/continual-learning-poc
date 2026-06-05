# Risks and Gaps

## Risk Register

### RISK-01: Loop Interference (Severity: HIGH)

**Description**: The outer loop optimizes skills for a specific model. The inner loop then changes the model. The optimized skill may no longer be optimal for the new model.

**Example**: eval-optimize adds "Think step-by-step before calling tools" to SKILL.md because Qwen 27B benefits from chain-of-thought prompting. After fine-tuning, the model may handle tool calls differently, making that instruction counterproductive or irrelevant.

**Likelihood**: High. Different models respond differently to the same prompts. Fine-tuning changes model behavior by definition.

**Mitigation options**:
1. **Sequential scheduling**: Run inner loop first (model update), then outer loop (skill re-optimization). Never concurrent.
2. **Re-evaluation gate**: After every model swap, re-run the full eval suite. If regressions detected, trigger outer loop.
3. **Model-agnostic skill design**: Write skills that avoid model-specific prompt tricks. Hard to enforce.
4. **Joint optimization**: Run both loops together with shared reward signal. Adds significant complexity, defer to later phases.

**Recommendation**: Start with sequential scheduling (Sprint 2). Add re-evaluation gate as automated check.

---

### RISK-02: Eval Noise / Statistical Rigor (Severity: MEDIUM)

**Description**: LLM judges have variance. Eval-gated progression decisions (should we deploy this model?) are based on noisy scores.

**Evidence**: The strategy doc doesn't specify how many eval runs are needed for statistical significance. A single eval run with 5 test cases and LLM judges could produce different scores each time.

**Quantification**: LLM judge variance is typically 0.5-1.0 points on a 5-point scale. With 5 test cases, the confidence interval on mean score is wide.

**Mitigation options**:
1. **Multiple runs**: Run eval-run 3+ times per gate decision, report mean and confidence interval
2. **Position debiasing**: Already implemented in pairwise comparison (AB + BA), good
3. **Deterministic judges first**: Prefer inline `check` judges (deterministic) over LLM judges for gating decisions
4. **Larger test sets**: 20+ cases for meaningful statistics
5. **Temperature=0 for judges**: Reduce but not eliminate variance

**Recommendation**: Gate on deterministic judges (pass rate) for go/no-go decisions. Use LLM judges for quality insights but not hard gates. Require minimum 15 test cases.

---

### RISK-03: Tool-Use Fidelity Degradation (Severity: HIGH)

**Description**: The strategy doc correctly identifies that tool-use fidelity degrades fastest during compression. Correct JSON schema, parameter types, and tool selection are fragile in smaller models.

**Evidence**: NVIDIA's SLM research shows 10-30x cost reduction on standard benchmarks, but tool-calling accuracy drops significantly in 7-9B models without targeted training.

**Impact on POC**: The RFE Creator skill makes tool calls (JIRA API, file operations). If compression breaks tool calling, the skill becomes non-functional regardless of text quality.

**Mitigation options**:
1. **Tool-use-specific judges**: Add judges that specifically validate tool call schema and parameter types
2. **Structured Agent Distillation (SAD)**: Use segment-specific losses for REASON vs ACT spans during training
3. **Tool-use LoRA**: Separate LoRA adapter specifically for tool calling format compliance
4. **Function calling benchmarks**: Add tau-bench or similar tool-use benchmarks to the eval gate

**Recommendation**: Add a dedicated `tool_call_schema_valid` judge to the eval suite for Sprint 2. Gate compression on tool-calling pass rate, not just output quality.

---

### RISK-04: Cross-Provider Distillation Legality (Severity: HIGH)

**Description**: Distilling from Claude/GPT-4o traces into open-source models raises Terms of Service questions.

**Current status**: Unresolved. The strategy doc flags it but provides no resolution.

**Impact**: If Claude traces cannot legally be used to train open-source models, the entire production-trace-driven pipeline has a legal constraint.

**Mitigation options**:
1. **Use open-source frontier models as initial teachers** (Nemotron, Qwen, GLM) -- avoids ToS issue entirely
2. **Generate traces via BYOA platform with vLLM-served models** -- traces are from self-hosted models, no ToS constraint
3. **Legal review** of Anthropic's and OpenAI's current ToS regarding output usage for training
4. **Synthetic augmentation**: Use SDG Hub to generate training data that is inspired by patterns in traces, not direct copies

**Recommendation**: For the POC, use Qwen 27B (open-source) as the teacher model. This sidesteps the legal issue entirely and aligns with the Sprint 1 plan.

---

### RISK-05: Multi-Turn Credit Assignment (Severity: MEDIUM)

**Description**: Binary success/failure rewards lose signal in 20+ step agent traces. A 30-step task where step 15 was the critical decision gets the same reward as a task where step 1 was decisive.

**Impact**: DPO/GRPO training may not converge well on long agent traces because the reward signal is too sparse.

**Mitigation options**:
1. **Process-level reward models**: Score individual steps, not just final outcomes
2. **Step-level judge annotations**: Use eval-harness structured events to score tool call sequences
3. **Trajectory segmentation**: SAD approach (REASON vs ACT spans) provides finer-grained signal
4. **Shorter trajectories for initial training**: Start with simpler tasks (fewer steps) where credit assignment is clearer

**Recommendation**: Start with shorter tasks for training (3-5 tool calls). Use step-level annotations from eval-harness events as supplementary signal. Defer full process reward modeling to later phases.

---

### RISK-06: Safety Evaluation Gap (Severity: MEDIUM)

**Description**: The strategy doc notes that current benchmarks ignore adversarial robustness, prompt injection resistance, and tool misuse. The eval-harness has a `no_harmful_content` builtin judge but no systematic safety evaluation.

**Mitigation options**:
1. **Garak safety scans**: Already in Eval Hub -- integrate into the progression gate
2. **TrustyAI Guardrails**: Add as mandatory stage before production deployment
3. **Red-teaming test cases**: Add adversarial test cases to the eval dataset
4. **Tool misuse judges**: Add judges that check for unauthorized tool calls or dangerous parameters

**Recommendation**: Add Garak scan to the eval gate for Sprint 2. Create 5 adversarial test cases for the RFE Creator skill.

---

### RISK-07: Training Data Availability (Severity: MEDIUM for Sprint 1)

**Description**: Sprint 1 depends on production traces from Antonin. If these are unavailable, delayed, or insufficient quality, the fine-tuning deliverable is blocked.

**Mitigation options**:
1. **Generate synthetic traces**: Run RFE Creator with Claude on sample inputs, capture traces via MLflow
2. **Use autofixer results**: Available but format and quality unclear
3. **SDG Hub augmentation**: Generate synthetic agent trajectories from a small seed set

**Recommendation**: Don't wait for production traces. Generate 50-100 synthetic traces by running the RFE Creator skill with Claude on diverse inputs. Use these as the initial training dataset.

---

## Gap Summary

| Gap | Severity | Exists in Code? | Sprint to Address |
|-----|----------|-----------------|-------------------|
| Judge-to-DPO bridge | High | No | Sprint 2 |
| Trace-to-training-data pipeline | High | No | Sprint 2 |
| OpenCode CLI runner validation | Medium | Partially (cli runner exists) | Sprint 1 |
| EvalHub adapter runner flexibility | Medium | No (hardcodes ClaudeCodeRunner) | Sprint 2 |
| Tool-use-specific judges | Medium | Partial (tool_call_validation) | Sprint 2 |
| Agent trajectory format standard | Medium | No | Sprint 3+ |
| Process-level reward models | Low | No | Sprint 3+ |
| Safety evaluation pipeline | Medium | Partial (no_harmful_content) | Sprint 2 |
