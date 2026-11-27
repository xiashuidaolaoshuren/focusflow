# FocusFlow — DESIGN.md

**Direction: "Paper & Ink, instrument-grade."** A well-made paper day planner with the rigour of a professional tool. Calm, precise, honest about time. Not urgent, not gamified, not a SaaS dashboard.

Source of truth for values: `tokens.css` (light on `:root`, dark on `.dark`, Tailwind v4 `@theme inline` bridge included). Reference implementation: `index.html` (Today board, light + dark).

---

## 1. Visual Theme & Atmosphere

- **Paper and ink.** Warm paper surfaces, ink text, 1px hairline rules, one deep ink-blue accent. Structure comes from borders and alignment, never from shadows.
- **Instrument-grade.** Tabular numerals everywhere, mono for clock times and durations, a compact density mode, clear focus rings, and a dark theme tuned on its own terms (not an inversion).
- **Daylight is the only warm hue.** Amber appears in exactly two places: the live **now-line** and the **Peak window** wash plus its margin marker. Every other colour is semantic. Hue is never decoration.
- **Signature element: the vertical day rail.** It is the most polished surface in the product and the brand motif (the logo is a rail with two blocks).

## 2. Color

All pairs checked against WCAG 2.2 AA: body text ≥ 4.5:1, large text / icons / control outlines ≥ 3:1. Ratios are given on the surface they are used on.

### Core (shadcn names)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `#F6F4EF` | `#161513` | paper / night paper |
| `--foreground` | `#1C1B19` | `#EDEAE3` | 15.7:1 / 15.2:1 |
| `--card` / `--card-foreground` | `#FFFFFF` / `#1C1B19` | `#1F1D1A` / `#EDEAE3` | |
| `--popover` | `#FFFFFF` | `#24221E` | dark popover sits one step above card |
| `--primary` | `#2B4C7E` | `#8FAAD6` | 7.8:1 on paper / 7.7:1 on night |
| `--primary-foreground` | `#F6F4EF` | `#161513` | 7.8:1 / 7.7:1 |
| `--secondary` | `#EFECE5` | `#26241F` | quiet button / hover fill |
| `--muted` | `#ECE9E2` | `#24221E` | |
| `--muted-foreground` | `#6B675F` | `#A39E94` | 5.1:1 paper, 5.6:1 card, 4.6:1 muted / 6.8:1, 6.3:1 card |
| `--accent` | `#EBEFF5` | `#252D3A` | ink-blue tint: selected nav, row hover |
| `--border` | `#E4E0D7` | `#2F2C27` | decorative hairline only — never the sole boundary of an input |
| `--input` | `#8C877C` | `#736D62` | control outline, 3.3:1 both themes |
| `--ring` | `#2B4C7E` | `#8FAAD6` | 2px ring, 2px offset |
| `--destructive` | `#A83A2E` | `#D9705F` | 6.4:1 card / 5.2:1 card |
| `--radius` | `6px` | `6px` | cards = `calc(var(--radius) + 2px)` = 8px |

### Daylight

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--now` | `#C2661F` | `#F2A65A` | now-line; 3.7:1 / 9.0:1 |
| `--now-strong` / `--now-foreground` | `#A3531A` / `#FFFFFF` | `#F2A65A` / `#161513` | time pill; 5.5:1 / 9.0:1 |
| `--peak` | `#F2A65A` @ 12% | `#F2A65A` @ 10% | wash behind the rail |
| `--peak-edge` | `#C2661F` | `#F2A65A` | 3px margin marker in the time gutter |

### Rail blocks

| Token | Light | Dark |
|---|---|---|
| `--block-work` | `#EBEFF5` | `#232A35` |
| `--block-work-edge` | `#2B4C7E` | `#8FAAD6` |
| `--block-cadence` (hatch stroke) | `#CFC9BD` | `#3A362F` |
| `--block-fixed` | `#ECE9E2` | `#2A2824` |
| `--block-commitment` (terracotta) | `#B4532A` | `#D07A52` |
| `--block-buffer` (dotted outline) | `#8C877C` | `#736D62` |

### Semantic families

