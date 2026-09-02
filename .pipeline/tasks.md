# Pipeline Task Decomposition

## Summary
An MBA class bidding system. Admins (seeded root admin + admin-created admins) provision student accounts, create classes with seat caps, and set a single global bidding window. Students log in via a one-time emailed token, spend from a 1000-point balance by placing at most one active bid per class, and may edit or cancel bids while the window is open. When the window closes, a scheduled resolution job awards seats per class to the highest bidders (random tie-break, capped at `seat_cap`), marks the rest `lost`, and deducts **all** resolved bid amounts from balances (losers are not refunded). Students then see their per-class outcomes; admins see per-class result tables and can perform a destructive point reset. The build targets the certified scaffolded stack (Angular 19 + NestJS + Prisma/PostgreSQL, tRPC glue), not the FastAPI/React stack sketched in the spec — see **Open questions**.

## Surface contract

### Entities (Prisma models)
- `User` — `id`, `email` (unique), `name`, `passwordHash` (nullable; admins only), `role UserRole`, `isRoot Boolean`, `pointBalance Int @default(1000)`, `createdAt`, `updatedAt`.
- `UserRole` enum — `ADMIN`, `USER` (student), `role @default(USER)`.
- `LoginToken` — `id`, `userId` FK, `tokenHash` (unique), `expiresAt`, `usedAt?`, `createdAt`.
- `Class` — `id`, `name` (non-empty), `seatCap Int @default(30)` (> 0), `createdAt`, `updatedAt`.
- `Bid` — `id`, `userId` FK, `classId` FK, `amount Int` (> 0), `status BidStatus`, `createdAt`, `updatedAt`; partial unique index on `(userId, classId) WHERE status = 'ACTIVE'`; index on `(classId, amount DESC)`.
- `BidStatus` enum — `ACTIVE`, `WON`, `LOST`, `CANCELLED`.
- `BiddingWindow` — singleton row `id = 1`, `opensAt`, `closesAt`, `resolvedAt?`, `CHECK (closesAt > opensAt)`.
- `SystemSetting` — `key String @id`, `value String`, `updatedAt DateTime @updatedAt`.

### API routes (NestJS REST controllers, all under `/api`)
Public: `GET /api/health`, `GET /api/health/deep`, `POST /api/auth/admin/login`, `POST /api/auth/student/login`, `POST /api/auth/signup` (flag-gated, disabled by default).
Authenticated: `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/classes`, `GET /api/window`, `POST /api/bids`, `DELETE /api/bids/:id`, `GET /api/me/bids`, `GET /api/me/results`, `GET /api/students/:id/results`.
Admin (`ADMIN` role guard): `POST /api/admin/accounts/admins`, `GET /api/admin/accounts/admins`, `POST /api/admin/accounts/students`, `GET /api/admin/accounts/students`, `POST /api/admin/accounts/students/:id/resend-token`, `POST /api/admin/classes`, `PATCH /api/admin/classes/:id`, `GET /api/admin/classes/:id/results`, `GET /api/window`, `PUT /api/admin/window`, `POST /api/admin/points/reset`, `GET /api/admin/settings`, `PATCH /api/admin/settings`.
Root-admin only (`isRoot`): all `POST /api/admin/accounts/*` writes.

### Screens (Angular routes)
`/login` (student token request/entry) · `/login/token` (auto-submits `?token=`) · `/admin/login` · `/signup` (flag-gated) · `/` (role redirect) · `/classes?q=&sort=` · `/classes/:id?modal=bid` · `/my-bids` · `/results` · `/admin` · `/admin?modal=confirm-reset` · `/admin/classes` · `/admin/classes?modal=new` · `/admin/classes/:id/edit` · `/admin/classes/:id/results` · `/admin/accounts?tab=admins|students` (+ `modal=new-student`, `modal=new-admin`) · `/admin/window` · `/admin/settings`.

### Status-code contract (must hold end to end)
Unauthenticated → 401. Wrong role / not-your-resource → 403. Unknown class or bid → 404. Business-rule violation (closed window, `amount <= 0`, over balance, `closesAt <= opensAt`, `seatCap < 1`, empty name) → 422. Duplicate admin username/email → 409. Unconfigured integration → 503.

