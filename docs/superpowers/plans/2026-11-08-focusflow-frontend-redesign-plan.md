# Implementation plan: FocusFlow frontend redesign

**Spec:** `docs/superpowers/specs/2026-11-08-focusflow-frontend-redesign-design.md`
**Design contract:** `docs/design/DESIGN.md`, `docs/design/tokens.css`, `docs/design/implementation-handoff.md`, `docs/design/PROTOTYPE-NOTES.md`
**Product spec:** `docs/superpowers/specs/2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md`
**API contract:** `docs/openapi.yaml`
**Glossary:** `CONTEXT.md`
**Created:** 2026-11-08
**Goal scope:** One milestone: rebuild the React frontend on the approved Paper & Ink design without changing the backend or the HTTP contract.

## Summary

Replace the current dashboard-centred React app with the approved design: a Today rail, a separate Tasks inventory, Horizon, Plans, and Settings. The rebuild keeps React 19, Vite, React Router, TanStack Query, Tailwind CSS v4, and shadcn/ui on base-ui. It generates API types from `docs/openapi.yaml`, centralizes query keys, and uses one form layer with English-only date and time controls.

The UI must enforce the settled product rules: Regenerate only when a Daily plan has no Work outcome; a fresh outcome is never pre-selected; Plan health is hidden when there is no plan; work sessions are grouped as Recorded, Not recorded, and No longer needed; Focus cadence is a real toggle; Horizon is a read with no start-date picker.

Out of scope: backend, scheduler, effort, dependency, or horizon rule changes; new API endpoints; drag-to-reschedule; recurring tasks; subtasks; analytics; onboarding; a chart library; visual-regression tooling; adopting the prototype's `#/signin` names; and shipping the prototype's Demo switcher.

This is one product, not separate specs. Foundation, shell, Today, Tasks, outcome, Horizon, Plans, and Settings are slices of the same app. They share tokens, the HTTP client, and query keys, so they are not independently shippable products.

## Decisions locked for this plan

The spec left these open. This plan locks them so implementers do not rediscover them.

- **Routes.** Keep `/login` and `/register`. Home is `/today`. The planning date stays in `?date=YYYY-MM-DD`. `/dashboard` redirects to `/today` and preserves the query. Plan detail stays `/plans/:id`. There is no `/plans/date/:date` route; the date lives on Today.
- **Readable width.** The main column uses `max-w-6xl` (72rem). The sidebar stays 224px. Do not stretch the rail across an ultrawide display.
- **Date control.** A small custom calendar in a popover, English month and weekday names, `6 Nov 2026` in the field, ISO `YYYY-MM-DD` at the API boundary. Not a native `<input type="date">` and not a third-party date library.
- **Fonts.** Self-host Newsreader, Inter, and JetBrains Mono as woff2 under `frontend/src/assets/fonts/`, with the fallbacks already named in `DESIGN.md`.

## Discovery notes

- Reuse: feature folders (`auth`, `tasks`, `commitments`, `plans`, `preferences`, `horizon`); `apiRequest` in `frontend/src/lib/api.ts` (credentials, CSRF, `ApiError`); TanStack Query hooks and the existing invalidation behaviour; pure helpers `progressRules.ts`, `planConflicts.ts`, `planSnapshotCopy.ts`, `horizonGrid.ts`, `taskDependencyLinks.ts`, `taskEffort.ts`, `planningDate.ts`; `parseScheduledBlock` in `features/plans/blocks.ts`; Vitest beside components; shadcn primitives already in `components/ui/`.
- Constraints: the backend contract in `docs/openapi.yaml` is unchanged. Cookie session and `X-XSRF-TOKEN` stay. The client supplies planning date and, for horizon, minute-aligned `currentTime`. Frontend tests run with `npm run test:run` from `frontend/`. `docs/design/prototype/` is gitignored and is a visual reference only.
- Patterns to follow: one feature folder per product area, `api.ts` plus `hooks.ts` beside the screens, shared response types in one module, query keys exported as constants. New screens consume those hooks; they do not invent a second data layer.
- Anti-goals: do not rewrite the backend. Do not change global React Query `staleTime` except where a task says so. Do not add Redux. Do not copy prototype hash routes or the Demo switcher into production. Do not hand-write a second copy of the OpenAPI schemas. Do not leave raw hex in feature components. Do not parallelize tasks that edit `App.tsx`, `index.css`, `lib/api.ts`, or `lib/query.ts`.

## File map

A path that already exists is **verified**. A path this plan proposes to create, or an internal split, is **provisional** and may move during subtask planning without reopening the milestone.

