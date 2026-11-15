# Implementation plan: Frontend redesign fixes (live-check findings)

**Spec:** [docs/superpowers/specs/2026-11-08-focusflow-frontend-redesign-design.md](../specs/2026-11-08-focusflow-frontend-redesign-design.md) (product rules win). Visual ground truth: `docs/design/DESIGN.md`, `tokens.css`, `PROTOTYPE-NOTES.md`; look reference: `docs/design/prototype/` (local).
**Predecessor plan:** [2026-11-08-focusflow-frontend-redesign-plan.md](2026-11-08-focusflow-frontend-redesign-plan.md)
**Created:** 2026-11-15
**Goal scope:** bring the finished redesign (branch `features/frontend-redesign`) in line with the spec and prototype, based on the 2026-11-15 live browser check against the real backend.

## Summary

Fixes 6 functional bugs, spec-rule gaps and visual drift found in the live check, grouped **by screen/area** so each subtask is one coherent outcome (bug fixes first inside each). Out of scope: new features, backend scheduling changes (Generate has no current time, so late-day work lands in the past), anything not seen in the live check.

## Open decisions (confirm before the dependent subtask)

| # | Decision | Dependent | Proposed default |
|---|----------|-----------|------------------|
| D1 | Out-of-window commitment: spec says "rejected", backend spec says "stored, ignored" (Dentist 15:00 saved in a 03:00–10:00 window) | T6 | UI rejects inline; backend unchanged |
| D2 | Seconds in `cutoff`: backend truncates, or returns 400 | T1 | 400 (never 500); frontend always sends `HH:mm:00` |
| D3 | Backend validation messages follow `Accept-Language` (got `不得空白`) | T9 | Pin message locale to English |
| D4 | Prototype date styles ("Friday, 6 November", Today/Tomorrow) vs spec rule 3 (`6 Nov 2026`) | T8 | Spec wins; only change if you say otherwise |

## Discovery notes

- Reuse: `minuteAlignedTimeString()` (`features/horizon/hooks.ts`), `lib/planningDate.ts`, `lib/format.ts`, shadcn `Badge`/`Popover` for ⓘ, `ApiError.details` handling in `SettingsForm.tsx`, `WorkSessions`/`workSessionsModel`.
- Constraints: TanStack Query hooks per feature; react-hook-form + zod; English-only formatting (rule 3); one solid button per view (rule 13).
- Patterns: tests colocated; logic in pure model files (`railModel.ts`, `planActionRules.ts`, `horizonGrid.ts`), components stay thin.
- Anti-goals: no drive-by refactors, no new dependencies.

## File map

| Subtask | Path | Create/Modify | Responsibility | Verified/Provisional |
|---------|------|---------------|----------------|---------------------|
| T1 | `frontend/src/lib/planningDate.ts` | modify | `getLocalMinuteString(now?)` → `HH:mm:00` | verified |
| T1 | `frontend/src/features/plans/planActionRules.ts`, `OutcomeDialog.tsx` | modify | minute-aligned `cutoff` | verified |
| T1 | `backend/.../plan/dto/ReplanRequest.java`, `DailyPlanService.java`, `BlockProgressService.java`, `docs/api.md` | modify | 400 on non-aligned `cutoff` | verified |
| T2 | `routes/TasksPage.tsx` | modify | `key` the editor sheet; 400px sheet | verified |
| T2 | `features/tasks/{TaskRow,StatusBadge,PriorityBadge,TaskEditorSheet}.tsx` | modify | priority fill, glyph outline badges, forecast badges, sheet title style | verified |
| T3 | `features/horizon/{HorizonGridView,HorizonPage}.tsx`, `horizonGrid.ts` | modify | column layout, On track badge, English dates, ⓘ, ochre shortfall | verified |
| T4 | `features/plans/{hooks.ts,PlanDeleteButton,PlanHistoryList,PlanRevisionSwitch}.tsx`, `routes/{PlanHistoryPage,PlanDetailPage}.tsx` | modify | delete 409 message, Shortfall badge, date copy, non-solid delete, Read-only badge | verified |
| T5 | `features/preferences/{SettingsForm,settingsModel,MiniRail,typicalDay}.ts(x)`, `components/form/TimeField.tsx` | modify | label rule, error display, stepping, layout, preview | verified |
| T6 | `routes/TodayPage.tsx`, `features/commitments/CommitmentsPanel.tsx`, `features/plans/{railModel.ts,DayRail,AgendaList,OutcomeDialog}.tsx` | modify | past-day read-only, mobile fit, rail polish, outcome clarity, commitment messages | verified |
| T6 | `features/plans/PastDaySessions.tsx` | create | Work sessions groups on a past day | provisional |
| T7 | `routes/TodayPage.tsx`, `features/plans/{PlanHealth,PlanSideCards}.tsx` | modify | Tasks card, plan-less rail, Peak chip, ⓘ | verified |
| T8 | `components/layout/AppShell.tsx`, `index.css`, `components/ui/alert-dialog.tsx`, `routes/{Login,Register}Page.tsx` | modify | shell width/nav/footer, scrim, dialog and auth styling | verified |
| T9 | backend locale config | modify | fixed English message locale | provisional (locate in planning) |