| Family | Light | Dark | Tokens |
|---|---|---|---|
| Moss — done, on track | `#4F7A4A` | `#8DB585` | `--outcome-done` `--deadline-on-track` `--status-done` |
| Ochre — partly, at risk, medium | `#8F5E14` | `#D9A54A` | `--outcome-partly` `--deadline-at-risk` `--priority-medium` |
| Brick — overdue, high | `#A83A2E` | `#D9705F` | `--deadline-overdue` `--priority-high` |
| Ink — in progress | `#2B4C7E` | `#8FAAD6` | `--status-in-progress` |
| Neutral — skipped, unknown, low, open, cancelled | `#6B675F` | `#A39E94` | `--outcome-skipped` `--deadline-unknown` `--priority-low` `--status-open` `--status-cancelled` |

### Changes from the starting palette

| Value | Was | Now | Why |
|---|---|---|---|
| Light now-line | `#E0873A` | `#C2661F` | 2.5:1 on paper failed the 3:1 non-text minimum |
| Light now pill | — | `#A3531A` + white | 12px time label needs 4.5:1 |
| Light ochre | `#B7791F` | `#8F5E14` | 3.6:1 failed for 12–13px labels |
| Input outline | (border) | `#8C877C` / `#736D62` | `--border` is 1.2:1, too faint to mark a control |

## 3. Typography

| Role | Face | Size / line | Weight | Tracking |
|---|---|---|---|---|
| Page title, date | Newsreader | 28 / 36 | 500 | −0.01em |
| Display (empty states, Horizon week) | Newsreader | 36 / 44 | 500 | −0.02em |
| Section / card title | Inter | 14 / 20 | 600 | 0 |
| Dialog title | Inter | 16 / 24 | 600 | 0 |
| Stat value | JetBrains Mono | 20 / 28 | 500 | −0.01em |
| UI body | Inter | 14 / 21 | 400 | 0 |
| Labels, buttons, block titles | Inter | 13 / 18 | 500 | 0.02em (buttons) |
| Caption, meta | Inter | 12 / 16 | 400–500 | 0.01em |
| Eyebrow (ALL CAPS) | Inter | 12 / 16 | 500 | **0.08em** |
| Clock times, durations | JetBrains Mono (Geist Mono alt.) | 12–13 / 16 | 400–500 | 0 |

- Scale is closed: **12, 13, 14, 16, 20, 28, 36**. No other sizes.
- `font-feature-settings: "tnum" 1, "lnum" 1` on the app root, so every number is tabular.
- Three weights: 400 read, 500 emphasise, 600 announce. No 700.
- Fallbacks: Newsreader → Iowan Old Style → Georgia; Inter → system UI; JetBrains Mono → Geist Mono → ui-monospace.
- Body copy max 65ch; the product rarely needs paragraphs (see §8).

## 4. Spacing & Grid

- 4px base. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- **Comfortable** (default): rows 40px, card padding 16px, rail 1.6 px/min (09:00–18:00 = 864px).
- **Compact** (default for Tasks and Horizon; optional on the rail): rows 32px, vertical padding 8px, rail 1.2 px/min. Compact never shrinks type.
- Desktop: sidebar 224px · main column fluid · side column 360px · 24px gutter. Page padding 24/32px.
- Breakpoints 1440 / 1180 (side column stacks under the rail) / 768 (sidebar becomes a top bar) / 375.

## 5. Layout & Composition

- **Today** reads left → right: navigation, then the **rail** (the hero), then the column that explains the plan: Plan health → Commitments → Tasks.
- Header: eyebrow "Daily plan", date in Newsreader, one meta line (Work window · Trailing buffer · Re-planned hh:mm), density switch, **Regenerate** (outline) and **Re-plan** (the only solid button in view).
- A four-figure stats strip (Planned focus · Done · Left today · Shortfall), divided by hairlines, mono values.
- **Rail anatomy:** 64px time gutter (hour labels in mono, Peak margin marker on its inner edge) + track (hour hairlines, dotted half-hours, peak wash, blocks inset 8px). The now-line spans gutter and track; its pill sits in the gutter and hides the adjacent hour label.
- Blocks taller than 44px stack title over a mono meta line; shorter blocks become a single row (title · time · outcome). Cadence breaks carry no visible text.

## 6. Components

All components consume tokens only. Control radius 6px, card radius 8px, 1px borders. Shadows only on popover, tooltip, dialog, sheet: `--shadow-popover`.

### Semantic state table

Every state has a non-colour cue (shape, pattern, glyph or text). Colour only reinforces it.

**Block kinds**

