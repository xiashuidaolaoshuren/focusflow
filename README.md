# FocusFlow AI

FocusFlow AI is a Java-first full-stack learning project. The Spring Boot backend manages tasks and AI-assisted daily plans; the React/Vite frontend provides the browser experience.

## Prerequisites

- Java 21 (JDK)
- Docker Desktop (for local PostgreSQL)
- Node.js LTS and npm (for the React frontend)
- Git

The Gradle wrapper is included, so a global Gradle installation is not required. The backend targets Java 21. On Gradle 9, the included Foojay toolchain resolver can provision Java 21 when it is not installed locally.

## Quick start

1. Clone the repository, then copy the environment template at the repository root:

   ```powershell
   copy .env.example .env
   ```

2. Start PostgreSQL:

   ```powershell
   docker compose up -d
   ```

3. Set AI provider variables in `.env` if you want live plan generation. They are optional for registration, login, and task CRUD:

   ```env
   OPENAI_API_KEY=your-provider-key
   OPENAI_MODEL=gpt-4.1-mini
   OPENAI_BASE_URL=https://api.openai.com/v1
   ```

   For DeepSeek (OpenAI-compatible):

   ```env
   OPENAI_API_KEY=your-deepseek-key
   OPENAI_MODEL=deepseek-chat
   OPENAI_BASE_URL=https://api.deepseek.com/v1
   ```

   `.\gradlew.bat bootRun` loads the repo-root `.env` into the Spring process automatically. You do not need `echo $env:OPENAI_*` to show values in your shell; restart `bootRun` after editing `.env`. Shell or CI environment variables still take precedence when set.

4. In one terminal, run the backend. On a fresh PostgreSQL database, Flyway applies migrations automatically at startup (`V1__baseline.sql`, then `V2__scheduling_foundations.sql`, then `V3__scheduled_day.sql`). Do not set `SPRING_JPA_HIBERNATE_DDL_AUTO=update` — schema changes belong in Flyway migrations under `backend/src/main/resources/db/migration/`.

   **V2 note:** `V2__scheduling_foundations.sql` adds scheduling preferences, fixed breaks, and commitments tables. It also converts any legacy `tasks.estimated_minutes` values of zero or below to `NULL`, then enforces that estimates must be null or positive.

   **V3 warning (backup first):** `V3__scheduled_day.sql` is destructive for Daily plans. It deletes every row in `daily_plans` and `daily_plan_items`, drops the legacy item/warning columns, and replaces them with scheduled-day tasks and clock blocks. Tasks, users, preferences, and commitments are kept. **Back up the database before upgrading any database that contains Daily plans you care about.**

   **V5 note:** `V5__progress_and_revisions.sql` is non-destructive. It keeps Daily plans, tasks, preferences, and commitments. Each existing plan receives one schedule revision with its current metrics moved onto that revision. Tasks gain live remaining effort backfilled from their whole-task estimate. Nullable scheduling-snapshot columns are added but left empty for migrated plans; V5 does not invent cadence or fixed-break history from current preferences.

   **Existing pre-Flyway database (keep your data):**

   1. Back up the database before adoption:

      ```powershell
      docker exec focusflow-postgres pg_dump -U focusflow -d focusflow -Fc -f /tmp/focusflow-pre-adopt.dump
      docker cp focusflow-postgres:/tmp/focusflow-pre-adopt.dump ./focusflow-pre-adopt.dump
      ```

   2. Run the one-shot adoption command (preflight, then Flyway baseline at version 1):

      ```powershell
      cd backend
      .\gradlew.bat adoptLegacySchema
      ```

   3. Start the backend normally:

      ```powershell
      .\gradlew.bat bootRun
      ```

      Do not enable `spring.flyway.baseline-on-migrate` or pass adoption flags to `bootRun`.

   4. If adoption fails, restore from the backup and fix the schema mismatch before retrying. Do not run `adoptLegacySchema` again on a database that already has `flyway_schema_history`.

   **Disposable local volume (no data to keep):**

   ```powershell
   docker compose down -v
   docker compose up -d
   cd backend
   .\gradlew.bat bootRun
   ```

   API base URL: `http://localhost:8080`

   **Optional — Swagger UI (dev profile only):**

   ```powershell
   cd backend
   .\gradlew.bat bootRun --args="--spring.profiles.active=dev"
   ```

   Then open `http://localhost:8080/swagger-ui/index.html`. OpenAPI JSON is at `/v3/api-docs`. Without the `dev` profile, those paths are not exposed.

