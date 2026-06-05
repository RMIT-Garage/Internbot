# Benchmark Report — job-checker

- Run ID: cc6890b6-aa12-4522-8c5c-c566de3a92b0
- Status: FAIL
- Mode: full
- Provider: google-gemini
- Model: gemini-2.5-flash-lite
- Prompt version: v1.1.0
- Prompt path: C:\Users\Welcome\Documents\GitHub\interbotRAG\backend\benchmarks\prompts\job-checker\v1.1.0.txt
- Started: 2026-05-04T10:32:26.710Z
- Finished: 2026-05-04T10:33:13.175Z
- Fixture responses: no

## Thresholds (min)

- parse_success_rate: >= 0.99
- decision_accuracy: >= 0.85
- precision_yes: >= 0.88
- recall_yes: >= 0.85
- usage_coverage_rate: >= 1

## Thresholds (max)

- avg_cost_usd_per_call: <= 0.03

## Metrics

- parse_success_rate: 0.1429 (min 0.99, FAIL)
- decision_accuracy: 0.1429 (min 0.85, FAIL)
- precision_yes: 0 (min 0.88, FAIL)
- recall_yes: 0 (min 0.85, FAIL)
- f1_yes: 0 (n/a, PASS)
- concern_match_rate: 0 (n/a, PASS)
- latency_ms_avg: 629.7143 (n/a, PASS)
- usage_coverage_rate: 0.142857 (min 1, FAIL)
- total_input_tokens: 466 (n/a, PASS)
- total_output_tokens: 352 (n/a, PASS)
- total_tokens: 818 (n/a, PASS)
- avg_input_tokens: 466 (n/a, PASS)
- avg_output_tokens: 352 (n/a, PASS)
- cost_coverage_rate: 0.142857 (n/a, PASS)
- total_cost_usd: 0.000351 (n/a, PASS)
- avg_cost_usd_per_call: 0.000351 (max 0.03, PASS)

## Case count

- Total: 7
