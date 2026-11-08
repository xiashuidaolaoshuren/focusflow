# FocusFlow — Implementation handoff

**Read first:** `DESIGN.md` (rules + state table), `tokens.css` (values), `index.html` (reference Today board).

**Stack:** React + Tailwind CSS v4 + shadcn/ui on base-ui. Paste the `:root` / `.dark` blocks from `tokens.css` into the global CSS, then un-comment its `@theme inline` bridge. Dark mode = `.dark` on `<html>`.

## Binding constraints

- **Colour:** tokens only, no raw hex in components. Amber (`--now`, `--peak`, `--peak-edge`) only on the now-line and Peak window. Semantic families: moss = done/on track, ochre = partly/at risk/medium, brick = overdue/high, terracotta = commitment.
- **Type:** Newsreader 28/36 for page titles and dates; Inter 12/13/14/16/20 for UI; JetBrains Mono 12–13 for clock times and durations. `tnum` on the root. Weights 400/500/600. ALL CAPS only for 12px eyebrows at 0.08em.
- **Shape:** radius 6px controls, 8px cards, 1px borders, `--input` for control outlines. Shadows only on popover, tooltip, dialog, sheet.
- **Space:** 4px base. Comfortable by default; Tasks and Horizon default to compact (32px rows). Rail: 1.6 px/min comfortable, 1.2 px/min compact.
- **Motion:** 150–200ms fades/slides, ease-out in, ease-in out, no bounce. Now-line animates `transform` only. Honour `prefers-reduced-motion`.

## Rail component

- Props: `workWindow`, `peakWindow`, `blocks[] {kind, start, end, taskId?, session?, outcome?, reconciled?}`, `now`, `density`.
- Block height = minutes × px/min − 2px; ≥ 44px stacks title over mono meta, otherwise single row.
- Cadence breaks: hatch, no text, tooltip on hover **and** focus.
- Every block is focusable and announces "Kind: title, 09:00–09:50, outcome".

## Assets

- Icons: one 16px outline family, 1.5px stroke, round caps (Lucide matches). Priority = flag fill level (empty / half / full).
- Fonts: self-host Newsreader, Inter, JetBrains Mono in production.
- No photography or illustration.

## Responsive

- ≥ 1180px: sidebar 224 · rail · side column 360.
- 768–1179px: side column stacks under the rail.
- < 768px: sidebar becomes a top bar; stats go 2 × 2; rail keeps full width, no horizontal scroll.

## The first artifact should prove

1. The rail reads at a glance in both themes: every block kind distinguishable in grayscale.
2. Now-line and Peak wash are the only warm marks on screen.
3. Shortfall, blocked and unplaced work are visible without reading a paragraph.
4. Keyboard alone reaches every block, popover, the density switch, Re-plan and the Regenerate dialog.
