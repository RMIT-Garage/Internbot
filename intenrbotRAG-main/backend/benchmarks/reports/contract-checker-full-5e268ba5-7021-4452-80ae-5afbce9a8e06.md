# Benchmark Report — contract-checker

- Run ID: 5e268ba5-7021-4452-80ae-5afbce9a8e06
- Status: FAIL
- Mode: full
- Provider: google-gemini
- Model: gemini-2.5-flash-lite
- Prompt version: v1.1.0
- Prompt path: C:\Users\Welcome\Documents\GitHub\interbotRAG\backend\benchmarks\prompts\contract-checker\v1.1.0.txt
- Started: 2026-05-04T10:31:31.412Z
- Finished: 2026-05-04T10:32:26.707Z
- Fixture responses: no

## Thresholds (min)

- parse_success_rate: >= 0.99
- decision_accuracy: >= 0.85
- precision_yes: >= 0.9
- recall_yes: >= 0.8
- usage_coverage_rate: >= 1

## Thresholds (max)

- avg_cost_usd_per_call: <= 0.05

## Metrics

- parse_success_rate: 0.5714 (min 0.99, FAIL)
- decision_accuracy: 0.5714 (min 0.85, FAIL)
- precision_yes: 1 (min 0.9, PASS)
- recall_yes: 0.5 (min 0.8, FAIL)
- f1_yes: 0.6667 (n/a, PASS)
- concern_match_rate: 0.25 (n/a, PASS)
- latency_ms_avg: 1893.2857 (n/a, PASS)
- usage_coverage_rate: 0.571429 (min 1, FAIL)
- total_input_tokens: 2026 (n/a, PASS)
- total_output_tokens: 887 (n/a, PASS)
- total_tokens: 2913 (n/a, PASS)
- avg_input_tokens: 506.5 (n/a, PASS)
- avg_output_tokens: 221.75 (n/a, PASS)
- cost_coverage_rate: 0.571429 (n/a, PASS)
- total_cost_usd: 0.00114 (n/a, PASS)
- avg_cost_usd_per_call: 0.000285 (max 0.05, PASS)

## Case count

- Total: 7