### Blast radius

| Path | Why sensitive | Must stay intact |
|------|---------------|------------------|
| Backend `ReplanRequest` / `BlockProgressService` | API contract in `docs/api.md` | minute-aligned requests keep 200; 409 `PLAN_CHANGED`/`PROGRESS_CONFLICT` unchanged |
| `components/ui/alert-dialog.tsx`, `AppShell`, `lib/format.ts` | used on every screen | focus trap, Esc, focus return, drawer, English-only formatting |
| `TodayPage.tsx` | touched by T6 and T7 | Regenerate-vs-Re-plan rule, no default outcome, no Plan health without a plan |

## Workflow (for implementers)

1. **writing-plans** produced this file (type-1).
2. Per subtask: Plan mode + **planning-subtasks** when **Plan mode** is `high` (or `medium` with a real remaining unknown).
3. Implementation: **test-driven-development** when `TDD suitable: yes` (or the testable slice of `partial`); otherwise run **Verification**.
4. Equivalent changes: log and continue. Material changes (including answers to D1–D4 that change scope): pause, update this file, confirm.

Order: T1 → T2 → T3 → T4 → T5 (independent, any order) → T6 → T7 → T8 → T9 → T10. Run the frontend tests and `npm run build` after each.

## Subtasks

### T1 — Re-plan cutoff, end to end

- [ ] **Do:** Re-plan and reconcile saves send `cutoff` as `HH:mm:00`; the backend rejects a non-minute-aligned `cutoff` with 400 (D2) instead of a 500.
- **Consumes:** none
- **Produces:** `getLocalMinuteString(date?: Date): string`; 400 `Validation failed` with `details.cutoff`; updated replan contract in `docs/api.md` (~L1031–1057).
- **Acceptance:** `buildReplanRequest` at 04:24:05 gives `cutoff === '04:24:00'`; reconcile PUT `cutoff` ends `:00`; non-crossing saves still send `null`; backend `"04:24:05"` → 400, `"04:24:00"` → 200; 409 responses unchanged. Live: Re-plan after recording the elapsed block returns 200 and writes a new revision.
- **Blocked by:** D2
- **Plan mode:** medium (named unknown: DTO vs service validation placement)
- **TDD suitable:** yes
- **Verification:** `npm test -- planActionRules OutcomeDialog planningDate`; `cd backend; .\gradlew.bat test --tests "*Replan*"`; live re-plan.

### T2 — Tasks page: blank editor fix and fidelity

- [ ] **Do:** Edit opens with the task's values (key the sheet by task id); the task list and editor match the prototype: priority flag fill level, outline glyph + word badges (At risk ochre, Overdue, On track, Beyond horizon, Can't forecast), Waiting-on line, row hairlines, search icon, deadline legend ⓘ, 400px sheet.
- **Acceptance:** Edit on "Write Q4 report draft" shows title, description, HIGH, 120m, due 15 Nov; New task after Edit is empty; dirty-close guard works; save keeps existing values; no filled-pill badges; sheet is 400px.
- **Blocked by:** —
- **Plan mode:** medium (named unknown: what the tasks API exposes for the forecast badge; may need `/api/horizon`)
- **TDD suitable:** partial — blank-editor regression and badge mapping test-first; styling verified live.
- **Verification:** `npm test -- TasksPage TaskEditorSheet TaskRow StatusBadge PriorityBadge`; live Edit and compare to prototype Tasks.

### T3 — Horizon: layout, badges, copy

