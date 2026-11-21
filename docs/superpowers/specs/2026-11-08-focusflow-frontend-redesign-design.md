# FocusFlow Frontend Redesign Design

Date: 2026-11-08

**Status:** Direction approved; rebuild not yet implemented.
**Supersedes:** [`2026-05-31-focusflow-frontend-ui-design.md`](2026-05-31-focusflow-frontend-ui-design.md) for all visual, interaction, and navigation decisions.
**Related product spec:** [`2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md`](2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md)
**Product language:** [`CONTEXT.md`](../../../CONTEXT.md)
**API contract:** [`docs/openapi.yaml`](../../openapi.yaml)

## Purpose

The current React app grew milestone by milestone. Its feature boundaries and
tests are sound, but its visual language, information architecture, form layer,
and several product behaviours no longer match the settled product rules.

This spec is the frontend ground truth for the rebuild. It replaces the May 2026
UI design, defines the design system and every screen, and fixes the behaviours
the rebuild must implement. It does not change backend scope or the API contract.

## Ground Truth

The binding design contract lives in [`docs/design/`](../../design/README.md):

| Artefact | Role |
|---|---|
| [`DESIGN.md`](../../design/DESIGN.md) | Direction, colour, type, spacing, component rules, semantic state table, motion, voice, anti-patterns |
| [`tokens.css`](../../design/tokens.css) | Light and dark tokens plus the Tailwind v4 bridge |
| [`implementation-handoff.md`](../../design/implementation-handoff.md) | Binding constraints for the React build |
| [`PROTOTYPE-NOTES.md`](../../design/PROTOTYPE-NOTES.md) | Screen map, reachable states, mock behaviour, deviations |
| Clickable prototype | Local OpenDesign reference; kept in `docs/design/prototype/`, gitignored, not production code |

Only the contract files are committed. The generated prototype is a local
reference and is not versioned.

When the prototype and `DESIGN.md` disagree, `DESIGN.md` wins. When this spec
and the prototype disagree on a product rule, this spec wins.

## Goals And Non-Goals

Goals:

- Replace the indigo/shadcn-default look with the approved **"Paper & Ink,
  instrument-grade"** direction.
- Replace the dashboard-centred information architecture with **Today, Tasks,
  Horizon, Plans, Settings**, and make the day rail the product's signature.
- Apply the settled product rules to the UI: regeneration versus re-planning,
  explicit outcomes, work-session history, plan health, cadence, and dependency
  states.
- Establish implementation constraints that prevent the old problems from
  returning: generated API types, one form layer, strict TypeScript, central
  query keys, accessible native-feeling controls, and frontend CI.

Non-Goals:

- No backend, scheduler, effort, or dependency rule changes.
- No new product features beyond what the 1.4.0 spec already defines.
- No drag-to-reschedule, recurring tasks, subtasks, analytics, or onboarding.
- No visual regression tooling in the first rebuild milestone.

## Design Direction

**Paper & Ink, instrument-grade.** A carefully set page in a good day planner
that happens to keep exact time.

- **Paper and ink.** Warm paper surfaces, ink text, 1px hairline rules, one deep
  ink-blue accent. Structure comes from borders and alignment, never shadows.
- **Instrument-grade.** Tabular numerals everywhere, mono for clock times and
  durations, compact density where it helps, visible focus rings, and a dark
  theme designed on its own terms.
- **Daylight is the only warm hue.** Amber appears only on the live now-line and
  the Peak window wash/marker. Every other colour is semantic.
- **The rail is the brand.** The vertical day rail is the most polished surface
  and the logo motif.

Principles:

- Clarity over decoration. One obvious primary action per view.
- Every state is legible without colour: each owns a shape, pattern, glyph, or
  word.
- Numbers are plain and honest. No percentages for effort, no streaks, no praise.
- Short labels on screen; explanations live behind an ⓘ popover.

The full palette, type scale, spacing, component rules, and anti-patterns are in
[`DESIGN.md`](../../design/DESIGN.md). The token names and values are in
[`tokens.css`](../../design/tokens.css).

## Visual Language

- **Colour:** tokens only. No raw hex in components. Amber is reserved for
  `--now`, `--peak`, and `--peak-edge`. Semantic families: moss (done/on track),
  ochre (partly/at risk/medium), brick (overdue/high), terracotta (commitments),
  neutral (skipped/unknown/low/open/cancelled).
- **Type:** Newsreader for page titles and dates; Inter for UI; JetBrains Mono
  for clock times and durations. Closed scale 12/13/14/16/20/28/36. Weights
  400/500/600. Tabular numerals on the root.