## db_agent tasks
- [ ] Extend `backend/prisma/schema.prisma`: replace the scaffold `Role` enum with `enum UserRole { ADMIN USER }` and add `role UserRole @default(USER)`, `passwordHash String?`, `isRoot Boolean @default(false)`, `pointBalance Int @default(1000)` to the `User` model.
- [ ] Add `LoginToken` model (`userId` FK → User with cascade delete, `tokenHash` unique, `expiresAt`, `usedAt?`, `createdAt`) plus an index on `(userId, usedAt)`.
- [ ] Add `Class` model (`name`, `seatCap Int @default(30)`, timestamps) and `Bid` model (`userId`, `classId`, `amount Int`, `status BidStatus`, timestamps) with `enum BidStatus { ACTIVE WON LOST CANCELLED }` and relations to `User` and `Class`.
- [ ] Add `BiddingWindow` singleton model (`id Int @id @default(1)`, `opensAt`, `closesAt`, `resolvedAt DateTime?`).
- [ ] Add `SystemSetting` model (`key String @id`, `value String`, `updatedAt DateTime @updatedAt`) for admin-configured service/integration credentials.
- [ ] Generate the migration and hand-edit it to add raw-SQL constraints Prisma cannot express: `CHECK (seat_cap > 0)`, `CHECK (amount > 0)`, `CHECK (closes_at > opens_at)`, partial unique index `(user_id, class_id) WHERE status = 'ACTIVE'`, and index `(class_id, amount DESC)`.
- [ ] Extend `backend/prisma/seed/seed.js` to idempotently seed the root admin from `ROOT_ADMIN_USERNAME`/`ROOT_ADMIN_PASSWORD` (argon2 hash, `role = ADMIN`, `isRoot = true`) and to upsert the `BiddingWindow` row `id = 1`; log a warning and skip when env vars are unset.
- [ ] Verify `npx prisma generate` and `npx prisma migrate deploy` both succeed against a clean database.