### Slice A — Tooling, tokens, and generated types

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/package.json` | modify | Add `openapi-typescript`, `react-hook-form`, `zod`, `@hookform/resolvers`. Scripts: `typecheck`, `openapi:types`. | npm scripts | verified |
| `frontend/tsconfig.app.json` | modify | Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. | compiler options | verified |
| `frontend/src/index.css` | modify | Replace the indigo theme with vendored tokens plus the Tailwind v4 bridge from `docs/design/tokens.css`. | CSS variables | verified |
| `frontend/src/types/api.generated.ts` | create | Generated types from `docs/openapi.yaml`. Never hand-edit. | generated module | provisional |
| `frontend/src/types/api.ts` | modify | App-facing aliases and the few hand-written helpers (`DAY_OF_WEEK_ORDER`, labels) that sit on the generated types. | `TaskResponse`, `DailyPlanResponse`, and the rest of the DTO names | verified |
| `frontend/src/assets/fonts/` | create | Self-hosted Newsreader, Inter, JetBrains Mono woff2 plus `@font-face` in `index.css`. | font files | provisional |
| `frontend/index.html` | modify | Title `FocusFlow`, `lang="en"`, theme script before first paint. | document shell | verified |
| `.github/workflows/frontend-ci.yml` | create | `npm ci`, `openapi:types` check, `typecheck`, `lint`, `test:run`, `build`. | CI job | provisional |

`openapi:types` writes `api.generated.ts`. CI fails if the generated file differs from the committed copy, so the contract and the client cannot drift.

### Slice B — HTTP client and query map

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/lib/api.ts` | modify | Timeout, `AbortSignal`, and a single 401 listener. Keep credentials and CSRF. | `apiRequest`, `ApiError`, `onUnauthorized` | verified |
| `frontend/src/lib/query.ts` | create | Every query key and the invalidation helpers that features share. | `tasksQueryKey`, `planByDateQueryKey`, `invalidatePlanQueries`, `horizonQueryPrefix` | provisional |
| `frontend/src/features/*/hooks.ts` | modify | Import keys from `lib/query.ts`. Stop cross-importing another feature's key module. | existing hooks | verified |

`features/plans/hooks.ts` currently imports `tasksQueryKey` and `horizonQueryPrefix`. After this slice those imports come from `lib/query.ts` only.

### Slice C — Shared UI primitives

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/components/ui/field.tsx` | modify | One `Field` that renders label, control, and error. Replaces the four copies of `getFieldError`. | `Field`, `getFieldError` | verified |
| `frontend/src/components/form/DateField.tsx` | create | English calendar popover. Displays `6 Nov 2026`. Emits `YYYY-MM-DD`. | `DateField` | provisional |
| `frontend/src/components/form/TimeField.tsx` | create | 24-hour `HH:MM` text field. No native time picker. | `TimeField` | provisional |
| `frontend/src/components/form/schemas.ts` | create | Zod schemas shared by Task, Commitment, Outcome, and Settings. | `taskFormSchema`, `commitmentSchema`, `outcomeSchema`, `settingsSchema` | provisional |
| `frontend/src/lib/format.ts` | create | `formatClock`, `formatDuration`, `formatDateLabel`. Durations are `1h 25m` and `50m`, never `1h 25m` with a zero-padded minute and never `5h 04m`. | formatters | provisional |
| `frontend/src/components/states.tsx` | create | Empty, error-with-retry, and skeleton wrappers used by every list. | `EmptyState`, `ErrorState`, `ListSkeleton` | provisional |

Delete `frontend/src/components/ui/form.tsx` once nothing imports it. `field.tsx` stays and becomes the real field primitive.

### Slice D — Shell, auth, and routing

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/App.tsx` | modify | Routes in the spec. `/` is auth-aware. `/dashboard` redirects to `/today`. `*` is the 404. Lazy route elements. | route tree | verified |
| `frontend/src/components/layout/AppShell.tsx` | create | Sidebar 224px, mobile drawer with scrim, theme toggle, user menu. Replaces `AppLayout.tsx`. | `AppShell` | provisional |
| `frontend/src/components/layout/AuthLayout.tsx` | create | Centred card. Replaces `PublicLayout.tsx`. | `AuthLayout` | provisional |
| `frontend/src/components/ErrorBoundary.tsx` | create | App-wide error screen with Reload. | `ErrorBoundary` | provisional |
| `frontend/src/routes/NotFoundPage.tsx` | create | 404 with a link to `/today`. | `NotFoundPage` | provisional |
| `frontend/src/features/auth/LoginForm.tsx` | modify | Real `<form>`, Enter submits, inline field errors. | `LoginForm` | verified |
| `frontend/src/features/auth/RegisterForm.tsx` | modify | Same form contract as login. | `RegisterForm` | verified |
| `frontend/src/components/theme/ThemeProvider.tsx` | modify | Apply the saved theme before paint via the inline script in `index.html`. | `ThemeProvider`, `useTheme` | verified |

