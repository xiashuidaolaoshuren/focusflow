# FocusFlow prototype — notes

Open `index.html`. No build step. Files:

| File | Role |
|---|---|
| `index.html` | Entry. Applies the saved theme before first paint, loads fonts, tokens and scripts |
| `tokens.css` | Approved tokens (unchanged) |
| `app.css` | Components and screens, tokens only |
| `js/core.js` | Utilities, icons, sample data, planner, Horizon forecast, UI kit (dialogs, popovers, toasts) |
| `js/views.js` | Screen markup |
| `js/app.js` | Router, shell, actions, demo switcher, real-time now-line |
| `today-board.html` | The approved two-theme Today board, kept as a reference |

## Screen map

| Route | Screen |
|---|---|
| `#/` | Today when signed in, Sign in when signed out |
| `#/signin`, `#/signup` | Sign in / Create account |
| `#/today` | Today (desktop rail; agenda list below 760px) |
| `#/tasks` | Tasks inventory; rows open the Task editor sheet |
| `#/horizon` | Horizon, 7 Working days (vertical day list below 760px) |
| `#/plans` | Plan history |
| `#/plans/today`, `#/plans/p-1105`, `#/plans/p-1104`, `#/plans/p-1103` | Plan detail |
| `#/settings` | Settings with live typical-day preview |
| anything else | 404 |

Navigation updates the URL when the preview allows it, but views are driven by in-memory state, so links and buttons work even in a sandbox that blocks URL changes.

## Reaching each state

**Demo switcher** (dashed "DEMO" button, bottom-left; top-right on mobile). It is a prototype control, not product UI.

| Control | Effect |
|---|---|
| Today → Plan with progress | Approved sample day (resets tasks, plan, commitments). Header shows **Re-plan** only |
| Today → No plan yet | Empty rail with **Generate**; no Plan health panel |
| Today → Needs refresh | Approved day + Needs refresh alert. Header shows **Re-plan** only |
| Today → Past day | Thu 5 Nov, read-only (also via the ‹ arrow next to the date) |
| Lists → Loading / Error / Empty | Tasks, Horizon and Plans show skeletons, an error with Retry, or their empty state |
| Next request → Outcome save conflicts (409) | Next Record outcome save shows the conflict alert with **Refresh plan** |
| Next request → Request fails | Next Re-plan, task save, Settings save or sign-in fails with an error |
| App error | App-wide error screen with Reload |
| Reset data | Restores all sample data |

**Through the UI**

- **Header actions**: **Regenerate** appears only while the Daily plan has no recorded Work outcome (e.g. right after **Generate** in "No plan yet"). As soon as any outcome is recorded the header shows **Re-plan** only.
- **Record outcome**: click any work block (or agenda row on mobile). A block without an outcome opens with nothing selected and **Save outcome** disabled until you choose Done, Partly done or Skipped; the summary fills in only after a choice. A block with an outcome opens with it selected. The block that crosses *now* (Write Q4 report draft, 13:30–14:20) opens the **Reconcile elapsed portion** variant, under the same rule; the unelapsed remainder stays planned.
- **Time fields** (Commitments, Work window, Peak window, Fixed breaks) are English-only 24-hour `HH:MM` text fields: type `0930` or `9:30`, or use ArrowUp/ArrowDown (5 min; Shift = 60 min). Invalid values show an inline error.
- **Due date** (Task editor) shows English dates like `7 Nov 2026`; type `2026-11-07`, `7 Nov 2026` or `7 Nov`, or use the calendar button (arrow keys, Home/End, Enter, Esc).
- **Needs refresh** also appears after editing a Commitment, saving a Task, recording a partly/skipped outcome, reassessing, or saving Settings.
- **Commitments**: pencil = inline edit, bin = inline confirm, Add = inline form. Overlaps, out-of-window times and empty names are rejected.
- **Overlap cue**: move a Commitment over a planned work block; the block shows "Overlaps" until Re-plan.
- **Task editor**: Tasks → any title, or **New task**. Try adding *Fix login redirect bug* as a blocker of *Review PR #42* to see the cycle error. Edit a field, then Cancel/Esc to see the discard warning. Enter estimate `3` and clear the title, then Save, to see the error summary.
- **Sign in / Create account** are real forms: Enter submits, and password managers can fill them. API error: password `wrong`, or turn on "Request fails".
- **Sign out**: user menu at the bottom of the sidebar.
- **Mobile navigation** (below 760px): the menu button opens the drawer over a scrim. The page behind is inert and does not scroll; Tab stays in the drawer; scrim click or Esc closes it and returns focus to the menu button.
- **Plans**: page 2 holds the oldest plan; Today's plan shows the Rev 1 / Rev 2 switcher. Bin icon → delete confirmation.
- **Horizon blocker highlight**: hover or tab to *Fix login redirect bug*; *Review PR #42* is highlighted as its blocker.
- **Settings**: change any value to update the mini-rail preview; invalid values show inline errors on blur. "Defaults apply until saved" disappears after the first Save. **Enable focus cadence** (in Focus cadence, on by default): when off, Focus session and Cadence break are hidden, the preview and the planner place no cadence breaks and no session cap, and Save stores `cadenceEnabled: false` with no session or cadence-break length.
- **Plan detail and past day** list **Work sessions** grouped as Recorded, Not recorded and No longer needed.
- **404**: open `#/nowhere`.

