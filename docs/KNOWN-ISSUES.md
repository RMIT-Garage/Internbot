# Known Issues

Open, reproducible defects observed on the deployed app (2026-06). Documented here for the next team; not yet fixed.

---

## Opportunities

### 1. Submitted (self-sourced) opportunities leak across semesters

**Observed:** A student's own submitted / self-sourced (`type: "custom"`) opportunities from a **previous** semester still appear in the current semester's list — the "submitted opportunities" view shows submissions that don't belong to the student's currently selected semester.

**Expected:** The submitted-opportunities view should be scoped to the student's currently selected / active `semesterId`.

**Likely area:**

- Backend list query — `backend/src/api/routes/opportunities.ts` (`parseListOpportunitiesQuery` + the list handler) and the opportunity query service. The filter for a student's own submitted opportunities appears not to constrain by the caller's active `semesterId`.
- Confirm the list query for `type=custom` / student-owned opportunities always ANDs a `semesterId == <active semester>` predicate (and that student-custom opportunities actually carry the semester they were submitted under).

### 2. Self-sourced opportunity shows "Placement Confirmed" instead of a "View" action

**Observed:** For self-sourced (`custom`) opportunities, the row/detail action renders **"Placement Confirmed"** and the opportunity **cannot be viewed** — instead of offering a **"View"** action.

**Expected:** A self-sourced opportunity that is not actually at a placement-confirmed state should offer a **"View"** action (and be viewable).

**Likely area:**

- Frontend opportunity action/label derivation in the student opportunity views (`frontend/src/app/...` opportunity list/detail). The action-button state machine is deriving a placement-confirmed label for `type: "custom"` opportunities rather than mapping to the correct action for the opportunity's real status.
- Cross-check against the coordinator "Placement Confirmed" step label in `frontend/src/app/coordinator/contracts/review/ContractReviewClient.tsx` to ensure the student opportunity view isn't reusing that state incorrectly.

**Note:** Both issues are in the **Internbot** app (the opportunities feature), not the interbotRAG service — interbotRAG only serves FAQ/job/contract-checker AI.
