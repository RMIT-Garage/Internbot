# Internbot Checker Foundation

This document gives a practical baseline for the two decisioning features:

- `contract-checker`
- `job-checker`

It is built from authoritative AU employment/WIL sources plus a starter sample set you can benchmark against.

## 1) Why this foundation exists

Checker features should be rule-driven and auditable, not open-ended chat.

For each decision, we want:

- deterministic Yes/No
- explicit failed rules
- concise concerns
- evidence traceability to policy/legal sources

## 2) Source-of-truth references (online)

Use these as the canonical basis for rules and coordinator review.

- Fair Work Commission, vocational placements and volunteers  
  <https://www.fwc.gov.au/vocational-placements-volunteers>
- Fair Work Act dictionary (incl. vocational placement definition context)  
  <https://classic.austlii.edu.au/au/legis/cth/consol_act/fwa2009114/s12.html>
- Fair Work Act notice-of-termination provision (s117)  
  <https://www5.austlii.edu.au/au/legis/cth/num_act/fwa2009114/s117.html>
- RMIT internship guidelines (WIL agreement, supervision, safety, unpaid-hours context)  
  <https://www.rmit.edu.au/about/schools-colleges/design/industry/internships/internship-guidelines>
- ANZSCO software/app programmer occupation reference (job-task grounding)  
  <https://abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2022/browse-classification/2/26/261/2613>

## 3) Contract checker baseline rules

Keep these aligned with your existing prompt (`backend/benchmarks/prompts/contract-checker/v1.0.0.txt`).

- `RULE_1_AWARD_CLASSIFICATION`: IT/engineering-aligned classification (reject unrelated awards)
- `RULE_2_MINIMUM_HOURS`: sufficient explicit placement hours (or equivalent clear duration)
- `RULE_3_NAMED_SUPERVISOR`: named supervisor + contact
- `RULE_4_IDENTITY_MATCH`: student/employer identity consistency with submission
- `RULE_5_SUBSTANTIVE_TECHNICAL_WORK`: technical internship tasks, not mainly admin/sales
- `RULE_6_CONTRACT_VALIDITY`: signed and date-valid contract

## 4) Job checker baseline rules

Keep these aligned with your existing prompt (`backend/benchmarks/prompts/job-checker/v1.0.0.txt`).

- `RULE_1_TECHNICAL_ALIGNMENT`: role duties align to computing/engineering outcomes
- `RULE_2_MIN_DURATION_OR_HOURS`: duration/hours are plausible for internship outcomes
- `RULE_3_SUPERVISION_STRUCTURE`: qualified/appropriate direct supervision exists
- `RULE_4_PAID_OR_FORMAL_STRUCTURE`: formal arrangement (paid or compliant WIL form)
- `RULE_5_LEGITIMATE_EMPLOYER`: identifiable employer and credible role context

## 5) Starter sample packs

Use these curated seed cases as a first benchmark foundation:

- `docs/samples/contract-checker-cases-v1.json`
- `docs/samples/job-checker-cases-v1.json`

They are intentionally mixed:

- clear pass
- clear fail
- ambiguous/borderline fail-safe

## 6) Recommended review workflow

1. Coordinator + AI owner review each rule wording.
2. Expand sample cases with real historical edge cases (de-identified).
3. Run smoke benchmarks and inspect false positives first.
4. Tighten concerns text for actionable coordinator follow-up.
5. Version prompts and datasets together.

## 7) Governance note

Treat this as a living policy artifact:

- update when Fair Work/RMIT guidance changes
- log rule changes and why
- keep benchmark reports as evidence for model decisions