## Mock behaviour

- **Clock**: the demo day is Friday 6 November 2026. The now-line starts at 14:10 and advances in real time; stats, "In progress · Xm left" and Commitment countdowns update each minute.
- **Planner** (Generate / Re-plan / Regenerate): keeps recorded and elapsed blocks, then fills free time from now. Order: work that unblocks other tasks, then earliest due date, then priority. With focus cadence on, sessions are capped at the Focus session length and a cadence break follows once continuous work reaches it; with it off, work fills each free slot without breaks. Re-plan keeps the in-progress block; Regenerate cuts it at now. On the sample data Re-plan reproduces the approved afternoon exactly.
- **Shortfall** = remaining effort of tasks due today or tomorrow that does not fit (10m of Prepare client slides). Other overflow rolls to the Horizon.
- **Remaining effort** is live: the task's unrecorded effort minus time already elapsed in its current block (Write Q4 report draft shows 10m of 120m at 14:10).
- **Horizon**: the saved day uses recorded minutes plus the planned remainder. Forecast days use 80% of the typical day from Settings, as stated in the ⓘ pace popover.
- **Persistence**: theme, sidebar state, sign-in state and saved Settings persist in localStorage (with an in-memory fallback). Tasks, plans and commitments reset on reload.
- **Busy states**: 450–700ms simulated latency; first visit to Tasks, Horizon and Plans shows a skeleton.
- **Dialogs and the sheet** use native modal dialogs plus an explicit Tab trap; Esc closes them (the sheet asks first when there are unsaved changes), and focus returns to the trigger or its re-rendered equivalent.

## Sample data added beyond the brief

- Tasks: *Write team onboarding handbook* (Low, 2400m, due 30 Nov — shows **Beyond horizon**), *Send October invoices* and *Draft November newsletter* (Done), *Migrate CI to new runner* (Cancelled).
- Plans: Thu 5 Nov (complete, one unplanned item, one "No longer needed" outcome), Wed 4 Nov (Shortfall, two revisions), Tue 3 Nov (Needs refresh, unrecorded blocks).
- Commitment added on Thu 5 Nov: *Quarterly review*. Wed 4 Nov: *Interview: backend candidate*, *Support rota*.
- User: Robin Hale, robin@example.com.

## Deviations from DESIGN.md

| Item | Change | Why |
|---|---|---|
| Overlay and skeleton fills | Added `--scrim` and `--skeleton` (per theme, in `app.css`) | Not in the token contract; needed for dialog backdrops and loading states |
| Segmented control (density, revisions) | Selected segment uses the accent fill + 1px ink ring instead of the solid ink fill used on the approved board | Keeps Re-plan as the only solid control in view |
| Regenerate | Offered only while the Daily plan has no recorded Work outcome; otherwise hidden, so the header shows Re-plan only | Regeneration must not rebuild a day that already has recorded work |
| Deadline forecast on Today's Tasks list | Shown only for tasks with a due date, as on the approved board; the Tasks page and Horizon also show **Can't forecast** for tasks without an estimate | Today stays quiet; the inventory shows every state |
| Overdue | No sample task is overdue; the state is in every forecast legend | Adding one would change the approved 10m shortfall |
| Planner | Places by unblocking, due date and priority; it does not yet pull high-priority work into the Peak window | Keeps Re-plan consistent with the approved afternoon |
| Time and date inputs | Custom English 24-hour time fields and an English date field with calendar replace native time/date inputs | Native pickers follow the browser locale (e.g. 上午/下午 on zh-CN) |
| Focus cadence | Settings gain `cadenceEnabled` (default on) with a switch styled from the approved tokens | Matches the existing Settings API |
| Fonts | Loaded from Google Fonts | As specified; self-host in production |