### Slice E — Day rail

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/features/plans/railModel.ts` | create | Turn a `DailyPlanResponse` plus a clock minute into positioned blocks: kind, geometry, outcome, session label, in-progress. | `buildRail(plan, nowMinutes, density)` | provisional |
| `frontend/src/features/plans/DayRail.tsx` | create | Desktop vertical rail. Replaces `DayTimeline.tsx`. | `DayRail` | provisional |
| `frontend/src/features/plans/AgendaList.tsx` | create | Mobile time-grouped list of the same blocks. | `AgendaList` | provisional |
| `frontend/src/features/plans/PlanHealth.tsx` | create | Shortfall, Needs refresh, Blocked, Unplaced. Renders nothing when `plan` is null. | `PlanHealth` | provisional |
| `frontend/src/features/plans/PlanActions.tsx` | create | Generate, Regenerate, or Re-plan. Hides Regenerate when `planHasProgress` is true. | `PlanActions` | provisional |
| `frontend/src/features/plans/WorkSessions.tsx` | create | Groups sessions into Recorded, Not recorded, and No longer needed. | `WorkSessions` | provisional |

`planHasProgress` already lives in `planConflicts.ts`. `PlanActions` consumes it; it does not reimplement the rule.

### Slice F — Today, Tasks, and outcome

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/routes/TodayPage.tsx` | create | Date header, stats, rail or agenda, plan actions, plan health, commitments, compact task list. | `TodayPage` | provisional |
| `frontend/src/routes/TasksPage.tsx` | create | Filter tabs, search, sort, compact rows. | `TasksPage` | provisional |
| `frontend/src/features/tasks/TaskEditorSheet.tsx` | create | Create and edit sheet, blockers, cycle error, dirty close. | `TaskEditorSheet` | provisional |
| `frontend/src/features/tasks/TaskRow.tsx` | create | Priority flag, status, due date, remaining effort, forecast badge, Blocked by / Blocks counts. | `TaskRow` | provisional |
| `frontend/src/features/plans/OutcomeDialog.tsx` | create | Record, reconcile, and conflict. No default outcome. | `OutcomeDialog` | provisional |
| `frontend/src/features/commitments/CommitmentsPanel.tsx` | create | Inline add, edit, and delete for one date. | `CommitmentsPanel` | provisional |

`DashboardPage.tsx` is deleted once `TodayPage` and `TasksPage` cover its behaviour. `TaskForm.tsx`, `TaskList.tsx`, `BlockProgressDialog.tsx`, `GeneratePlanCard.tsx`, and `CommitmentList.tsx` are deleted in the same slices, after their tests have moved.

### Slice G — Horizon, Plans, and Settings

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `frontend/src/features/horizon/HorizonGrid.tsx` | create | Desktop seven-day grid. No start-date picker. | `HorizonGrid` | provisional |
| `frontend/src/features/horizon/HorizonDayList.tsx` | create | Mobile day list. | `HorizonDayList` | provisional |
| `frontend/src/features/horizon/HorizonPage.tsx` | modify | Chooses grid or day list. Keeps the existing query. | `HorizonPage` | verified |
| `frontend/src/features/plans/PlanHistoryList.tsx` | modify | History rows, badges, pagination, delete. Existing file; no `PlansHistory` is created. | `PlanHistoryList` | provisional |
| `frontend/src/routes/PlanDetailPage.tsx` | modify | Read-only rail, revision switcher, `WorkSessions`. | `PlanDetailPage` | verified |
| `frontend/src/features/preferences/SettingsForm.tsx` | create | Grouped sections, cadence toggle, live mini-rail. Replaces `SchedulingPreferencesForm.tsx`. | `SettingsForm` | provisional |
| `frontend/src/features/preferences/MiniRail.tsx` | create | Typical-day preview driven by the form's current values. | `MiniRail` | provisional |

### Blast radius

| Path | Why sensitive | Behavior that must stay intact |
|------|----------------|-------------------------------|
| `frontend/src/lib/api.ts` | Every request | `credentials: 'include'`, CSRF header on POST/PUT/PATCH/DELETE, `ApiError` shape |
| `frontend/src/types/api.ts` | Every feature imports these names | DTO field names stay aligned with `docs/openapi.yaml` |
| `frontend/src/App.tsx` | Route guards | Unauthenticated users still cannot reach protected pages |
| `frontend/src/lib/query.ts` | Cache identity | A mutation still refreshes tasks, the plan for that date, plan detail, plan history, and horizon |
| `frontend/src/features/plans/progressRules.ts` | Outcome credit | `creditFor` and `wouldExhaustRemainder` stay the server's rules |
| `frontend/src/index.css` | Every screen | Light and dark both remain usable; no flash of the wrong theme |

## Workflow (for implementers)

1. **writing-plans** produced this file (type-1 decomposition).
2. Per subtask: **Plan mode** plus **planning-subtasks** when **Plan mode** is `high` (or `medium` with a real remaining unknown). Approve that type-2 plan with **ExitPlanMode** before implementation.
3. **Implementation** after that approval. **test-driven-development** when **`TDD suitable: yes`** (or the testable slice of **`partial`**). Follow **Verification** when **`no`**.
4. Equivalent internal changes: record them in the changelog and continue. A subtask split updates ids, **Consumes**, **Produces**, **Acceptance**, and **Blocked by**. A material change pauses for agreement.

## Subtasks

Dependency notation: `Blocked by: T1` means start after T1 is done.

### T1 — Tokens, strict TypeScript, and generated API types

