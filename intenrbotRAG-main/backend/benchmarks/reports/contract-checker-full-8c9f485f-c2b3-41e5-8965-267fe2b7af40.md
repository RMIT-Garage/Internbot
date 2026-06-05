# Benchmark Report — contract-checker

- Run ID: 8c9f485f-c2b3-41e5-8965-267fe2b7af40
- Status: FAIL
- Mode: full
- Provider: google-gemini
- Model: gemini-2.0-flash-lite
- Prompt version: v1.0.0
- Prompt path: /Users/shinya/Documents/GitHub/interbotRAG/backend/benchmarks/prompts/contract-checker/v1.0.0.txt
- Started: 2026-04-16T07:48:57.163Z
- Finished: 2026-04-16T07:49:59.832Z
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

- parse_success_rate: 0 (min 0.99, FAIL)
- decision_accuracy: 0 (min 0.85, FAIL)
- precision_yes: 0 (min 0.9, FAIL)
- recall_yes: 0 (min 0.8, FAIL)
- f1_yes: 0 (n/a, PASS)
- concern_match_rate: 0 (n/a, PASS)
- latency_ms_avg: 62660 (n/a, PASS)
- usage_coverage_rate: 0 (min 1, FAIL)
- total_input_tokens: 0 (n/a, PASS)
- total_output_tokens: 0 (n/a, PASS)
- total_tokens: 0 (n/a, PASS)
- avg_input_tokens: 0 (n/a, PASS)
- avg_output_tokens: 0 (n/a, PASS)
- cost_coverage_rate: 0 (n/a, PASS)
- total_cost_usd: 0 (n/a, PASS)
- avg_cost_usd_per_call: 0 (max 0.05, PASS)

## Case count

- Total: 1