| Kind | Fill | Edge | Content | Non-colour cue |
|---|---|---|---|---|
| Work | `--block-work` | 3px solid `--block-work-edge` left | task title + time range; "session 2 of 3" when split | solid left edge + text |
| Cadence break | 135° hatch, 1px `--block-cadence` every 6px | none | none; tooltip on hover/focus "Cadence break · 09:50–10:00" | hatch pattern |
| Fixed break | `--block-fixed` | none | label ("Lunch") + "Fixed break" | quiet solid fill + label |
| Commitment | `--card` | 1.5px solid `--block-commitment` | label + "Unavailable" with ⊘ | outline + ⊘ glyph + word |
| Trailing buffer | transparent | 1.5px dotted `--block-buffer` | "Trailing buffer" (muted) | dotted outline |
| Peak window | `--peak` wash behind the track | 3px `--peak-edge` gutter marker | header chip "Peak window 09:30–12:00" | margin bar + label |
| Now | — | 2px `--now` line, 8px dot | mono pill "14:10" | line + time text |
| In-progress block | work fill | +1px `--block-work-edge` outline | "In progress · 10m left" | ring + text |

**Outcomes** (on work blocks, right edge, 12px)

| Outcome | Glyph | Treatment |
|---|---|---|
| Done | ✓ in circle | `--outcome-done` label "Done" |
| Partly done | half-filled circle | `--outcome-partly`, "Partly · 15 of 45m" |
| Skipped | double chevron | title struck through, fill at 45%, edge muted, "Skipped" |
| No longer needed | dashed circle | dashed block outline, muted text, "No longer needed" |
| Reconciled | return arrow | small muted marker "Reconciled" on the block that received the remainder |

**Deadline forecast** (badge: glyph + word + due)

| State | Glyph | Token |
|---|---|---|
| On track | ✓ | `--deadline-on-track` |
| At risk | △ | `--deadline-at-risk` |
| Overdue | octagon ! | `--deadline-overdue` |
| Can't forecast | ? in circle | `--deadline-unknown` |
| Beyond horizon | → | `--deadline-unknown` |

**Plan health**

| State | Pattern |
|---|---|
| Shortfall | Alert: ochre 1px border, 6% ochre tint, △ icon, title "Shortfall · 10m", one data line, ⓘ for explanation |
| Needs refresh | Neutral alert with ↻ icon, title "Needs refresh", action **Re-plan** (outline) |
| Blocked work | Row with link icon; on the task: "Waiting on Review PR #42" |
| Unplaced work | Row with inbox icon; on the task: dashed "Unplaced" badge |

**Task**

| Attribute | Treatment |
|---|---|
| Status Open / In progress / Done / Cancelled | outline badge: ○ / ◉ / ✓○ / ⊗ + word; Cancelled label struck through |
| Priority Low / Medium / High | flag icon with **fill level**: empty / lower half / full, plus colour; screen-reader text "High priority" |
| Remaining effort | mono, right-aligned: "10m" over "of 120m"; "—" over "No estimate" |

### Component rules