- [x] **Do:** Make the app compile under strict TypeScript against generated OpenAPI types, and make `index.css` the approved token sheet.
- **Consumes:** `docs/openapi.yaml`, `docs/design/tokens.css`.
- **Produces:** `frontend/src/types/api.generated.ts`; `api.ts` re-exports the same DTO names features already import; `npm run openapi:types` and `npm run typecheck`; token variables from the design contract on `:root` and `.dark`.
- **Acceptance:** `npm run typecheck` passes with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Regenerating types produces no diff. Existing feature imports of `TaskResponse` and `DailyPlanResponse` still resolve. Light and dark CSS variables match `docs/design/tokens.css`, including `--now`, `--block-work`, and the deadline tokens. No feature file gains a raw hex.
- **Compatibility:** Request and response field names stay identical to the OpenAPI document. No backend change.
- **Blocked by:** —
- **Plan mode:** high
- **TDD suitable:** no
- **TDD suitable reason:** Generated types, compiler flags, and CSS variables. The check is `tsc` and a token-file comparison, not a new runtime behavior.
- **Verification:** `cd frontend && npm run openapi:types && npm run typecheck`

### T2 — HTTP client and shared query map

- [x] **Do:** Give every feature one query-key module, and teach the HTTP client to time out and to surface a 401 without each caller handling it.
- **Consumes:** `ApiError` and `apiRequest` from T1's still-intact client; the query keys currently exported by each feature's `hooks.ts`.
- **Produces:** `lib/query.ts` with `tasksQueryKey`, `planByDateQueryKey`, `planDetailQueryKey`, `plansListQueryPrefix`, `horizonQueryPrefix`, `schedulingPreferencesQueryKey`, `commitmentsQueryKey`, and `invalidatePlanQueries(queryClient, plan)`. `onUnauthorized(handler)` on the client.
- **Acceptance:** A 401 response invokes the registered handler once and still throws `ApiError`. A request passes `AbortSignal` through to `fetch`. An in-flight request aborts at 15 seconds. `invalidatePlanQueries` still invalidates the by-date plan, the plan list, the plan detail, the task list, and the horizon. No feature hook imports a query key from another feature.
- **Compatibility:** CSRF and `credentials: 'include'` stay. Existing mutation success still refreshes the same views as today.
- **Blocked by:** T1
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/lib/api.test.ts src/lib/query.test.ts`

### T3 — Formatters, Field, DateField, and TimeField

- [x] **Do:** Replace duplicated field chrome and locale-native date/time inputs with one Field and two English controls.
- **Consumes:** `ApiError.details` from T2. Design type scale and radius from T1.
- **Produces:** `formatClock(time) => "09:00"`, `formatDuration(minutes) => "50m" | "2h" | "5h 4m"`, `formatDateLabel(iso) => "6 Nov 2026"`. `Field`, `DateField` (value `YYYY-MM-DD`), `TimeField` (value `HH:MM`). Zod schemas for task, commitment, outcome, and settings.
- **Acceptance:** `formatDuration(304)` is `5h 4m`, not `5h 04m`. `formatDuration(120)` is `2h`. `formatDuration(0)` is `0m`. `DateField` shows `6 Nov 2026`, writes `2026-11-06`, and has no `<input type="date">`. `TimeField` accepts `1745` as `17:45`, rejects `25:00`, and has no `<input type="time">`. `Field` renders the first `details[name]` string. Calendar month names are English regardless of the test locale.
- **Blocked by:** T1
- **Plan mode:** medium — the only unknown is whether the calendar popover is a base-ui `Popover` or a fixed-position dialog; resolve it in the type-2 plan before coding.
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/lib/format.test.ts src/components/form`

### T4 — App shell, auth forms, and routes

- [x] **Do:** Ship the authenticated shell, the public auth layout, and the route map from the spec, including 404 and the error boundary.
- **Consumes:** `onUnauthorized` from T2. `Field` from T3. Theme tokens from T1.
- **Produces:** `AppShell`, `AuthLayout`, `NotFoundPage`, `ErrorBoundary`. Routes: `/today`, `/tasks`, `/horizon`, `/plans`, `/plans/:id`, `/settings`, `/login`, `/register`. `/` redirects by session. `/dashboard` redirects to `/today` and keeps `?date`.
- **Acceptance:** An unauthenticated visit to `/today` redirects to `/login`. A 401 from any query does the same. Login submits on Enter and uses a real `<form>`. The mobile drawer traps focus, closes on Escape, and returns focus to the menu button. `/unknown` renders the 404 with a link to `/today`. The theme is applied before first paint.
- **Compatibility:** Session cookie login and logout still land on `/today` and `/login`.
- **Blocked by:** T2, T3
- **Plan mode:** high
- **TDD suitable:** partial
- **TDD suitable reason:** Route guards, redirect query preservation, and form submit are testable. Drawer scroll-lock and the no-flash theme script are verified manually in the browser.
- **Verification:** `cd frontend && npm run test:run -- src/App.auth-routing.test.tsx src/features/auth src/components/layout`

### T4b — Close the prototype gaps found in T1–T4