- **Shape:** 6px controls, 8px cards, 1px borders. Shadows only on popover,
  tooltip, dialog, and sheet.
- **Spacing:** 4px base; 4/8/12/16/20/24/32/40/48. Comfortable by default;
  compact for Tasks and Horizon, optional on the rail.
- **Motion:** 150–200ms fades and slides; no bounce. The now-line moves in real
  time via `transform` only. Honour `prefers-reduced-motion`.
- **Icons:** one 16px Lucide outline family, 1.5px stroke. Priority is a flag
  with empty / half / full fill, not just colour.
- **Theming:** light and dark have equal weight. The choice is persisted and
  applied before first paint to avoid a flash.

## Information Architecture

Authenticated shell: a 224px left sidebar with **Today, Tasks, Horizon, Plans,
Settings**, a footer with the Working day and Work window, a theme toggle, and a
user menu. The desktop sidebar can collapse. Below 768px it becomes a top bar
with a drawer.

Public routes use a centred auth card with the wordmark, no sidebar.

### Routes

| Route | Screen |
|---|---|
| `/` | Redirect to `/today` when authenticated, `/login` when not |
| `/login`, `/register` | Sign in / Create account (prototype aliases `#/signin`, `#/signup`) |
| `/today` | Today; the Planning date is URL-backed (`?date=YYYY-MM-DD`) |
| `/tasks` | Task inventory |
| `/horizon` | Seven Working-day forecast |
| `/plans` | Plan history |
| `/plans/:id` | Plan detail |
| `/settings` | Scheduling preferences |
| `*` | 404 |

`/dashboard` redirects to `/today?date=…` for compatibility with existing links.
The prototype's `#/plans/today` is represented in production by the plan for the
current date; `#/plans/:id` maps to `/plans/:id`.

## Screens

### Sign in / Create account

- Centred card on paper, wordmark, title, short description, fields, full-width
  primary submit, link to the other route, theme toggle.
- Real `<form>` elements. Enter submits. Field errors are inline; API errors
  (invalid credentials, duplicate account) render as an alert at the top.
- Busy state disables submit and shows a spinner. Passwords use the correct
  `autocomplete` values.

### Today

Desktop layout: sidebar → rail (hero) → side column.

- **Header:** eyebrow "Daily plan", date in Newsreader, meta line (Work window ·
  Trailing buffer · Re-planned time), Comfortable/Compact switch, the plan
  actions, and previous/next day.
- **Stats strip:** Planned focus · Done · Left today · Shortfall. Mono values,
  hairline dividers.
- **Rail:** 09:00–18:00 by default, driven by the plan snapshot. Hour rules,
  dotted half-hours, Peak wash with a gutter marker, the live now-line with a
  time pill. Blocks: Work, Cadence break, Fixed break, Commitment, Trailing
  buffer. Work blocks show the task title, time range, session index, and
  outcome; short blocks collapse to one line. Every block is focusable and
  announces kind, task/title, time, and outcome. Clicking a recordable work
  block opens Record outcome.
- **Side column:** Plan health (Shortfall, Needs refresh, Blocked work, Unplaced
  work), Commitments for the day with inline add/edit/delete, and a compact
  Tasks list linking to the inventory.
- **Day states:** No plan yet (empty rail plus Generate); plan with progress
  (Re-plan only); Needs refresh (alert plus Re-plan); past day (read-only, with
  a Back to today action). The Plan health panel is absent when there is no
  Daily plan.
- **Mobile:** the rail becomes a time-grouped agenda with a sticky date header
  and the same block actions. No horizontal scroll.

### Tasks

- Filter tabs **Active / Done / Cancelled / All** with counts; search; sort by
  due date, priority, or remaining effort; compact density by default.
- Row: priority flag with fill level, title, status badge, due date, remaining
  effort in mono (`10m` over `of 120m`), deadline-forecast badge, and
  `Blocked by n` / `Blocks n` counts. Rows open the Task editor.
- `New task` is the one solid action.
- States: skeleton, empty with CTA, error with retry, loaded.

### Task editor sheet

Right-side 400px sheet, opened from a row or New task.

- Fields: title, multi-line description, priority, status, due date, whole-task
  estimate, read-only Remaining effort with **Reassess**, and **Blocked by**.
- Blockers list with add/remove. Adding a link that would create a cycle is
  rejected with the server's error code and a plain explanation.
- Validation mirrors the backend `400` details. A dirty close shows a discard
  warning. Save closes the sheet, invalidates the affected queries, and shows a
  toast.
- Date and time controls are custom, English-only, keyboard-operable, and never
  browser-native locale widgets (see Product Rules).

