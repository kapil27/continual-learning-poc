---
rfe_id: RFE-001
title: Automatic GPU scaling for model serving based on inference queue depth
priority: Major
size: L
status: Draft
parent_key: null
original_labels: null
---
## Summary
OpenShift AI model serving should automatically scale GPU replica counts in response to inference queue depth, eliminating the need for manual scaling decisions and reducing both wasted GPU capacity during low traffic and latency degradation during traffic spikes.

## Problem Statement
Today, data scientists and platform operators managing GPU-accelerated model serving on OpenShift AI must manually adjust the number of serving replica pods when inference traffic changes. During traffic spikes, under-provisioned replicas cause increased inference latency and degraded user experience. During low traffic periods, over-provisioned replicas waste expensive GPU resources. There is no built-in mechanism to observe inference queue depth and automatically adjust replica counts to match demand.

## Affected Customers
OpenShift AI customers running GPU-accelerated model serving workloads, including enterprises deploying large language models and real-time inference endpoints. This impacts any customer whose serving traffic is variable or unpredictable — a common pattern for production ML serving.

## Business Justification
GPU resources represent the highest cost component of model serving infrastructure. Manual scaling leads to either wasted GPU spend (over-provisioning by 40-80% during off-peak) or degraded service-level performance (increased inference latency during peaks). Automatic scaling based on queue depth directly addresses both cost optimization and service quality — two primary purchasing and retention drivers for enterprise AI platform customers.

## User Scenarios
1. As a platform operator managing serving infrastructure for multiple teams, I need GPU-backed serving pods to scale up automatically when inference requests begin queuing, so that I don't have to monitor metrics dashboards and manually scale during traffic surges.
2. As a data scientist deploying a model endpoint, I need my serving to scale down to minimal replicas during off-peak hours, so that I'm not burning GPU resources during periods when no inference traffic is arriving.
3. As an MLOps engineer responsible for meeting inference latency SLAs, I need the system to add serving replicas proactively based on queue depth trends, so that latency stays within target thresholds even during rapid traffic increases.

## Acceptance Criteria
- [ ] Serving can automatically increase GPU replica count when the inference queue depth exceeds a user-configurable threshold
- [ ] Serving can automatically decrease GPU replica count when the inference queue depth remains below a user-configurable threshold for a sustained period
- [ ] Users can configure scale-up and scale-down thresholds independently per serving deployment
- [ ] Users can set a cooldown period to prevent rapid oscillation between scale-up and scale-down actions
- [ ] Users can set minimum and maximum replica bounds to control the scaling window
- [ ] Scaling decisions are observable through existing monitoring and logging channels
- [ ] Scale-down respects existing in-flight inference requests, draining pods only after they complete

## Success Criteria
- Platform operators report reduced manual intervention for serving scaling operations
- GPU utilization improves during low-traffic periods without measurable latency degradation during peaks
- Inference latency remains within configured SLA targets across variable traffic patterns

## Scope
### In Scope
- Automatic replica scaling for GPU-accelerated model serving based on inference queue depth
- User-configurable thresholds, cooldowns, and replica bounds
- Observability of scaling decisions

### Out of Scope
- CPU-based serving autoscaling (separate need)
- Predictive scaling based on traffic forecasts or historical patterns
- Cross-cluster or multi-region serving scaling
- Integration with external autoscaling systems (e.g., KEDA custom metrics beyond queue depth)

## Open Questions
- How should queue depth be measured and exposed for serving runtimes that don't natively report it?
- What is the acceptable trade-off between scale-up aggressiveness (faster response vs. over-provisioning risk)?