## backend_agent tasks
- [ ] Create `src/auth/security.ts` — argon2 hash/verify, JWT sign/verify with `SESSION_SECRET`, `sid` cookie set/clear helpers (`HttpOnly; SameSite=Lax; Secure`), SHA-256 token hashing, and `randomBytes`-based `token_urlsafe(32)` equivalent. Admin session TTL 12h, student 30d.
- [ ] Create `src/auth/guards` — `AuthGuard` (401 on missing/invalid cookie), `AdminGuard` (403 unless `role = ADMIN`), `RootAdminGuard` (403 unless `isRoot`), `StudentGuard` (403 unless `role = USER`); wire a `@CurrentUser()` decorator.
- [ ] Create `src/auth/auth.controller.ts` + `auth.service.ts` — `POST /api/auth/admin/login` (constant-time compare, identical 401 for unknown user and bad password), `POST /api/auth/student/login` (hash submitted token, look up unused + unexpired row `FOR UPDATE` inside a transaction, set `usedAt`, issue cookie, any miss → 401), `POST /api/auth/logout`, `GET /api/auth/me` (identity + role + balance for students, 401 otherwise).
- [ ] Add `POST /api/auth/signup` gated behind `ALLOW_PUBLIC_SIGNUP` (default `false` → 403). When enabled, the first user created gets `ADMIN`, subsequent users get `USER`. Spec states no public signup; the route exists disabled to satisfy the `full_auth` baseline.
- [ ] Create `src/config/config.service.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; if the value is absent or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row; returns `null` if neither is set. Define `ServiceUnconfiguredError` mapped to HTTP 503 by an exception filter.
- [ ] Create `src/integrations/resend.ts` — typed Resend client that resolves `RESEND_REST_API_POST_HTTPS_API_RESEND_COM_EMAILS_API_KEY` (and `RESEND_FROM`, `APP_BASE_URL`) via `resolveConfig`, throws `ServiceUnconfiguredError` when unresolved/placeholder, and exports `sendLoginToken(email, name, token): Promise<boolean>` — `POST https://api.resend.com/emails` with a 5s timeout, link `{APP_BASE_URL}/login/token?token=...`, catches every exception and non-2xx, logs, and returns `false` (never throws to callers).
- [ ] Create `src/integrations/postgresql.ts` — thin typed wrapper resolving `POSTGRESQL_API_KEY`/`DATABASE_URL` via `resolveConfig` and exposing the connectivity check used by `GET /api/health/deep` (executes `SELECT 1`, 503 on failure); `GET /api/health` returns `{"status":"ok"}`. Both endpoints unauthenticated.
- [ ] Create `src/admin/settings.controller.ts` — `GET /api/admin/settings` (admin guard; lists credential keys for `postgresql`, `minio`, the Resend integration and the PostgreSQL integration with masked values + `configured` boolean) and `PATCH /api/admin/settings` (admin guard; upserts key/value pairs into `SystemSetting`).
- [ ] Create `src/accounts/accounts.controller.ts` + service — `POST /api/admin/accounts/admins` (root admin; 409 on duplicate username/email), `POST /api/admin/accounts/students` (root admin; create user with `pointBalance = 1000`, generate + store hashed token with 7-day TTL, **commit**, then send email; respond `201 {student, email_delivered}`), `POST /api/admin/accounts/students/:id/resend-token` (invalidate prior unused tokens, issue new one, same response shape), `GET /api/admin/accounts/admins`, `GET /api/admin/accounts/students` (both admin-read).
- [ ] Create `src/classes/classes.controller.ts` + service — `GET /api/classes` for any authenticated identity returning `id, name, seatCap, seatsTaken` (populated post-resolution only) plus, for students, **only their own** bid; `POST /api/admin/classes` and `PATCH /api/admin/classes/:id` (admin guard, 422 on empty name or `seatCap < 1`).
- [ ] Create `src/window/window.controller.ts` + service — `GET /api/window` (any authenticated identity; returns `opensAt`, `closesAt`, `state ∈ {pending, open, closed}`) and `PUT /api/admin/window` (admin guard; 422 unless `closesAt > opensAt`; clears `resolvedAt` when `closesAt` is in the future, enabling a new round).
- [ ] Create `src/bids/bids.controller.ts` + service — `POST /api/bids {classId, amount}` (student guard; single transaction: `SELECT … FOR UPDATE` on the user row → class exists 404 → window open 422 → `amount > 0` 422 → `Σ(other active bids) + amount <= pointBalance` 422 → upsert the `(user, class)` active bid so an edit updates rather than duplicates; returns the bid plus the new available balance).
- [ ] Add `DELETE /api/bids/:id` (owner only, 403 otherwise, 404 unknown, window must be open else 422; sets `status = CANCELLED`, freeing the reservation) and `GET /api/me/bids` (active bids + available balance = `pointBalance − Σ active`).
- [ ] Create `src/resolution/resolution.service.ts` — idempotent `resolveWindow()` in one transaction under `pg_advisory_xact_lock(hashtext('bid-resolution'))`; no-ops unless the window exists, `now >= closesAt`, and `resolvedAt IS NULL`. Per class: `SELECT id FROM bids WHERE class_id = :c AND status = 'ACTIVE' ORDER BY amount DESC, random() LIMIT seat_cap` → `WON`; remaining active → `LOST`. Then one aggregate `UPDATE users SET point_balance = point_balance − Σ(won + lost amounts)` (no refunds for losers) and set `resolvedAt = now()`.
- [ ] Create `src/resolution/scheduler.service.ts` — `@nestjs/schedule` 10-second interval invoking `resolveWindow()` with single-instance/coalescing semantics, started on module init and shut down cleanly; the advisory lock makes multiple replicas safe.
- [ ] Create `src/results/results.controller.ts` — `GET /api/me/results` (per-class `{className, amount, outcome}` for resolved bids, empty until resolution), `GET /api/students/:id/results` (403 unless caller is that student or an admin), `GET /api/admin/classes/:id/results` (admin guard; every student's name, amount, outcome, sorted by amount desc).
- [ ] Create `src/admin/admin-ops.controller.ts` — `POST /api/admin/points/reset` (admin guard; one transaction: cancel all `ACTIVE` bids, `UPDATE users SET point_balance = 1000`, clear `resolvedAt`; historical `WON`/`LOST` bids retained).
- [ ] Register every new module in `src/app.module.ts`, add cookie parsing and a global validation pipe returning 422 on constraint failures, and extend `.env.example` with `SESSION_SECRET`, `ROOT_ADMIN_USERNAME`, `ROOT_ADMIN_PASSWORD`, `RESEND_FROM`, `APP_BASE_URL`, `TOKEN_TTL_DAYS`, `ALLOW_PUBLIC_SIGNUP`, and both integration API-key vars.

## ui_agent tasks
- [ ] Rewrite `frontend/src/app/app.routes.ts` with the full route table from the surface contract (lazy-loaded standalone components) and add a `RequireAuth` route guard (`role: 'admin' | 'student'`) that redirects unauthenticated users to `/admin/login` for `/admin/**` and `/login` elsewhere.
- [ ] Create `AuthService` + auth state that bootstraps from `GET /api/auth/me`, exposes role/balance signals, and clears state on logout; create shell `LayoutComponent` with role-aware navigation (admin section visible only to admins).
- [ ] Create shared components `ModalComponent`, `ErrorBannerComponent`, `BalanceMeterComponent`, `WindowStatusComponent` (renders `pending | open | closed` with the close countdown), plus consistent loading, empty, and error states for every list view.
- [ ] Create `LoginStudentComponent` (`/login`) and the `/login/token` view that reads `?token=` and auto-submits, showing an inline error for expired/used tokens.
- [ ] Create `LoginAdminComponent` (`/admin/login`) — username + password form surfacing the generic 401 message verbatim.
- [ ] Create `SignupComponent` (`/signup`) that renders a "public signup is disabled — contact an administrator" state when the backend returns 403, and a working form when `ALLOW_PUBLIC_SIGNUP` is enabled.
- [ ] Create `ClassListComponent` (`/classes`) — search and sort bound to `?q=&sort=`, per-class seat cap, the student's own bid (never other students' bids), and empty/loading states.
- [ ] Create `ClassDetailComponent` (`/classes/:id`) with the `?modal=bid` `BidFormComponent` — client-side guards (`amount > 0`, `amount <= available`) mirroring server validation, server errors surfaced verbatim, and edit/cancel disabled behind an explanatory banner when the window is closed.
- [ ] Create `MyBidsComponent` (`/my-bids`) — active bids, committed vs available balance via `BalanceMeter`, and cancel actions.
- [ ] Create `MyResultsComponent` (`/results`) — per-class won/lost outcomes and points spent; empty state until resolution has run.
- [ ] Create `AdminDashboardComponent` (`/admin`) — window status, counts, and the `?modal=confirm-reset` typed-confirmation modal for the destructive point reset.
- [ ] Create `AdminClassesComponent` (`/admin/classes`, `?modal=new`, `/admin/classes/:id/edit`) — class CRUD with seat-cap `>= 1` and non-empty-name validation before submit.
- [ ] Create `AdminClassResultsComponent` (`/admin/classes/:id/results`) — table of every student's name, amount, and outcome sorted by amount desc.
- [ ] Create `AdminAccountsComponent` (`/admin/accounts?tab=admins|students` with `modal=new-admin` / `modal=new-student`) — creation forms that render a persistent `ErrorBanner` when `email_delivered === false`, plus a per-student **Resend token** action.
- [ ] Create `AdminWindowComponent` (`/admin/window`) — window editor rejecting `closesAt <= opensAt` before submit and warning that saving a future close time starts a new round.
- [ ] Create `AdminSettingsComponent` (`/admin/settings`) — one section per provisioned service (`postgresql`, `minio`) and per integration (PostgreSQL → `POSTGRESQL_API_KEY`, Resend REST API → `RESEND_REST_API_POST_HTTPS_API_RESEND_COM_EMAILS_API_KEY`), each with a configured/unconfigured badge, masked current value, and a credential form; show a prominent banner: "The following need credentials to activate: Resend REST API, PostgreSQL."
- [ ] Verify `npx ng build --configuration production` type-checks and bundles cleanly.