### Record outcome dialog

- Opens from any work block or mobile agenda row.
- Shows the task, time range, planned minutes, recorded minutes, and remaining
  effort.
- Outcome selector: Done / Partly done / Skipped. **A fresh block starts with no
  outcome selected and Save disabled.** A block that already has an outcome keeps
  it selected.
- Actual minutes, **Finish task**, and **Reassess remaining effort**.
- A block that crosses the current time opens the **Reconcile elapsed portion**
  variant: elapsed portion, recorded time, remaining effort, and the unelapsed
  remainder stays planned.
- A `PROGRESS_CONFLICT` / `PLAN_CHANGED` response shows the conflict alert with a
  refresh path instead of overwriting newer server state.

### Horizon

Read-only forecast of the next seven Working days from the client's current date
and minute-aligned time. No start-date picker.

- **Desktop:** a grid of days × task rows. Day headers say Saved or Forecast.
  Each cell shows a minute bar, planned/assumed-credit numbers, and unplaced
  reasons; a due-date marker sits in the due column. Deadline badges: on track,
  at risk, overdue, can't forecast, beyond horizon. Hovering or focusing a task
  highlights its blockers. The pace assumption and deadline legend live behind
  ⓘ popovers.
- **Mobile:** a vertical list of days; each day shows its tasks, minutes, and
  unplaced notes.
- Saved columns use the saved plan; forecast columns use the horizon response.
  The page must not invent a start date or a local forecast.
- States: skeleton, empty, error with retry, loaded.

### Plans

- **History:** date, minutes, session count, badges for Shortfall / Progress /
  Needs refresh, pagination, and delete with confirmation.
- **Detail:** date and summary, revision switcher (latest revision actionable,
  earlier revisions historical), a read-only rail, and **Work sessions** grouped
  as Recorded / Not recorded / No longer needed. Unplanned work and Unplaced work
  are separate sections. A missing or deleted plan shows a recovery state.

### Settings

Grouped sections: Work window, Focus cadence, Peak window, Fixed breaks, Working
days. A live **Typical day** mini-rail preview updates as values change.

- **Enable focus cadence** is a real toggle backed by `cadenceEnabled`. Off hides
  Focus session and Cadence break, removes cadence breaks from the preview and
  from future re-plans, and saves the setting as off.
- Validation is inline and cancels/blocks Save where required. The
  "Defaults apply until saved" banner disappears after the first save.
- Save shows a toast and marks affected plans as needing refresh where the
  backend rule applies.

### Utility

- 404 page with a route back to Today.
- App-wide error screen with a Reload action.
- Toasts for success and failure.
- Skeletons for lists, plans, and Horizon; no plain "Loading…" text.

## Product Rules The UI Must Enforce

These are the behaviours that the rebuild must not lose.

1. **Regeneration versus Re-planning.** Regeneration is offered only when the
   Daily plan has no Work outcome. A plan with any outcome offers **Re-plan
   only**; Regenerate is hidden, and the client never sends a regeneration for
   such a plan. Generate appears only when no plan exists. Past days are
   read-only.
2. **No default outcome.** A fresh Record outcome dialog has no outcome
   selected, disabled minutes, and a disabled Save. The choice is explicit.
3. **English-only formatting.** 24-hour `HH:MM` times, dates as `6 Nov 2026`
   (or ISO in URL/API), en-dash time ranges, durations as `1h 25m` / `50m` with
   no zero-padded minutes. Do not use native `<input type="date">` or
   `<input type="time">`: their UI follows the browser locale, not the product
   language.
4. **Work sessions are not "recorded" until they are.** Plan detail and past-day
   views group sessions as Recorded / Not recorded / No longer needed.
5. **Plan health requires a plan.** Shortfall, Needs refresh, Blocked, and
   Unplaced are plan-derived. With no Daily plan, do not show a Plan health
   panel; task-level blocked/unplaced notes may still appear in Tasks.
6. **Needs refresh** appears after a task, dependency, preference, or commitment
   change, a partly/skipped outcome, or an effort reassessment that invalidates
   the captured assumptions. The plan keeps its schedule until the user
   re-plans.
7. **Dependencies.** A cycle is rejected. A dependent left unplaced because its
   blocker was not fully placed is `BLOCKED`, not `OUT_OF_TIME`. Done/Cancelled
   blockers release the dependent and keep the link. The UI names direct
   blockers and upstream causes.
8. **Horizon is a read.** It sends `currentDate` and a minute-aligned
   `currentTime`; the server does not substitute its clock. Saved columns use
   the saved plan; forecast columns use the response. Do not add a date picker.