- [x] **Do:** Bring the finished slices back to the prototype's look and copy: tokens `--scrim`/`--skeleton`, primitive chrome, shell footer and collapse rail, brand mark, auth card, 404 inside the shell, and per-route document titles.
- **Consumes:** `docs/design/prototype/{app.css,js/app.js,js/views.js}`, `DESIGN.md`, `tokens.css`. `formatClock`/`formatDateLabel` from T3. `useSchedulingPreferences`.
- **Produces:** `BrandMark`, `AuthCard`, `useDocumentTitle`, shell footer work window, collapse-to-64px rail, prototype-styled `Button`/`Input`/`Card`/`Alert`/`Field`/`Sheet`/`Skeleton`.
- **Acceptance:** Wordmark is 20px Newsreader. Sidebar shows Working day and Work window, a labelled theme button, and initials + username/email. Collapse reaches a 64px icon rail. User menu has Settings and Sign out. 404 renders inside the shell when signed in. Register rejects passwords under 8 and usernames outside 3–30; auth fields show required markers and validate on blur; alerts carry the message only. Document titles read "<Screen> — FocusFlow".
- **Compatibility:** Routes, guards, CSRF, and the query map unchanged. `max-w-6xl` and the username-only login field stay as plan-locked decisions.
- **Blocked by:** T4
- **Plan mode:** medium
- **TDD suitable:** partial
- **TDD suitable reason:** Copy, validation, menu items, routing, and titles are testable. Primitive restyling is a visual check against the prototype.
- **Verification:** `cd frontend && npm run test:run -- src/features/auth src/components/layout src/components/ErrorBoundary.test.tsx src/routes/NotFoundPage.test.tsx src/hooks/use-document-title.test.tsx`

### T5 — Day rail model and views

- [x] **Do:** Render one plan as a desktop rail and a mobile agenda that share a pure block model.
- **Consumes:** `DailyPlanResponse`, `parseScheduledBlock`, `formatClock`, `formatDuration`.
- **Produces:** `buildRail(plan, nowMinutes, density)` returning blocks with `kind`, `topPx`, `heightPx`, `label`, `outcome`, and `sessionLabel`. `DayRail` and `AgendaList`.
- **Acceptance:** A sample day produces one node per block kind: Work, Cadence break, Fixed break, Commitment, Trailing buffer. Work blocks include the task title and `session 2 of 3` when split. A 15-minute block still exposes its title to assistive tech. The now-line position matches the supplied minute. Compact density uses a smaller px-per-minute than comfortable and does not change the block count. Agenda order matches rail order.
- **Compatibility:** `parseScheduledBlock` still rejects a work block without a snapshot.
- **Blocked by:** T1, T3
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/plans/railModel.test.ts src/features/plans/DayRail.test.tsx src/features/plans/AgendaList.test.tsx`

### T6 — Plan actions, plan health, and work sessions

- [x] **Do:** Enforce generate, regenerate, and re-plan visibility, and stop describing unrecorded sessions as recorded.
- **Consumes:** `planHasProgress` and `replanErrorMessage` from `planConflicts.ts`. `DayRail` from T5.
- **Produces:** `PlanActions`, `PlanHealth`, `WorkSessions`.
- **Acceptance:** `plan === null` renders Generate and renders no Plan health. A plan with no outcome renders Regenerate. A plan with any outcome renders Re-plan and does not render Regenerate. A past date renders neither. `WorkSessions` puts a block with an outcome under Recorded, a block with no outcome under Not recorded, and `NO_LONGER_NEEDED` under No longer needed. Needs refresh is an alert with a Re-plan action, not a paragraph.
- **Compatibility:** Re-plan still sends `expectedRevisionId`, `cutoff`, and `effortVersions`. Legacy snapshots still show `REPLAN_LEGACY_SNAPSHOT` copy.
- **Blocked by:** T5
- **Plan mode:** medium — confirm the exact predicate for "past date" against `getLocalDateString` before coding; the rest is specified.
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/plans/PlanActions.test.tsx src/features/plans/PlanHealth.test.tsx src/features/plans/WorkSessions.test.tsx`

### T7 — Today page

- [x] **Do:** Assemble Today from the rail, stats, plan actions, plan health, and the existing plan-by-date query.
- **Consumes:** `DayRail`, `AgendaList`, `PlanActions`, `PlanHealth` from T5 and T6. `usePlanByDate` via `lib/query.ts`.
- **Produces:** `TodayPage` at `/today`. Stats: Planned focus, Done, Left today, Shortfall, formatted with `formatDuration`.
- **Acceptance:** `/today?date=2026-11-06` loads that plan. An invalid `date` falls back to the local date and replaces the query. Below 768px the agenda renders and the rail does not. The no-plan state shows the empty rail and Generate, and does not show Plan health. One solid button is visible.
- **Compatibility:** Generating or re-planning still invalidates the by-date plan, plan list, and horizon.
- **Blocked by:** T4, T6
- **Plan mode:** medium — the stats formulas (which blocks count as Done and Left today) need one pass against `DailyPlanResponse` before coding.
- **TDD suitable:** partial
- **TDD suitable reason:** Date resolution, empty versus planned rendering, and which action is visible are testable. Pixel alignment of the stats strip is a visual check.
- **Verification:** `cd frontend && npm run test:run -- src/routes/TodayPage.test.tsx`

### T8 — Tasks inventory and editor

