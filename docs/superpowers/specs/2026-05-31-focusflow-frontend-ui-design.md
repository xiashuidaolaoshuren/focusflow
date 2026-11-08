# FocusFlow AI Frontend UI Design

Date: 2026-05-31

> **Superseded 2026-11-08.** The visual, navigation, and interaction decisions in this document are replaced by [`2026-11-08-focusflow-frontend-redesign-design.md`](2026-11-08-focusflow-frontend-redesign-design.md). Keep this file for the M2 history and for the toast, alert, confirmation, and loading-state patterns that remain valid where they do not conflict with the new direction.

**Parent spec:** `docs/superpowers/specs/2026-05-14-focusflow-ai-design.md`
**Related plan:** `docs/superpowers/plans/2026-05-14-focusflow-ai-m2-frontend-plan.md`

## Purpose

The parent FocusFlow AI design covers product scope, backend architecture, the API contract, and auth. It does **not** define the visual and interaction design of the React SPA. This document fills that gap: it specifies the look-and-feel, navigation, screen layouts, interaction patterns, and UI state conventions for the Milestone 2 frontend.

This is a design document, not an implementation plan. It guides subtasks F4–F15 in the M2 frontend plan. It does not change the approved stack (React, Vite, TypeScript, shadcn/ui, Tailwind CSS, React Router, TanStack Query) and does not alter backend behavior.

## Goals And Non-Goals

Goals:

- Define a single, consistent visual direction so feature work stays coherent.
- Specify the app shell, navigation, and the layout of every route.
- Define interaction patterns (task editing, feedback, confirmations) and UI state conventions (loading, empty, error).
- Keep the design beginner-friendly and achievable with shadcn/ui primitives, in service of the project's Java-first learning goal.

Non-Goals:

- No full design system, design tokens beyond Tailwind/shadcn CSS variables, or component library authoring.
- No animation systems, marketing pages, onboarding tours, or theming editor.
- No visual regression tooling in this milestone.
- No change to product scope, routes, or the API contract from the parent spec.

## Design Direction

Modern and polished, with a calm and focused feel. Card-based surfaces with subtle borders and soft shadows, generous spacing, and a single distinct accent color. The interface should read like a quiet productivity tool rather than a dense analytics dashboard.

Principles:

- Clarity over decoration. Every screen has an obvious primary action.
- One accent color used intentionally (primary actions, active nav, focus rings).
- Consistent spacing, radius, and elevation across all screens.
- Every data view explicitly handles loading, empty, error, and loaded states.

## Visual Language

- **Accent / primary:** indigo–violet. The scaffolded theme in `src/index.css` currently uses a neutral grayscale `--primary` (`oklch(0.205 0 0)`). This design overrides `--primary`, `--primary-foreground`, `--ring`, and `--sidebar-primary` with an indigo–violet hue (around `oklch(0.49 0.24 264)`) in both `:root` and `.dark`, keeping neutrals for surfaces and text.
- **Neutrals:** the existing neutral `baseColor` is retained for `background`, `card`, `muted`, `border`, and text.
- **Theme modes:** light and dark, both already defined as CSS variables in `src/index.css`. A manual toggle controls the `.dark` class on the root element. Initial mode follows the system preference; the user's explicit choice is persisted (e.g. via a small theme store backed by `localStorage`). Persisting only the UI theme preference does not violate the "no auth tokens in local storage" rule from the parent spec.
- **Radius:** keep the scaffolded `--radius: 0.625rem`; cards and sheets use `rounded-lg`/`rounded-xl`.
- **Elevation:** subtle shadows on cards, popovers, sheets, and dialogs; flat surfaces elsewhere. Dividers use `border-border`.
- **Typography:** one clean sans-serif (Inter or the system sans stack), a clear type scale, and comfortable line-height. Headings are weighted, body text uses `foreground`, secondary text uses `muted-foreground`.
- **Icons:** `lucide` (already configured in `components.json`).
- **Priority and status color coding:** priority badges are color-coded (low / medium / high) and task status uses a small set of consistent badge styles. These map to dedicated, theme-aware utility styles rather than ad hoc colors.

## App Shell And Navigation

Authenticated routes use a **left sidebar** layout, replacing the current centered top nav in `AppLayout`. The scaffolded theme already includes `--sidebar*` CSS variables, so the sidebar is theme-ready.

```
+------------+-----------------------------------+
| FocusFlow  |  Page content                     |
|            |  (centered max-width, padded)     |
| > Dashboard|                                   |
| > Plans    |                                   |
|            |                                   |
| ---------- |                                   |
| [theme]    |                                   |
| [user v]   |  <- email + Logout                |
+------------+-----------------------------------+
```