## service_agent tasks
- [ ] Create `frontend/src/app/api/client.ts` — typed `fetch` wrapper with `credentials: 'include'`, JSON headers, `/api` base, structured error objects carrying HTTP status + server message, and a global 401 handler that clears auth state and redirects to `/login` (or `/admin/login` under `/admin/**`).
- [ ] Create `auth.api.ts` — `adminLogin`, `studentLogin(token)`, `signup`, `logout`, `me`; keep the tRPC client token in `app.config.ts` intact for the existing `users` router.
- [ ] Create `classes.api.ts` — `listClasses({q, sort})`, `getClass(id)`, `createClass`, `updateClass`.
- [ ] Create `bids.api.ts` — `placeOrEditBid({classId, amount})`, `cancelBid(id)`, `myBids()`; return the refreshed available balance to callers.
- [ ] Create `window.api.ts` and `results.api.ts` — `getWindow`, `saveWindow`, `myResults`, `studentResults(id)`, `classResults(classId)`.
- [ ] Create `admin.api.ts` — `listAdmins`, `createAdmin`, `listStudents`, `createStudent`, `resendToken(studentId)`, `resetPoints`, `getSettings`, `updateSettings`.
- [ ] Add a shared query/cache layer (Angular signals or `@tanstack/query` equivalent) with invalidation rules: a bid write invalidates classes + my-bids + balance; a window save invalidates window + classes; a point reset invalidates everything.