- **Button**: 32px tall (36px comfortable forms), 12px horizontal padding, 13px/500, 0.02em tracking. Variants: *primary* (ink fill; one per view), *outline* (card fill, `--input` border), *ghost*, *destructive* (only inside a confirming dialog). Hover darkens toward ink (light) or lifts toward paper (dark) via `color-mix`; never lightens text to gray. Busy: spinner + "Re-planning…", `aria-busy`, muted fill. Disabled: `--muted` fill + `--muted-foreground` text.
- **Input**: 32px, `--card` fill, 1px `--input` border, 6px radius, persistent label above (13px/500), helper or error below (12px). Error: `--destructive` border + message that states the fix. Numbers (Remaining effort, minutes) right-aligned, tabular, unit suffix "min".
- **Select**: same box as Input with a chevron; popover list uses `--popover`, 32px options, check glyph on the selected item, `--accent` on highlight.
- **Badge**: 20px, 6px padding, 4px radius, 1px `--border`, 12px/500. Glyph + word, colour from the semantic token. Never a filled colour pill.
- **Card**: `--card`, 1px `--border`, 8px radius, no shadow. Head 48px with 14px/600 title, optional mono count, ⓘ at the end.
- **Dialog**: 400px max, `--popover`, 8px radius, `--shadow-popover`, backdrop ink at 36%. Title 16/600, one-line description, footer with ghost Cancel + one primary. Initial focus on Cancel; focus returns to the trigger on every close path. Enter 200ms fade + 6px rise.
- **Sheet**: right side, 400px, `--popover`, hairline left border, `--shadow-popover`; for editing a Task. Slide 200ms in / 140ms out. Same header/footer rules as Dialog.
- **Alert**: 1px semantic border + 6% semantic tint over card, 16px glyph, 14/600 title, one data line in muted. Explanations go behind ⓘ, never in the alert body.
- **Tooltip**: 12px, `--popover`, 1px border, 4px radius, 2px × 8px padding, appears on hover **and** keyboard focus after 0ms (rail) / 300ms (elsewhere). Content is a label, not a sentence.
- **Popover (info ⓘ)**: 300px, 12/16px padding, title 13/600 + at most two short sentences or a legend list. Opens on click; Esc and outside click close; Esc returns focus to the ⓘ button.
- **Sidebar**: 224px, paper background, hairline right border. Wordmark in Newsreader 20. Items 36px, 16px icons, 14/500 muted; current item = `--accent` fill + 600 weight + 2px ink bar on the left (non-colour cue). Footer shows the Working day and Work window.
- **Corrective row action** (Plan health sub-rows): a sub-row indented under its summary row (dotted hairline), title + muted reason from the saved plan, and at most one outline-small action on the right ("Add estimate", "Set remaining effort"). Never solid. No action when the live task no longer needs one.
- **Assisted suggestion (AI estimate)**: requested only by an explicit outline-small "Suggest with AI" button below the field it fills, with a one-line muted disclosure of what is sent. Loading = spinner + "Suggesting…" with `aria-busy`; the field stays editable. Result = hairline box on card fill: caps label "Suggested estimate", mono figure, "Not saved until you Save", one-sentence reason, "Similar to" list (title · est · took, mono). Errors use the field error style and are tied to the field. A reply that arrives after the user has edited the task is dropped with one muted line. No sparkle icons, gradients, glows or coloured badges: AI content is marked with words only.

## 7. Motion & Interaction

- Fades and slides only: 150ms (hover, popover, tooltip), 200ms (dialog, sheet), exits at ~120–140ms. Ease-out on enter, ease-in on exit. No bounce, no spring, no scale-up.
- The now-line moves in real time (`transform` only, linear 200ms between ticks). The adjacent hour label fades out while the pill covers it.
- Re-plan: button shows a spinner and "Re-planning…", then a one-line status confirms the result ("No changes needed · Daily plan is current · 14:10").
- Focus: 2px `--ring`, 2px offset on every interactive element, including rail blocks (each block is focusable and announces kind, task, time and outcome).
- `prefers-reduced-motion`: transitions collapse to instant; the now-line still updates position.

## 8. Voice & Brand

- Short labels. No sentences on the page; explanations live behind an ⓘ popover.
- Use the product terms exactly: **Task, Remaining effort, Work window, Peak window, Commitment, Fixed break, Trailing buffer, Daily plan, Re-plan, Regenerate, Horizon, Working day.**
- Numbers are plain and honest: "Shortfall · 10m", "80 of 90m placed", "In 1h 50m". No percentages for effort, no streaks, no praise.
- Times are 24-hour, mono, en-dash ranges: `09:00–09:50`. Durations: `50m`, `1h 25m`.

## 9. Anti-patterns

- Amber anywhere except the now-line and the Peak window (no amber buttons, badges, charts or logo).
- Hue as decoration: no coloured section headers, tinted cards or rainbow task categories.
- Shadows on cards or rail blocks; gradients other than the cadence hatch; glass; glows.
- Status shown by colour alone: every state keeps its glyph, pattern or word.
- Gamification: streaks, confetti, scores, "You crushed it!".
- Urgency styling: red banners for ordinary at-risk work, pulsing dots, countdown timers.
- Proportional (non-tabular) numerals, or clock times in Inter.
- Paragraph copy on the page; help text belongs behind ⓘ.
- Two solid buttons in one view; hover that turns text lighter or gray.
- Newsreader for UI labels, or Inter for page titles.
- Radius above 8px, pill-shaped buttons, or a coloured left-border callout card (the left edge is reserved for Work blocks).
- Synonyms for product terms ("break" for Fixed break, "meeting" for Commitment, "refresh" for Re-plan).