- [x] **Do:** Move task management onto `/tasks` with filters and a sheet that can add and reject blockers.
- **Consumes:** `Field`, `DateField`, `taskFormSchema` from T3. `tasksQueryKey` from T2. `taskDependencyLinks` helpers.
- **Produces:** `TasksPage`, `TaskRow`, `TaskEditorSheet`.
- **Acceptance:** Active hides Done and Cancelled. Search matches title only. Sort by due date, priority, and remaining effort is stable. A row shows `Blocked by n` and `Blocks n` as words, not arrows. The sheet creates and updates through the existing mutations. Adding a blocker that returns `DEPENDENCY_CYCLE` shows the explanation and does not close the sheet. Closing a dirty sheet asks before discarding. Due date uses `DateField`.
- **Compatibility:** Create, update, delete, reassess, add blocker, and remove blocker keep their current request bodies, including `effortVersion` when progress exists.
- **Blocked by:** T3, T4
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/routes/TasksPage.test.tsx src/features/tasks/TaskEditorSheet.test.tsx`

### T9 — Outcome dialog

- [x] **Do:** Record, reconcile, and recover from a stale save without ever defaulting the outcome to Done.
- **Consumes:** `progressRules.creditFor`, `wouldExhaustRemainder`, `isPlanRefetchConflict`. `OutcomeDialog` replaces `BlockProgressDialog`.
- **Produces:** `OutcomeDialog` with modes `record` and `reconcile`. `TodayPage` opens it from rail/agenda selection.
- **Acceptance:** A block with `outcome === null` opens with no outcome selected, the minutes field disabled, and Save disabled. Choosing Partly done requires a positive actual. Choosing Skipped hides actual minutes unless reconcile is on. A block that already has an outcome opens with that outcome selected. A block whose interval contains the current minute opens in reconcile mode. A 409 with `PROGRESS_CONFLICT` or `PLAN_CHANGED` shows the refresh alert and does not close as a success. Selecting a recordable block on Today opens the dialog for that block.
- **Compatibility:** The request body stays `BlockProgressRequest`: `outcome`, `actualMinutes`, `currentDate`, `expectedProgressVersion`, `finish`, `checkpoint`, `cutoff`.
- **Blocked by:** T3, T6
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/plans/OutcomeDialog.test.tsx`

### T10 — Commitments panel

- [x] **Do:** Edit one date's commitments inline on Today, with overlap and window checks surfaced from the server.
- **Consumes:** `TimeField`, `commitmentSchema` from T3. `CommitmentsPanel` replaces `CommitmentList`.
- **Produces:** `CommitmentsPanel` used by `TodayPage`.
- **Acceptance:** Add, edit, and delete call the existing commitment mutations. Delete asks for confirmation. A 400 `details` entry renders on the matching field. Times use `TimeField`. The panel is not titled or styled as a task.
- **Compatibility:** Changing a commitment still marks the regenerate prompt and invalidates horizon.
- **Blocked by:** T3, T7
- **Plan mode:** skip
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/commitments/CommitmentsPanel.test.tsx`

### T11 — Horizon grid and day list

- [x] **Do:** Show the seven-day forecast as a desktop grid and a mobile day list without adding a start date.
- **Consumes:** `useHorizon`, `horizonGrid.ts` formatters, `formatDuration`.
- **Produces:** `HorizonGrid`, `HorizonDayList`. `HorizonPage` picks one from the viewport.
- **Acceptance:** The page sends `currentDate` and a minute-aligned `currentTime` and has no date picker. Saved and forecast headers are distinct. Deadline badges use the design glyphs, not colour alone. Focusing a row with `waitingOn` marks those rows. Duration text uses `formatDuration`. Below 768px the day list renders and the grid does not. Empty, loading, and error states exist.
- **Compatibility:** Horizon query key remains date plus minute. Visibility refetch stays.
- **Blocked by:** T1, T3, T4
- **Plan mode:** medium — the grid's column template is specified; the only unknown is the breakpoint hook versus a CSS container query. Decide in the type-2 plan.
- **TDD suitable:** partial
- **TDD suitable reason:** Query parameters, badge text, blocker highlighting, and empty/error states are testable. Column alignment is a visual check against the prototype.
- **Verification:** `cd frontend && npm run test:run -- src/features/horizon`

### T12 — Plan history and detail

- [x] **Do:** Restyle history and detail onto the rail and the work-session groups.
- **Consumes:** `DayRail`, `WorkSessions`, `PlanHistoryList`.
- **Produces:** History at `/plans`. Detail at `/plans/:id` with the revision switcher.
- **Acceptance:** History shows Shortfall, Progress, and Needs refresh as badges plus text. Delete confirms, then navigates nowhere on history and to `/plans` on detail. Detail renders the selected revision's blocks in the read-only rail. Recorded, Not recorded, and No longer needed are separate groups. A 404 uses the not-found recovery, not a blank page.
- **Compatibility:** Pagination stays `page` and `size`. Delete still invalidates list, by-date, detail, and horizon.
- **Blocked by:** T6, T4
- **Plan mode:** skip
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/plans/PlanHistoryList.test.tsx src/routes/PlanHistoryPage.test.tsx src/routes/PlanDetailPage.test.tsx`

