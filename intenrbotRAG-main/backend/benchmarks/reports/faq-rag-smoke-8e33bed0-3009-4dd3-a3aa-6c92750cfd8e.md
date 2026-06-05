# Benchmark Report — faq-rag

- Run ID: 8e33bed0-3009-4dd3-a3aa-6c92750cfd8e
- Status: FAIL
- Mode: smoke
- Provider: fixture-provider
- Model: gemini-2.0-flash-lite
- Prompt version: v1.0.0
- Prompt path: /Users/shinya/Documents/GitHub/interbotRAG/backend/benchmarks/prompts/faq-rag/v1.0.0.txt
- Started: 2026-04-16T08:11:07.171Z
- Finished: 2026-04-16T08:11:07.175Z
- Fixture responses: yes

## Thresholds (min)

- parse_success_rate: >= 1
- answered_from_context_accuracy: >= 0.8
- refusal_rate_unanswerable: >= 0.8
- citation_presence_rate: >= 0.8
- usage_coverage_rate: >= 0

## Thresholds (max)

- none

## Metrics

- parse_success_rate: 1 (min 1, PASS)
- answered_from_context_accuracy: 1 (min 0.8, PASS)
- refusal_rate_unanswerable: 0 (min 0.8, FAIL)
- citation_presence_rate: 1 (min 0.8, PASS)
- citation_support_rate: 1 (n/a, PASS)
- usage_coverage_rate: 0 (min 0, PASS)
- total_input_tokens: 0 (n/a, PASS)
- total_output_tokens: 0 (n/a, PASS)
- total_tokens: 0 (n/a, PASS)
- avg_input_tokens: 0 (n/a, PASS)
- avg_output_tokens: 0 (n/a, PASS)
- cost_coverage_rate: 0 (n/a, PASS)
- total_cost_usd: 0 (n/a, PASS)
- avg_cost_usd_per_call: 0 (n/a, PASS)

## Case count

- Total: 1