- [ ] **Do:** Day columns are bounded (no `min-w-max`), cell text wraps; On track badge; English dates and minute-only time in the header ("from 15 Nov 2026 at 04:24"), "Due 15 Nov 2026"; pace assumption and deadline legend behind ⓘ popovers; shortfall in ochre.
- **Consumes:** `deadlineBadgeLabel`, `DEADLINE_GLYPHS`
- **Produces:** `ON_TRACK` entry; updated `horizonGrid.test.ts` (currently asserts `null`).
- **Acceptance:** with 8 days at 1,088px, scroll width ≤ ~1.3× viewport (all days visible at ≥1280px); no clipped text; all five deadline statuses show glyph + word; no ISO dates or seconds; ⓘ keyboard operable; request still sends `currentDate` + minute-aligned `currentTime`.
- **Blocked by:** —
- **Plan mode:** skip
- **TDD suitable:** partial — label/format helpers test-first; layout and popover look verified live.
- **Verification:** `npm test -- horizon`; live `scrollWidth` measure and prototype comparison.

### T4 — Plans: delete refusal and history/detail fidelity

- [ ] **Do:** Deleting a plan with progress (409 `PLAN_HAS_PROGRESS`) shows a message; history shows a Shortfall badge when there is a shortfall; delete dialog uses "15 Nov 2026"; Delete plan is outline/destructive-text, not solid; Read-only badge on historical revisions and past plans; h1 matches prototype heading.
- **Produces:** `onError` in `useDeletePlan`.
- **Acceptance:** delete on 15 Nov shows why it was refused and leaves the row; 15 Nov (40h 5m shortfall) shows Shortfall; one solid button per view; Rev 1 shows Read-only.
- **Blocked by:** —
- **Plan mode:** skip
- **TDD suitable:** partial — error handling and badge logic test-first; styling live.
- **Verification:** `npm test -- PlanHistoryList PlanDetail hooks`; live.

### T5 — Settings: errors and fidelity

- [ ] **Do:** Require a fixed-break label (inline "Label is required" before any request) and render server `details` on fixed-break fields; time fields mono with ArrowUp/Down ±5 min (Shift ±60); on-blur time message; carded sections; numerics mono right-aligned with "min"; Mon–Sun chips; "Defaults apply until saved" as info alert; help copy to ⓘ; Cancel button; preview adds Preview badge, Focus per day / Sessions stats, Peak marker, trailing buffer.
- **Consumes:** `TimeField`, `MiniRail`, `typicalDay.ts`
- **Acceptance:** empty label shows the error and sends nothing; a server `fixedBreaks[0].label` detail appears on that field; ArrowUp on 10:00 → 10:05, Shift+ArrowUp → 11:00, clamped to 23:55/00:00; Cancel resets to saved values; saves still send `HH:mm:00`.
- **Blocked by:** —
- **Plan mode:** medium (named unknowns: RHF field-name mapping for `details` keys; whether stats/peak derive from `typicalDay.ts`)
- **TDD suitable:** partial — validation, error mapping, stepping, stats test-first; layout live.
- **Verification:** `npm test -- SettingsForm TimeField typicalDay MiniRail`; live.

### T6 — Today behavior: past day, mobile fit, rail polish, outcomes

- [ ] **Do:**
  1. Past day: › enabled, "Back to today", Commitments add/edit/delete and Record outcome disabled, Work sessions grouped Recorded / Not recorded / No longer needed.
  2. Mobile: no horizontal scroll at 390px; outcome labels not cut off.
  3. Rail: no stray `·` in header meta; 5m/10m blocks keep a min height with readable text; now-line does not strike through text.
  4. Record outcome: reason line when Save is disabled by effort exhaustion; reconcile variant shows Remaining effort before an outcome is picked.
  5. Commitments: plain-English overlap message; out-of-window handled per D1.
- **Consumes:** `WorkSessions`, `workSessionsModel`, `railModel.ts`, T1's `getLocalMinuteString`
- **Produces:** `readOnly` prop on `CommitmentsPanel`, `DayRail`, `AgendaList`; `PastDaySessions`.
- **Acceptance:** on 14 Nov: › → 15 Nov, Back to today works, no add/edit/delete, blocks open nothing, groups render; upcoming days unchanged. At 390px `scrollWidth === clientWidth`. Header never ends in a separator. 5m and 10m blocks legible in both densities. Done with 5m on a 5m-remaining task shows the reason; ticking Finish clears it; reconcile opens showing 120m. Overlap shows "That time overlaps another commitment."; out-of-window blocked per D1.
- **Blocked by:** T1, D1
- **Plan mode:** high (five behaviors in `TodayPage`; unknown: whether `DayRail` already has a read-only path used by Plan detail)
- **TDD suitable:** partial — read-only rules, min-height math, dialog reason, message mapping test-first; mobile fit and clipping verified live.
- **Verification:** `npm test -- TodayPage DayRail AgendaList railModel CommitmentsPanel OutcomeDialog`; live 14 Nov view and 390px phone emulation.