9. **Commitments** are dated unavailable windows, not tasks. Overlaps and
   out-of-window times are rejected. They are edited inline on Today and never
   appear as work.
10. **Peak window is visual only.** It shades the rail and never changes
    placement.
11. **Wall-clock time.** No timezone preference; the client supplies the planning
    date and current time where the API requires them.
12. **Dialogs, sheets, and the mobile drawer** trap focus, close on Esc, return
    focus to the trigger, and use a scrim. The drawer locks body scroll.
13. **One solid button per view.** Destructive actions confirm. Hover never
    lightens text to gray.
14. **No gamification.** No streaks, confetti, scores, or praise copy.

## State Conventions

Every list and page explicitly handles:

- **Loading:** skeleton rows/blocks; busy buttons disable and show progress.
- **Empty:** icon, short message, and a CTA where an action makes sense.
- **Error:** inline alert with retry for queries; field-level errors for forms;
  coded conflicts get a refresh/retry path.
- **Loaded:** normal content.

Forms also handle:

- Inline validation mapped from backend `details`.
- Dirty-close guard.
- Disabled save while pending.
- A single error summary when the server returns a non-field error.

## Accessibility

- WCAG 2.2 AA. Body text ≥ 4.5:1; large text, icons, and control outlines ≥ 3:1.
  The approved contrasts are documented in `DESIGN.md` §2.
- 2px focus ring with 2px offset on every interactive element, including rail
  blocks and agenda rows.
- Every state has a non-colour cue: glyph, pattern, edge, or word.
- Dialogs and sheets use the correct accessible modal behaviour; the mobile
  drawer traps focus and returns it to the menu button.
- Reduced motion collapses transitions; the now-line may still update position.
- `lang="en"` on the document. Date/time controls are English-only regardless of
  the browser locale.

## Rebuild Constraints

The rebuild is a replacement of `frontend/`, not a patch pass.

- **Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind
  CSS v4, shadcn/ui on base-ui.
- **Type safety:** `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes` enabled. No `any` at API boundaries.
- **API types:** generate TypeScript types from `docs/openapi.yaml` with
  `openapi-typescript`; replace the hand-written `src/types/api.ts` mirror. Add
  runtime validation at the response boundary where the contract is not
  discriminated (blocks already need parsing).
- **HTTP client:** one client with `credentials: 'include'`, CSRF on mutations,
  timeout and `AbortSignal` support, and a global 401 path back to `/login`.
- **Queries:** one query-key module and one invalidation map. Feature hooks may
  not import another feature's query keys ad hoc.
- **Forms:** one field/validation layer (react-hook-form + zod or an equivalent
  typed approach), one `Field` component, and custom `DateField` / `TimeField`
  controls. Do not hand-roll `getFieldError` per form.
- **Routing:** route-level lazy loading, an app error boundary, and a 404 route.
- **Styling:** tokens only. Replace `frontend/src/index.css` with the vendored
  `tokens.css` content plus the Tailwind bridge. No raw hex in components.
- **Fonts:** self-host Newsreader, Inter, and JetBrains Mono in production.
- **Cleanup:** remove the dead Vite assets, `App.css`, unused `ui/form.tsx` and
  `ui/field.tsx` (or repurpose them into the new field layer), and the old
  indigo token values.
- **Tests:** Vitest + Testing Library, colocated. Keep the existing 323 tests as
  behavioural references where they still describe the domain; rewrite the ones
  tied to the old layout.
- **CI:** typecheck, lint, test, and build on every pull request.

## Component Mapping

| Current | Target |
|---|---|
| `components/layout/AppLayout.tsx` | `AppShell` with sidebar, mobile drawer, user menu, theme toggle |
| `components/layout/PublicLayout.tsx` | `AuthLayout` |
| `routes/DashboardPage.tsx` | `TodayPage` (rail + plan panels) and `TasksPage` (inventory) |
| `features/plans/DayTimeline.tsx` | `DayRail` (desktop) + `AgendaList` (mobile), shared block model |
| `features/plans/DailyPlanView.tsx` | `TodayPlanPanel` / `PlanDetailView`; extract `PlanHealth`, `WorkSessions`, `UnplacedWork`, `UnplannedWork` |
| `features/plans/BlockProgressDialog.tsx` | `OutcomeDialog` with record, reconcile, and conflict states |
| `features/plans/GeneratePlanCard.tsx` | `PlanActions` enforcing Generate / Regenerate / Re-plan rules |
| `features/commitments/CommitmentList.tsx` | `CommitmentsPanel` with inline CRUD |
| `features/preferences/SchedulingPreferencesForm.tsx` | `SettingsPage` sections + `MiniRailPreview` |
| `features/horizon/HorizonPage.tsx` | `HorizonGrid` (desktop) + `HorizonDayList` (mobile) |
| `features/plans/PlanHistoryList.tsx` | `PlansHistory` |
| `features/tasks/*` | `TaskRow`, `TaskEditorSheet`, `TaskActions`, `PriorityFlag`, `StatusBadge` |
| New | `DateField`, `TimeField`, `Field`, `EmptyState`, `ErrorState`, `Skeleton`, `StatsStrip`, `InfoPopover`, `Scrim` |