- **Sidebar:** brand/wordmark at top; primary nav links (Dashboard, Plans) with a clear active state using the accent; a footer region containing the **theme toggle** and a **user menu** (current user's email with a Logout action).
- **Responsive:** below the `md` breakpoint the sidebar collapses. A top bar with a hamburger button opens the sidebar as a slide-in sheet, and main content becomes full-width.
- **Public layout** (`PublicLayout`, used by login/register): a centered card on a clean background with the FocusFlow brand displayed above the card. No sidebar. Keeps the existing simple structure but centers the auth card vertically.

## Screens

### Login (`/login`) and Register (`/register`)

- Centered auth card inside `PublicLayout`.
- Card contains a title, short description, the form fields, a primary submit button (full width), and a link to the other auth route.
- Validation errors render inline at the field level, mirroring backend `400` responses. A general error (e.g. invalid credentials) renders as an alert at the top of the card.
- Submit button shows a loading/disabled state during the request. On success, redirect to `/dashboard`.

### Dashboard (`/dashboard`)

Two-column layout; collapses to a single column (task list first) below `md`.

- **Left column (primary): task list.**
  - A header row with the page title and a primary **"New Task"** button.
  - Each task renders as a row/card showing: title, a color-coded **priority badge**, due date, status, and estimated minutes. Row actions (edit, delete, status change) are accessible per task.
  - States: skeleton rows while loading; a friendly empty state ("No tasks yet — create your first one") with a CTA; an inline error alert with retry on fetch failure.
- **Right column: planning.**
  - A **"Generate Today's Plan"** card: an available-focus-time input and a generate button with a loading state. Provider/`502` errors render as an inline alert within the card.
  - Below it, **today's plan** (if one exists) rendered with the timeline component (see Plan Detail).

### Plan History (`/plans`)

- A list of saved plans, each item showing the plan date and a short summary (e.g. item count / total minutes), linking to its detail page.
- Skeleton list while loading; empty state when the user has no saved plans; inline error with retry on failure.

### Plan Detail (`/plans/:id`)

- The plan rendered as a **vertical timeline**: ordered blocks down the page, each block showing the associated task title and the suggested focus minutes, in plan order.
- Header shows the plan date. Loading shows skeleton blocks; a missing/`404` plan shows a "Plan not found" state with a link back to `/plans`.

## Interaction Patterns

### Task create and edit

- A **right-side sheet/drawer** holds the task form. The same sheet is used for create (empty) and edit (prefilled), opened from the "New Task" button or a task's edit action.
- The sheet slides in over the dashboard so the task list stays visible behind it.
- Form fields map to the task DTO: title, description, priority, due date, status, and optional estimated minutes. Field-level validation mirrors backend `400` responses.
- On successful save, close the sheet, invalidate the task query, and show a success toast.

### Feedback and confirmation

- **Toasts** (shadcn `sonner`) confirm success and report errors for save, delete, and plan generation.
- **Confirm dialog** before destructive actions. Deleting a task opens a confirmation dialog; only on confirm is the delete sent.
- Mutations disable their trigger button and show a spinner while in flight.

### UI state conventions

Every list and page defines four states explicitly:

- **Loading:** skeleton placeholders for lists and timelines; spinner + disabled button for mutations.
- **Empty:** an icon, a short message, and a clear CTA where an action makes sense.
- **Error:** inline alert with a retry action for failed queries; field-level messages for form validation.
- **Loaded:** the normal content.

## State Management Boundaries

Consistent with the parent spec and M2 plan:

- **Server state** lives in TanStack Query: current user, task list, saved plans, plan detail. Mutations invalidate the relevant queries.
- **Local React state** is reserved for UI concerns only: sheet open/close, form draft values, confirm-dialog visibility, active filters/tabs, and the theme preference.
- No Redux, no SSR, and no duplication of backend authorization in the client.

## Component Inventory

Existing shadcn/ui components in the repo: `button`, `card`, `input`, `label`, `field`, `form`, `alert`, `separator`.

Additional shadcn/ui components this design introduces (added as feature work reaches them):

- `sheet` — task create/edit drawer.
- `dialog` (alert dialog) — delete confirmation.
- `dropdown-menu` — sidebar user menu and per-task actions.
- `sonner` (toaster) — global toast notifications.
- `badge` — priority and status indicators.
- `skeleton` — loading placeholders.
- `select` and/or `calendar`/date input — task form fields (priority, status, due date) as needed.
- `avatar` (optional) — user menu affordance.

A `sidebar` implementation (custom or shadcn `sidebar`) provides the authenticated app shell. The global toaster mounts once near the app root.

## Accessibility Baseline

- All form fields have associated labels; icon-only buttons (theme toggle, menu triggers) have `aria-label`s.
- Visible focus rings using the accent `ring` color in both themes.
- Sheets, dialogs, and menus are keyboard-navigable with focus trapping and Escape-to-close (handled by the base-ui primitives under shadcn).
- Color contrast meets a reasonable baseline in both light and dark themes; color is never the only signal (badges include text labels).
- This baseline is verified during F15 (polish and accessibility pass).

## Mapping To The M2 Plan

This design refines, but does not replace, the file map in `2026-05-14-focusflow-ai-m2-frontend-plan.md`:

- `components/layout/AppLayout.tsx` becomes the sidebar shell with theme toggle and user menu.
- `components/layout/PublicLayout.tsx` centers the auth card.
- `features/tasks/*` implements the list rows, the sheet-based `TaskForm`, and `TaskActions` (edit/delete/status with confirm dialog and toasts).
- `features/plans/*` implements the generate card, the timeline-based `DailyPlanView`, and `PlanHistoryList`.
- New `components/ui/*` entries are added per the component inventory above.
- A small theme module (provider/toggle + persisted preference) is added to support light/dark.

Affected subtasks: **F3b** (align shell with sidebar, theme toggle, and accent), F7 (auth screen layout), F9–F11 (task list/sheet/actions), F12 (generate card), F13–F14 (history list and timeline), and F15 (accessibility/polish).

## Open Questions

- Exact indigo–violet shade and whether the dark-mode `--sidebar-primary` (already an indigo-ish value) should match the light-mode primary precisely.
- Whether due-date entry uses a native date input or a shadcn calendar/date picker (decided when building `TaskForm`).