### T7 — Today structure vs prototype

- [ ] **Do:** compact Tasks card in the side column; no-plan state keeps the rail (gutter, Peak wash, fixed breaks, commitments, buffer, now-line) with Generate inside it; Peak chip right of the Day rail title; block-kind, outcome and Peak explanations behind ⓘ; Plan health rows flattened (no nested box, normal icons, Needs refresh as a row with ⓘ copy).
- **Consumes:** `buildRail`, `PlanSideCards`, `PlanHealth`, T6 `readOnly`
- **Acceptance:** matches prototype Today in both states at 1440px (side-by-side screenshots); Plan health still absent with no plan (rule 5); Regenerate/Re-plan rules untouched.
- **Blocked by:** T6
- **Plan mode:** high (empty rail needs a plan-less `buildRail` source from preferences + commitments)
- **TDD suitable:** partial — plan-less rail model test-first; look verified against prototype.
- **Verification:** `npm test -- railModel PlanHealth TodayPage`; live screenshot comparison.

### T8 — App shell, dialogs, auth

- [ ] **Do:** content max-width per prototype `.page`; nav 14px/500 idle, 14/600 active with prototype icons; footer order (Dark theme, user, Working day); non-working day wording; scrim ink 36% without blur on alert-dialog/sheet; Outcome dialog title Inter 16/600, mono stats, no native number spinner, Skipped/Partly glyphs per DESIGN; auth error alert gets a glyph and labels do not turn red. Date styles follow D4.
- **Blocked by:** T6 (Outcome dialog edits), D4
- **Plan mode:** high (global shell and shared dialog)
- **TDD suitable:** no — token/style changes; focus trap, Esc and focus return guarded by existing tests.
- **Verification:** `npm test`; `npm run build`; live screenshots of all five screens against the prototype.

### T9 — Backend messages are English

- [ ] **Do:** Validation messages no longer follow `Accept-Language` (D3).
- **Acceptance:** blank-label request with `Accept-Language: zh-TW` returns the English message; no other 400 body regresses.
- **Blocked by:** D3
- **Plan mode:** medium (named unknown: where the locale is resolved, `LocaleResolver` vs `MessageSource`)
- **TDD suitable:** yes
- **Verification:** `.\gradlew.bat test`; replay the empty-label PUT with `Accept-Language: zh-TW`.

### T10 — Live re-verification

- [ ] **Do:** repeat the 2026-11-15 live check on a fresh account; add anything new to the changelog.
- **Acceptance:** none of the six functional bugs reproduce; Re-plan 200; Edit prefilled; Horizon fits; delete refusal visible; mobile no overflow; past day read-only.
- **Blocked by:** T1–T9
- **Plan mode:** skip
- **TDD suitable:** no — end-to-end manual check.
- **Verification:** Docker `focusflow-postgres` up, backend `:8080`, Vite `:5173`. Browser tool caveat: the first click after navigation may drop in a hidden tab, so screenshot first or click via `evaluate`.

## TDD note (implementation)

Per subtask, obey **`TDD suitable`**: `yes` means strict **test-driven-development**; `partial` applies it only to the testable slice; `no` means do not force test-first but satisfy **Verification**. Layout-only work is verified live, not asserted in jsdom.

## Plan changelog

| Date | Change | Kind |
|------|--------|------|
| 2026-11-15 | Initial plan from the live browser check (18 subtasks; findings are in the conversation, no separate report file) | — |
| 2026-11-15 | Merged 18 subtasks into 10 by screen/area: T1+T2→T1; T3+T15→T2; T4+T11→T3; T5(a)+T12→T4; T5(b)+T14→T5; T5(c)+T6+T7+T8+T9→T6; T13→T7; T16+T17→T8; T10→T9; T18→T10. Added D4. Acceptance criteria preserved | material (user-requested restructure) |