## tester tasks
- [ ] Auth tests: admin login success and 401 (unknown user and bad password produce identical responses); `GET /api/auth/me` 401 when unauthenticated; logout clears the session.
- [ ] Student token tests: valid token logs in; single-use enforced (second use → 401); expired token → 401; `resend-token` invalidates prior unused tokens.
- [ ] Account tests: non-root admin gets 403 on account writes; duplicate admin username → 409; email-failure path (stub `sendLoginToken` → `false`) still persists the student and token and returns `email_delivered: false`.
- [ ] Authorization matrix tests: student 403 on class create; admin 403 on `POST /api/bids`; unknown class → 404; cross-student `GET /api/students/:id/results` → 403.
- [ ] Bid validation tests asserting exact codes in spec order — auth 401 → role 403 → class 404 → closed window 422 → `amount <= 0` 422 → over-balance 422.
- [ ] Bid lifecycle tests: re-bidding the same class edits rather than duplicates (partial unique index holds); cancel frees the reservation and restores available balance; cancelled bids are excluded everywhere but retained for audit.
- [ ] Window tests: `closesAt <= opensAt` → 422; `seatCap < 1` and empty class name → 422; saving a future `closesAt` clears `resolvedAt`.
- [ ] Resolution tests: cap-overflow winner selection (top `seatCap` by amount win, rest lose); random tie-break verified statistically over repeated runs; losers are **not** refunded; running resolution twice is idempotent; `seatsTaken` only populated post-resolution.
- [ ] Point reset test: cancels all active bids, resets every balance to 1000, clears `resolvedAt`, and retains historical won/lost bids.
- [ ] Performance test: 200 bids across multiple classes resolve in under 30s.
- [ ] Settings/integration tests: `GET /api/admin/settings` masks values and reports `configured` status; `PATCH` requires admin (403 otherwise); an unconfigured/placeholder Resend key surfaces as 503 from the integration client while account creation still succeeds with `email_delivered: false`.
- [ ] Health and build gates: `GET /api/health` → `{"status":"ok"}`, `GET /api/health/deep` → 503 when the database is unreachable; `npx tsc --noEmit`, `npm test -- --maxWorkers=2`, and `npx ng build --configuration production` all pass.

## Open questions
- **Stack conflict (blocking).** The spec prescribes FastAPI + SQLAlchemy/Alembic + React/Vite, but the scaffolder produced the certified Enterprise stack (Angular 19 + NestJS + Prisma + tRPC, `colossus.stack.json`, `colossus.yaml`). These tasks map the spec's behaviour onto the scaffolded stack because the deploy agents read `colossus.yaml`. All spec file paths (`app/routers/*.py`, `frontend/src/pages/*.tsx`) are therefore translated to Nest modules and Angular standalone components. Confirm this is intended before any agent writes Python.
- **REST vs tRPC.** The spec pins exact HTTP paths and status codes (401/403/404/422/409), so backend_agent implements REST controllers under `/api`; the scaffolded tRPC `users` router is left in place. If the pipeline requires tRPC-only surface area, the status-code assertions in the tester tasks need reworking.
- **Public signup.** `<auth_model>` is `full_auth` (which implies signup) but the spec explicitly assumes no public signup — reconciled by shipping `/signup` and `POST /api/auth/signup` gated behind `ALLOW_PUBLIC_SIGNUP`, default off. Confirm the flag should stay off in production.
- **Admin identity field.** The spec's `admins` table keys on `username`, while the scaffolded `User` model keys on unique `email`. Tasks assume admins log in with `username` stored in the `email` column (or an added `username` field). db_agent should confirm which before generating the migration.
- **MinIO.** `<spec_deployments>` includes `minio`, but the spec describes no object storage or file uploads. It appears only as a credential section on `/admin/settings`; no bucket or upload feature was invented.
- **Integration env-key names.** `POSTGRESQL_API_KEY` is a derived placeholder — PostgreSQL authenticates via `DATABASE_URL`, not an API key. The settings UI exposes both; confirm which the deploy environment actually populates.
- **Seat-cap visibility.** The spec says `seatsTaken` is exposed "post-resolution only"; it is unspecified whether an in-progress window should show the live bid count. Tasks assume it is hidden (null/0) until `resolvedAt` is set.
- **Tie-break auditability.** `random()` tie-breaks are not reproducible; the spec flags this as an accepted risk, so no ordering is persisted.
