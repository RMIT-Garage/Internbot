# Benchmark Report — contract-checker

- Run ID: 26ce9395-722c-4ccb-81a7-1f6ad897f1ec
- Status: FAIL
- Mode: full
- Provider: google-gemini
- Model: gemini-2.5-flash-lite
- Prompt version: v1.1.0
- Prompt path: C:\Users\Welcome\Documents\GitHub\interbotRAG\backend\benchmarks\prompts\contract-checker\v1.1.0.txt
- Started: 2026-05-04T10:27:02.964Z
- Finished: 2026-05-04T10:27:13.795Z
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

- parse_success_rate: 1 (min 0.99, PASS)
- decision_accuracy: 0.8571 (min 0.85, PASS)
- precision_yes: 1 (min 0.9, PASS)
- recall_yes: 0.5 (min 0.8, FAIL)
- f1_yes: 0.6667 (n/a, PASS)
- concern_match_rate: 0.1429 (n/a, PASS)
- latency_ms_avg: 1546.4286 (n/a, PASS)
- usage_coverage_rate: 1 (min 1, PASS)
- total_input_tokens: 3561 (n/a, PASS)
- total_output_tokens: 1486 (n/a, PASS)
- total_tokens: 5047 (n/a, PASS)
- avg_input_tokens: 508.714286 (n/a, PASS)
- avg_output_tokens: 212.285714 (n/a, PASS)
- cost_coverage_rate: 1 (n/a, PASS)
- total_cost_usd: 0.00196 (n/a, PASS)
- avg_cost_usd_per_call: 0.00028 (max 0.05, PASS)

## Case count

- Total: 7