### T13 — Settings and the live preview

- [x] **Do:** Rebuild scheduling preferences as grouped sections with a cadence toggle and a mini-rail that follows the form.
- **Consumes:** `TimeField`, `settingsSchema`, `MiniRail`, `buildRail`.
- **Produces:** `SettingsForm`, `MiniRail`.
- **Acceptance:** `cadenceEnabled === false` hides Focus session and Cadence break and the preview contains no cadence-break block. Turning it on restores both fields and the breaks. Fixed breaks add and remove in the form and in the preview. Working days are seven checkboxes in Monday-first order. Save sends the existing `SchedulingPreferencesRequest`. The "Defaults apply until saved" banner shows only when `persisted` is false. Times use `TimeField`.
- **Compatibility:** Save still invalidates preferences and horizon and still marks the regenerate prompt.
- **Blocked by:** T3, T5, T4
- **Plan mode:** medium — the preview can reuse `buildRail` with a synthetic plan, or a smaller renderer. Pick one in the type-2 plan so Settings does not fork rail geometry.
- **TDD suitable:** yes
- **Verification:** `cd frontend && npm run test:run -- src/features/preferences`

### T14 — Removal, CI, and the manual pass

- [ ] **Do:** Delete the old dashboard, timeline, and form files, and make frontend CI the gate.
- **Consumes:** Every prior slice. The old files are unused.
- **Produces:** `.github/workflows/frontend-ci.yml`. A shorter `frontend/src` tree. No `App.css`, no `DashboardPage.tsx`, no `DayTimeline.tsx`, no `ui/form.tsx`.
- **Acceptance:** `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` pass. CI runs those four. A search of `frontend/src` finds no `type="date"`, no `type="time"`, and no import of a deleted file. Dead assets `src/assets/hero.png`, `react.svg`, and `vite.svg` are gone if nothing imports them.
- **Compatibility:** Backend CI is unchanged.
- **Blocked by:** T7, T8, T9, T10, T11, T12, T13
- **Plan mode:** skip
- **TDD suitable:** no
- **TDD suitable reason:** Deletion of unused files and a workflow file. The suite that already covers the new screens is the regression net. The manual pass below is the visual check.
- **Verification:** `cd frontend && npm run typecheck && npm run lint && npm run test:run && npm run build`

Manual pass, once, against the local prototype in `docs/design/prototype/` (gitignored, present on the machine that generated it):

- Today in light and dark, comfortable and compact, with the now-line moving.
- A `zh-CN` browser shows `09:00` and `6 Nov 2026`, never `上午` or `日/月/年`.
- Mobile drawer scrim, Escape, and focus return.
- One solid button on Today, Tasks, and Settings.

## Suggested order

```
T1 ── T2 ── T4 ─┬─ T7 ── T10
         │      │
         T3 ─┬─ T5 ── T6 ─┴─ T12
              │      │
              ├─ T8  T9
              │
              ├─ T11
              │
              └─ T13
                    │
                    T14  (after T7–T13)
```

T8 and T11 can proceed in parallel with T5 once T3 and T4 are done. T9 waits for T6 because reconcile placement depends on the rail's clock. Do not start T14 until the screens it deletes are unused.

## TDD note (implementation)

Per subtask, obey **`TDD suitable`**. **`yes`** means strict red then green, one behavior at a time. **`partial`** applies that only to the slice named in the reason; the rest is a manual or compiler check. **`no`** means do not force a new failing test. A behavior-preserving move of an existing helper, with its current test still green, is **`no`**.

UI work in T4, T7, and T11 is **`partial`** on purpose: test the branching and the copy, and check layout against the prototype by eye.

## Plan changelog