5. In a second terminal, install frontend dependencies once and start Vite:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. During development, Vite proxies `/api` requests to the Spring backend at `http://localhost:8080`; use port 5173 for browser and cookie-aware HTTP checks.

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `POSTGRES_DB` | Docker Postgres database name | `focusflow` |
| `POSTGRES_USER` | Docker Postgres user | `focusflow` |
| `POSTGRES_PASSWORD` | Docker Postgres password | `focusflow` |
| `POSTGRES_PORT` | Host port for Postgres | `5432` |
| `SPRING_DATASOURCE_URL` | JDBC URL for Spring Boot | `jdbc:postgresql://127.0.0.1:5432/focusflow` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `focusflow` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | `focusflow` |
| `OPENAI_API_KEY` | Provider API key | empty |
| `OPENAI_MODEL` | Model id sent to provider | `gpt-4.1-mini` |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL | `https://api.openai.com/v1` |

Do not commit `.env`. Use `.env.example` as the template. Docker Compose and `bootRun` both read the repo-root `.env`; database settings also have matching defaults in `application.yml` when those variables are unset.

## Test and build commands

Run these from separate terminals as needed:

```powershell
# Backend: Testcontainers requires Docker Desktop to be running.
cd backend
.\gradlew.bat test

# Frontend production build
cd frontend
npm run build

# Optional frontend test suite
npm run test:run

# Regenerate committed OpenAPI snapshot after intentional API changes
cd backend
.\gradlew.bat updateOpenApiSnapshot
```

## Documentation

- [API reference](docs/api.md) — session/CSRF calling rules, request/response schemas, status codes
- [OpenAPI](docs/openapi.yaml) — generated machine-readable contract (OpenAPI 3); refresh with `.\gradlew.bat updateOpenApiSnapshot` in `backend/`
- [Architecture](docs/architecture.md) — system overview, backend components, request and generate flows, data model
- [Domain glossary](CONTEXT.md) — canonical FocusFlow planning and task language
- [Schema adoption decision](docs/adr/0001-explicit-legacy-schema-adoption.md) — why legacy Flyway adoption is explicit rather than automatic
- [Roadmap](docs/superpowers/roadmap.md) — in-progress and upcoming milestones, settled cross-milestone decisions, deferred backlog

## Manual verification checklist

With Docker, the backend, and Vite running, verify these through the browser at `http://localhost:5173` or an HTTP client that keeps cookies:

- An unauthenticated `GET /api/auth/me` or `GET /api/tasks` returns **401**.
- Register or log in. The browser holds an HttpOnly `JSESSIONID`; refresh still succeeds at `GET /api/auth/me`; do not store an auth token in local storage.
- Create, list, update, change status, and delete a task. Changes survive refresh. Mutating requests send the `X-XSRF-TOKEN` header.
- With at least one plannable task (`OPEN` or `IN_PROGRESS`) and a configured provider key, generate a plan. It returns **201** and is available from `/plans` and `/plans/:id`. `IN_PROGRESS`-only is valid. The request body must include explicit `planDate` (`YYYY-MM-DD`); omitting it returns **400**.
- On the dashboard, when no plan exists for today, `GET /api/daily-plans/latest?planDate=...` returns **204** and the UI shows the empty state (not an error).
- Plan history at `/plans` shows summary rows with pagination; open a row for full detail.
- For a user with no plannable tasks, generation returns **400** with `no plannable tasks available for planning`; it does not call the provider or save an empty plan.
- A failed provider call returns **502** and saves no partial plan. Use an empty or invalid key only when intentionally checking this path; do not spend an extra provider credit just to repeat it.
- Delete a plan from `/plans` or `/plans/:id` after the confirm dialog. Success is **204**; the plan and its items are gone, tasks remain. Detail delete navigates to `/plans`. The dashboard has no delete control.
- Register two users. A foreign task or daily-plan id returns **404**, and neither user sees the other user's records in list endpoints.

See [API reference](docs/api.md) for CSRF setup, example payloads, and full endpoint schemas.

### Helper scripts

From repo root (backend must be running):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/b18-manual-verify.ps1
powershell -ExecutionPolicy Bypass -File scripts/b18-provider-failure.ps1
```

Set `OPENAI_API_KEY` to an invalid value before running the failure script to verify `502 Bad Gateway` and no partial plan persistence.

## Project layout

```
backend/             Spring Boot application and JUnit tests
frontend/            React, TypeScript, Vite application and Vitest tests
docker-compose.yml   Local PostgreSQL service
.env.example         Local database and OpenAI-compatible provider template
scripts/             Optional manual HTTP verification helpers
docs/                API reference, OpenAPI, architecture, design notes, and plans
  api.md             Human-readable API calling guide
  openapi.yaml       Generated OpenAPI contract (refresh via updateOpenApiSnapshot)
  architecture.md    System architecture, components, and learning map
```