The semantic state table in `DESIGN.md` §6 is the source for block, outcome,
deadline, plan-health, and task-state treatments. Do not invent local colours.

## Responsive Rules

- **≥ 1180px:** sidebar 224px · rail · side column 360px.
- **768–1179px:** the side column stacks below the rail.
- **< 768px:** sidebar becomes a top bar with a drawer; stats go 2 × 2; Today
  uses the agenda list; Horizon uses the day list; the task editor becomes a
  full-height sheet.
- The layout should cap its readable width rather than stretch indefinitely on
  ultrawide displays; the exact max width is an open decision.

## Implementation Sequence

1. **Foundation:** tokens, Tailwind bridge, fonts, primitives, `Field` /
   `DateField` / `TimeField`, theme provider without flash.
2. **Shell and auth:** AppShell, drawer, auth layout, sign-in/register forms,
   route guards, 404, error boundary.
3. **Today rail:** block model, DayRail, AgendaList, stats, plan actions
   (Generate/Re-plan/Regenerate rules), plan health.
4. **Tasks:** inventory, filters, row, editor sheet, blockers, cycle handling.
5. **Outcome:** record, reconcile, conflict, needs-refresh invalidation.
6. **Today side panels:** commitments, work sessions, unplanned/unplaced.
7. **Horizon:** desktop grid, mobile day list, deadline legend, blocker
   highlight, cache/clock refresh.
8. **Plans:** history, detail, revisions, work-session groups, delete.
9. **Settings:** sections, cadence toggle, fixed breaks, working days, live
   preview.
10. **Polish:** responsive pass, keyboard pass, reduced motion, dead-code
    removal, CI gates.

Each implementation slice follows the repository's TDD rules: a failing
behaviour test first for new or changed runtime behaviour.

## Acceptance Scenarios

1. The rail renders every block kind, outcome, Peak wash, and a live now-line in
   both themes, and the mobile agenda shows the same day without horizontal
   scroll.
2. A plan with recorded work offers **Re-plan only**; a plan with no outcome may
   be Regenerated; no plan offers Generate.
3. A fresh Record outcome requires an explicit outcome before Save; an existing
   outcome is preserved.
4. All time and date controls are English-only on a `zh-CN` browser: `09:00`,
   `6 Nov 2026`, no `上午`/`下午`, no `日/月/年`.
5. Turning Focus cadence off removes cadence breaks from the preview and saved
   settings.
6. Plan detail groups Work sessions as Recorded / Not recorded / No longer
   needed.
7. The no-plan Today state has no Plan health panel.
8. Sign-in works with Enter and password managers; the mobile drawer has a
   scrim, scroll lock, focus trap, and Esc close.
9. Horizon desktop and mobile both render saved vs forecast days, deadline
   badges, and blocker highlighting without a start-date picker.
10. Tokens are the only colour source; `strict` typecheck, lint, tests, and build
    pass in CI.

## Open Decisions

- Confirm the proposed production routes: keep `/login` and `/register`, and use
  `/today` with a `/dashboard` redirect, rather than adopting the prototype's
  `#/signin`/`#/signup` names.
- Desktop content max width on ultrawide displays.
- Exact interaction for the DateField calendar in the React stack (shadcn
  Popover + Calendar vs a smaller custom control).
- Whether plan detail keeps a dedicated date route in addition to `/plans/:id`.
- Self-hosted font packaging and loading strategy.

## Relationship To Earlier Specs

This spec supersedes the visual and interaction sections of the
[2026-05-31 frontend UI design](2026-05-31-focusflow-frontend-ui-design.md).
That document's toast, alert, confirmation, and loading-state patterns remain
valid where they do not conflict with `DESIGN.md`.

Backend behaviour remains owned by the product specs and ADRs, especially the
[1.4.0 design](2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md). This
document does not redefine the scheduler, effort, dependency, or horizon rules;
it defines how the frontend expresses them.