| Date | Change | Kind |
|------|--------|------|
| 2026-11-08 | Initial plan. Locked routes, content width, date control, and self-hosted fonts from the spec's open decisions. | — |
| 2026-11-09 | T3: `zod` added in T3; `react-hook-form` + `@hookform/resolvers` deferred to T4; `Field` extended additively; local `getFieldError` copies removed per migrating slice (T4/T6/T8/T11). | equivalent |
| 2026-11-09 | T4b added after comparing T1–T4 with the prototype: `--scrim`/`--skeleton`, primitive chrome, shell footer, collapse rail, brand mark, auth card, shell 404, document titles. No route or API change. | equivalent |
| 2026-11-09 | T5: `buildRail` also returns hairlines, hour marks (with a near-now flag), peak window, total height and now minute, and renders from `composedRail`. `RailOutcome` shared by `DayRail` and `AgendaList`. Prototype "Overlaps" state dropped (no API field). No route or API change. | equivalent |
| 2026-11-09 | T6: Re-plan runs on click with no confirm dialog (only Regenerate confirms); a plan-changing 409 (`PLAN_EXISTS`, `PLAN_CHANGED`, `PLAN_HAS_PROGRESS`) refetches and shows the conflict alert instead of the old replace dialog. Pure modules are `planActionRules.ts`, `planHealthModel.ts`, `workSessionsModel.ts` because Windows resolves `PlanHealth` to `planHealth.ts`; `planHealth` also feeds the T7 Shortfall stat and `WorkSessions` serves T9. No route or API change. | equivalent |
| 2026-11-10 | T7: Stats live in a pure `todayStats.ts` (planned = WORK minutes on `composedRail` minus `NO_LONGER_NEEDED`; done = `creditFor` per outcome; left = unrecorded minutes clamped to the clock today, whole on a future day, zero on a past day; shortfall = `planHealth`). `StatsStrip.tsx` renders them. Today keeps `CommitmentList` until T10 replaces it and keeps `useIsMobile` for the rail/agenda switch, with a Comfortable/Compact toggle. `/tasks` still renders `DashboardPage`. No route, API, or query-key change. | equivalent |
| 2026-11-10 | T7 follow-up after comparing with `docs/design/prototype/`: stats card chrome and 2×2 borders, `1fr 360px` side column at 1180px, panel heads for the rail and Plan health, peak-window chip, work-window/buffer/re-planned meta line, previous-day arrow, prototype segmented density control, dashed empty rail, and the Regenerate prompt restored on Today. No route, API, or query-key change. | equivalent |
| 2026-11-10 | T8: Filtering, search, and sorting live in a pure `taskListModel.ts`; rows render as a table or cards from one `TaskRow`; the editor is `TaskEditorSheet` on base-ui `Sheet` with react-hook-form, `DateField`, blocker add/remove, plain-language dependency copy in `dependencyCopy.ts`, and a dirty-close discard gate. The sheet keeps Open/In progress editable and carries any Done/Cancelled status through unchanged. `DashboardPage`, `TaskList`, and `TaskForm` with their tests are retired here instead of T14. No API, query-key, or request-body change. | equivalent |
| 2026-11-11 | T9: `OutcomeDialog` is wired into `TodayPage` via rail/agenda `onSelect`; the dialog gets `now: null` on a past or future day so only today reconciles; Save is a plain button so a 409 keeps it open; `BlockProgressDialog` stays until T14. No route or API change. | equivalent |
| 2026-11-11 | T9 follow-up after the browser compare with the prototype, agreed before implementing: reconcile mode now offers Finish task, and one centered Reassess control (prefilled with the computed remainder, unknown inside it) replaces the always-visible remainder field. The checkpoint defaults to the computed remainder because the server rejects a crossing reconcile without one; checking Finish sends `finish: true` with no checkpoint, which the server treats as a whole-task finish. | material |
| 2026-11-12 | T10: `CommitmentsPanel` replaces `CommitmentList` on Today: an inline add and edit form (react-hook-form, `commitmentSchema`, `TimeField`), a row Edit, and an inline delete confirm that replaces the dialog. A 400 `details` entry renders on its field; a 400 without `details` (for example overlap) renders as a form-level alert, because the server sends no field for it. Edits keep the commitment's own date. `CommitmentList` and its test stay until T14. No API, hook, or query-key change. | equivalent |
| 2026-11-12 | T11: `HorizonPage` is a shell over `HorizonGridView` (desktop, `section` labelled "Horizon grid") and `HorizonDayList` (below 768px via `useIsMobile`). The grid component is named `HorizonGridView.tsx` because `HorizonGrid.tsx` collides with the verified `horizonGrid.ts` on case-insensitive Windows. Deadline badges reuse `deadlineBadgeLabel` with lucide glyphs, not the Tasks `DeadlineBadge`, so the Tasks page is untouched. `dashboardHref` becomes `todayHref` (`/today?date=`). Headers show a formatted date, the day total, and a saved shortfall from `SAVED_SHORTFALL` segments. Due dates between columns show a weekday at the edge. The ⓘ popovers from the T11 note are deferred; the pace copy stays on the page. No route, API, or query-key change. | equivalent |
| 2026-11-12 | T12: the type-1 entry named `PlansHistory`, which does not exist. The real history component is `PlanHistoryList.tsx`, modified in place; names and verification command corrected. History is a table (Date, Focus, Sessions, Status, Actions) with glyph badges, a `first–last of total` pager, and an empty state linking to Today. Detail renders the selected revision read-only through `DayRail`/`AgendaList` (`buildRail`), with `WorkSessions`, Unplanned work and Unplaced work beside it. Revisions switch with a segmented control shown for two or more revisions, replacing the dropdown. The header carries the date, focus, sessions and saved time. Notices move to `PlanDetailNotices`. Recovery links go to `/today?date=`. `DailyPlanView` and `RevisionSelect` stay until T14. | material |
| 2026-11-13 | T13: `SettingsForm` and `MiniRail` replace `SchedulingPreferencesForm`. The preview reuses `buildRail` through a pure `typicalDay` builder and an additive `'mini'` density (0.6 px per minute), so Settings does not fork rail geometry. Minimum session stays in the Focus cadence card because the API requires it. Peak window and fixed breaks are kept from the old form. Pure helpers live in `settingsModel.ts`. The page heading is now "Settings" with a "Typical day" eyebrow, per the prototype; the routing test expectation changed to match. `SchedulingPreferencesForm` and its test are retired here instead of T14. No route, API, or hook change. | equivalent
