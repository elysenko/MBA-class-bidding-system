# Test Specification

> **WARNING — `surface.json` is stale.** `.pipeline/surface.json` is a generated scaffold artifact
> (`"_generated": true`) listing only `GET /health`, `GET /trpc/users.findAll`,
> `GET /trpc/users.findById` and the placeholder `app-root` / `app-home` components. It does **not**
> describe the bidding system. This spec therefore covers **(a)** the three scaffold routes, so the
> literal `surface.json` contract is still honoured, and **(b)** the full API surface derived from the
> approved spec and `.pipeline/tasks.md`. The `testIds` in `surface.json` are likewise scaffold
> placeholders; `.colossus-acceptance.json` *rejects* the strings `home-title">Users<`, `Loading...`
> and `Failed to load users.`, so the placeholder home screen must be replaced (see `UI-001`).
>
> **WARNING — stack conflict.** The spec prescribes FastAPI + React/Vite; the repository is the
> certified Angular 19 + NestJS + Prisma scaffold, and `tasks.md` maps the spec onto it. Every case
> below is written at the **HTTP / user-visible** level so it is valid against either stack. Paths,
> status codes and payload shapes are normative; field casing follows the implementation
> (`point_balance` ≡ `pointBalance`, `seat_cap` ≡ `seatCap`, `class_id` ≡ `classId`) and a tester may
> accept either spelling.

## Coverage summary
- Total cases: 348
- API endpoints covered: 30 / 30 (3 from `surface.json` + 27 derived from the spec; `surface.json` lists only 3)
- User journeys covered: 19

**Shared fixtures** (assumed by every case unless overridden):
- `root` — admin, `isRoot = true`, username/email `root@school.edu`, password `RootPw!234`.
- `dean` — admin, `isRoot = false`, `dean@school.edu`, password `DeanPw!234`.
- `alice`, `bob`, `carol` — students, balance `1000`, no bids.
- Classes: `FIN101` (`seat_cap = 1`), `MKT200` (`seat_cap = 2`), `OPS300` (`seat_cap = 30`).
- Window `OPEN` = `opens_at = now − 1h`, `closes_at = now + 1h`, `resolved_at = NULL`.
  Window `CLOSED` = `opens_at = now − 2h`, `closes_at = now − 1h`.
  Window `PENDING` = `opens_at = now + 1h`, `closes_at = now + 2h`.
- "authenticated as X" = request carries a valid `sid` cookie for X; "anonymous" = no cookie.

## API tests

### `GET /api/health`
- **Happy path**: `API-001` anonymous GET → `200` with body exactly `{"status":"ok"}`.
- **Validation failures**: n/a (no inputs).
- **Auth failures**: `API-002` no `sid` cookie → still `200` (endpoint must be public, never `401`).
- **Idempotency / edge cases**: `API-003` with the database stopped → still `200` (liveness must not depend on Postgres); `API-004` ten sequential calls all return identical bodies.

### `GET /api/health/deep`
- **Happy path**: `API-005` anonymous GET with a reachable database → `200`, body reports `status: "ok"` and a database field indicating `ok`/`up`.
- **Validation failures**: n/a.
- **Auth failures**: `API-006` no cookie → `200`, not `401` (endpoint must be public).
- **Idempotency / edge cases**: `API-007` with `DATABASE_URL` pointed at a dead host (or the DB container stopped) → `503`, body names the database as the failing dependency and the process does **not** crash; `API-008` after the database recovers, the next call returns `200` without a restart.

### `GET /health` *(scaffold route from `surface.json`, unprefixed)*
- **Happy path**: `API-009` anonymous GET → `200` with `{"status":"ok"}`, matching `/api/health`. If the deployed ingress only exposes the `/api`-prefixed form, the test must assert a deliberate `404` and the reason must be recorded — a `500` or a hang is a failure either way.
- **Validation failures**: n/a.
- **Auth failures**: `API-010` public, never `401`.
- **Idempotency / edge cases**: `API-011` `/health` and `/api/health` never disagree (both `200`, or the prefixed one `200` and the bare one `404`).

### `GET /trpc/users.findAll` *(scaffold route from `surface.json`)*
- **Happy path**: `API-012` GET with the scaffold tRPC client → `200`, body is a JSON-RPC-shaped result whose `data` is an array; with the seeded root admin present the array is non-empty and each element exposes `id` and `email`.
- **Validation failures**: `API-013` malformed `input` query param → tRPC error envelope with HTTP `400`, not `500`.
- **Auth failures**: `API-014` document the decision explicitly — if the router is left public (scaffold default) assert `200` anonymously **and** assert the payload leaks no `passwordHash`, `point_balance`, or `tokenHash` field; if it is put behind the auth guard, assert `401` anonymously.
- **Idempotency / edge cases**: `API-015` read-only — calling twice does not mutate the `users` table (row count and `updated_at` unchanged).

### `GET /trpc/users.findById` *(scaffold route from `surface.json`)*
- **Happy path**: `API-016` `input={"id":<alice.id>}` → `200`, result contains alice's `id`/`email`/`name`.
- **Validation failures**: `API-017` non-numeric / missing `id` → tRPC `BAD_REQUEST` (`400`); `API-018` well-formed but unknown id → `NOT_FOUND` (`404`) or an explicit `null` result, never a `500`.
- **Auth failures**: `API-019` same decision as `API-014`, asserted consistently; the response must never include `passwordHash`.
- **Idempotency / edge cases**: `API-020` repeated calls return byte-identical bodies.

### `POST /api/auth/admin/login`
- **Happy path**: `API-021` `{username: "root@school.edu", password: "RootPw!234"}` → `200`, body has `role: "admin"` (and `is_root: true`), and a `Set-Cookie: sid=` header that is `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` outside dev, with `Max-Age`/`Expires` ≈ 12h.
- **Validation failures**: `API-022` missing `password` → `422`; `API-023` empty-string `username` → `422`; `API-024` non-JSON body → `400`/`422`, never `500`.
- **Auth failures**: `API-025` unknown username with any password → `401`; `API-026` known username with wrong password → `401`; `API-027` the two responses above are **byte-identical** (same status, same body, same headers minus timing) so the endpoint does not enumerate users; `API-028` neither failure sets a `sid` cookie.
- **Idempotency / edge cases**: `API-029` logging in twice issues a fresh valid cookie and the first cookie also remains valid until its own expiry (stateless JWT) — assert whichever behaviour is implemented, consistently; `API-030` password comparison is constant-time — `argon2.verify` is invoked even for an unknown username (assert via spy/hash-work, not wall-clock).

### `POST /api/auth/student/login`
- **Happy path**: `API-031` `{token: <raw token emailed to alice>}` → `200`, body identifies alice with `role: "student"` and `point_balance: 1000`; `Set-Cookie: sid=` with `Max-Age` ≈ 30 days; the `login_tokens` row for that hash now has `used_at` set.
- **Validation failures**: `API-032` missing `token` field → `422`; `API-033` `token: ""` → `422`.
- **Auth failures**: `API-034` random 32-byte token that was never issued → `401`; `API-035` **replay** — the exact token from `API-031` used a second time → `401` and no new cookie; `API-036` token whose `expires_at` is `now − 1s` → `401` and `used_at` stays `NULL`; `API-037` token belonging to a deleted student → `401`, not `500`; `API-038` submitting the stored SHA-256 **hash** instead of the raw token → `401` (the server must hash the input, not compare raw).
- **Idempotency / edge cases**: `API-039` two concurrent requests with the same valid token → exactly one `200` and one `401` (row-level `FOR UPDATE` inside the transaction); `API-040` after `resend-token`, the previously issued unused token → `401` while the newest token → `200`.

### `POST /api/auth/signup`
- **Happy path**: `API-041` with `ALLOW_PUBLIC_SIGNUP=false` (the production default) → `403` with a message indicating signup is disabled, and **no** user row is created.
- **Validation failures**: `API-042` with the flag enabled, missing/invalid email → `422`; `API-043` flag enabled, duplicate email → `409`.
- **Auth failures**: `API-044` the `403` is returned to anonymous callers *and* to authenticated ones — the flag, not the session, governs.
- **Idempotency / edge cases**: `API-045` flag enabled on an empty user table → first user gets `ADMIN`; `API-046` flag enabled with users already present → new user gets `USER` (student) and `point_balance = 1000`, never `isRoot`.

### `POST /api/auth/logout`
- **Happy path**: `API-047` authenticated as alice → `200`/`204` and a `Set-Cookie: sid=` clearing header (empty value with `Max-Age=0`/past `Expires`); `API-048` a follow-up `GET /api/auth/me` with the cleared cookie jar → `401`.
- **Validation failures**: n/a (no body).
- **Auth failures**: `API-049` anonymous logout → `401` (or `204` if implemented as tolerant — assert the implemented choice consistently and assert it never `500`s).
- **Idempotency / edge cases**: `API-050` logging out twice is safe and returns the same status both times.

### `GET /api/auth/me`
- **Happy path**: `API-051` as alice → `200` with `id`, `name`, `email`, `role: "student"`, `point_balance: 1000` and an `available` figure; `API-052` as root → `200` with `role: "admin"`, `is_root: true`, and **no** `point_balance` (or `null`).
- **Validation failures**: n/a.
- **Auth failures**: `API-053` anonymous → `401`; `API-054` cookie signed with the wrong `SESSION_SECRET` → `401`; `API-055` cookie with an `exp` in the past → `401`; `API-056` structurally malformed cookie value (`sid=garbage`) → `401`, never `500`.
- **Idempotency / edge cases**: `API-057` never returns `passwordHash`; `API-058` after alice places a 300-point bid, `point_balance` is still `1000` and `available` is `700`.

### `GET /api/classes`
- **Happy path**: `API-059` as alice with the three fixture classes → `200`, array of `{id, name, seat_cap, seats_taken}` ordered deterministically; `API-060` as root → `200` with the same class fields.
- **Validation failures**: `API-061` `?sort=<unsupported value>` → `422` or a documented fallback to the default order (assert the implemented choice); `API-062` `?q=` with a 500-character string → `200` with an empty array, not an error.
- **Auth failures**: `API-063` anonymous → `401`.
- **Idempotency / edge cases**: `API-064` **privacy** — alice has a bid on `FIN101` and bob has one too; alice's response includes her own bid (`amount`, `status`) and contains **no** trace of bob's bid, his id, his name, or any aggregate that reveals it; `API-065` `seats_taken` is `0`/`null` while `resolved_at IS NULL`, and equals the count of `won` bids after resolution; `API-066` a cancelled bid is absent from `my_bid`; `API-067` `?q=fin` filters case-insensitively to `FIN101`; `API-068` `?sort=name` and `?sort=seat_cap` produce the documented orders.

### `GET /api/classes/:id` *(class-detail read; may be served from the list payload — if no such route exists, mark these cases satisfied by `API-059`/`API-064` and record that in the run)*
- **Happy path**: `API-069` as alice → `200` with the class plus her own bid and the current window state.
- **Validation failures**: `API-070` non-numeric id → `422`/`400`.
- **Auth failures**: `API-071` anonymous → `401`.
- **Idempotency / edge cases**: `API-072` unknown id → `404`; `API-073` never exposes another student's bid.

### `GET /api/window`
- **Happy path**: `API-074` as alice with window `OPEN` → `200` `{opens_at, closes_at, state: "open"}`; `API-075` window `PENDING` → `state: "pending"`; `API-076` window `CLOSED` → `state: "closed"`.
- **Validation failures**: n/a.
- **Auth failures**: `API-077` anonymous → `401`.
- **Idempotency / edge cases**: `API-078` no window row at all → `200` with a null/`pending` state (or `404` if that is the implemented contract), never `500`; `API-079` timestamps are returned as ISO-8601 UTC strings.

### `POST /api/bids`
- **Happy path**: `API-080` alice, window `OPEN`, `{class_id: OPS300, amount: 300}` → `201`/`200` with the bid (`status: "active"`) and `available: 700`; the DB holds exactly one active bid.
- **Validation failures**: `API-081` `amount: 0` → `422`; `API-082` `amount: -50` → `422`; `API-083` `amount: 1.5` (non-integer) → `422`; `API-084` missing `class_id` → `422`; `API-085` over-balance — alice bids `600` on `FIN101` then `500` on `MKT200` → second call `422` and **no** bid row is written; `API-086` window `CLOSED` → `422`; `API-087` window `PENDING` (not yet open) → `422`.
- **Auth failures**: `API-088` anonymous → `401`; `API-089` as root (admin) → `403`.
- **Idempotency / edge cases**: `API-090` **precedence order** — an anonymous call carrying `class_id: 999999, amount: -5` with the window closed returns `401` (auth beats everything); the same body as an admin returns `403`; as alice returns `404` (unknown class beats window/amount); with a real class and the window closed returns `422` for the window before the amount; `API-091` unknown `class_id` as alice → `404`; `API-092` **edit-not-duplicate** — alice bids `300` then `450` on `OPS300` → `200`, still exactly one active row, `amount = 450`, `available = 550`, `updated_at` advanced; `API-093` re-bidding after cancelling creates a new active bid without violating the partial unique index; `API-094` boundary — bidding exactly the full `available` (`1000`) succeeds, `1001` → `422`; `API-095` two concurrent bids from alice serialise via `FOR UPDATE` and cannot jointly exceed her balance.

### `DELETE /api/bids/:id`
- **Happy path**: `API-096` alice cancels her own active `300` bid with the window `OPEN` → `200`/`204`, row `status = "cancelled"` (row still present for audit), and `available` back to `1000`.
- **Validation failures**: `API-097` non-numeric id → `422`/`400`.
- **Auth failures**: `API-098` anonymous → `401`; `API-099` bob cancelling alice's bid → `403` and alice's bid is untouched; `API-100` an admin cancelling a student's bid → `403`.
- **Idempotency / edge cases**: `API-101` unknown bid id → `404`; `API-102` window `CLOSED` → `422` and the bid stays `active`; `API-103` cancelling an already-cancelled bid → `404`/`422` (assert the implemented choice) and no double refund; `API-104` cancelling a `won`/`lost` bid after resolution → `422`, balance unchanged.

### `GET /api/me/bids`
- **Happy path**: `API-105` alice with a `300` bid on `OPS300` → `200` `{bids: [...], point_balance: 1000, available: 700}`, each bid carrying `class_id`, `class_name`, `amount`, `status`.
- **Validation failures**: n/a.
- **Auth failures**: `API-106` anonymous → `401`; `API-107` as root → `403` (or an empty admin-shaped payload — assert the implemented choice).
- **Idempotency / edge cases**: `API-108` cancelled bids are excluded and `available` reflects that; `API-109` a student with no bids → `200`, empty array, `available: 1000`; `API-110` after resolution, `won`/`lost` bids are excluded from the *active* list.

### `GET /api/me/results`
- **Happy path**: `API-111` alice after resolution → `200`, one entry per resolved bid `{class_name, amount, outcome ∈ {"won","lost"}}`.
- **Validation failures**: n/a.
- **Auth failures**: `API-112` anonymous → `401`.
- **Idempotency / edge cases**: `API-113` before resolution → `200` with an empty array (not `404`); `API-114` cancelled bids never appear; `API-115` results survive a subsequent point reset (historical `won`/`lost` retained).

### `GET /api/students/:id/results`
- **Happy path**: `API-116` alice requesting her own id → `200` with her results; `API-117` root requesting alice's id → `200`.
- **Validation failures**: `API-118` non-numeric id → `422`/`400`.
- **Auth failures**: `API-119` anonymous → `401`; `API-120` **bob requesting alice's id → `403`** and the body leaks nothing about alice; `API-121` a non-root admin (`dean`) → `200` (any admin may read).
- **Idempotency / edge cases**: `API-122` unknown student id as an admin → `404`; `API-123` unknown student id as a *student* → `403` before `404`, so ids cannot be probed.

### `POST /api/admin/accounts/admins`
- **Happy path**: `API-124` as root, `{username: "newdean@school.edu", password: "Pw!23456", name: "New Dean"}` → `201` with the admin (no `passwordHash` in the body), `isRoot = false`, and the password stored as an argon2 hash.
- **Validation failures**: `API-125` empty username → `422`; `API-126` password shorter than the configured minimum → `422`; `API-127` missing `password` → `422`.
- **Auth failures**: `API-128` anonymous → `401`; `API-129` as `dean` (admin, non-root) → `403`; `API-130` as alice (student) → `403`.
- **Idempotency / edge cases**: `API-131` duplicate username/email → `409` and no second row; `API-132` the new admin can immediately log in via `POST /api/auth/admin/login`; `API-133` a caller cannot set `isRoot: true` via the request body (privilege escalation) — the field is ignored and the created admin has `isRoot = false`.

### `GET /api/admin/accounts/admins`
- **Happy path**: `API-134` as root → `200`, array including root and dean with `id`, `username`/`email`, `is_root`, `created_at`.
- **Validation failures**: n/a.
- **Auth failures**: `API-135` anonymous → `401`; `API-136` as alice → `403`; `API-137` as `dean` → `200` (admin **read** is allowed for non-root).
- **Idempotency / edge cases**: `API-138` no `passwordHash` appears in any element.

### `POST /api/admin/accounts/students`
- **Happy path**: `API-139` as root, `{name: "Dave", email: "dave@school.edu"}` with the email stub returning `true` → `201` `{student: {...point_balance: 1000}, email_delivered: true}`; a `login_tokens` row exists whose `token_hash` is the SHA-256 of the emailed raw token, `expires_at ≈ now + TOKEN_TTL_DAYS` (7d), `used_at NULL`.
- **Validation failures**: `API-140` malformed email → `422`; `API-141` empty name → `422`; `API-142` missing `email` → `422`.
- **Auth failures**: `API-143` anonymous → `401`; `API-144` as `dean` (non-root) → `403`; `API-145` as alice → `403`.
- **Idempotency / edge cases**: `API-146` **email-failure path** — stub `sendLoginToken` to return `false` → still `201`, `email_delivered: false`, and the student **and** token rows are committed (the commit precedes the send); `API-147` the Resend key unset/placeholder → same as `API-146`, `201` with `email_delivered: false` — account creation must never surface `503`; `API-148` duplicate email → `409`, no second student; `API-149` the raw token is returned **only** in the email, never in the HTTP response body; `API-150` the email link is exactly `{APP_BASE_URL}/login/token?token=<raw>`.

### `GET /api/admin/accounts/students`
- **Happy path**: `API-151` as root → `200`, array of `{id, name, email, point_balance, created_at}` for alice/bob/carol.
- **Validation failures**: n/a.
- **Auth failures**: `API-152` anonymous → `401`; `API-153` as alice → `403`; `API-154` as `dean` → `200`.
- **Idempotency / edge cases**: `API-155` never exposes `token_hash` or any raw token.

### `POST /api/admin/accounts/students/:id/resend-token`
- **Happy path**: `API-156` as root for alice → `200`/`201` `{student, email_delivered: true}`; a new unused token row exists.
- **Validation failures**: `API-157` non-numeric id → `422`/`400`.
- **Auth failures**: `API-158` anonymous → `401`; `API-159` as `dean` → `403`; `API-160` as alice (even for her own id) → `403`.
- **Idempotency / edge cases**: `API-161` **prior unused tokens are invalidated** — the pre-existing token now fails `POST /api/auth/student/login` with `401` while the new one succeeds; `API-162` unknown student id → `404`; `API-163` email stub returning `false` → still `200` with `email_delivered: false` and the new token persisted; `API-164` calling it three times leaves exactly one usable token.

### `POST /api/admin/classes`
- **Happy path**: `API-165` as root, `{name: "STR400", seat_cap: 12}` → `201` with the created class; `API-166` as `dean` (non-root admin) → `201` (class writes need admin, not root).
- **Validation failures**: `API-167` `seat_cap: 0` → `422`; `API-168` `seat_cap: -3` → `422`; `API-169` empty/whitespace-only name → `422`; `API-170` missing `seat_cap` → `201` with the default `30` (or `422` if the field is required — assert the implemented choice); `API-171` non-integer `seat_cap` → `422`.
- **Auth failures**: `API-172` anonymous → `401`; `API-173` as alice (student) → `403`.
- **Idempotency / edge cases**: `API-174` the DB `CHECK (seat_cap > 0)` also rejects a direct SQL insert of `0`; `API-175` two classes may share a name (no uniqueness constraint) unless the implementation adds one — assert the implemented choice.

### `PATCH /api/admin/classes/:id`
- **Happy path**: `API-176` as an admin, rename `OPS300` and set `seat_cap: 25` → `200` with the updated values persisted; `API-177` partial update of `name` only leaves `seat_cap` unchanged.
- **Validation failures**: `API-178` `seat_cap: 0` → `422`, row unchanged; `API-179` empty name → `422`, row unchanged.
- **Auth failures**: `API-180` anonymous → `401`; `API-181` as alice → `403`.
- **Idempotency / edge cases**: `API-182` unknown class id → `404`; `API-183` lowering `seat_cap` below the number of already-`won` bids after resolution does **not** retroactively change outcomes; `API-184` applying the same PATCH twice is a no-op.

### `GET /api/admin/classes/:id/results`
- **Happy path**: `API-185` as an admin after resolution on `FIN101` (cap 1, bids alice 500 / bob 300) → `200`, rows for **both** students with `name`, `amount`, `outcome`, sorted by `amount` **descending** (alice `won` first, bob `lost`).
- **Validation failures**: `API-186` non-numeric id → `422`/`400`.
- **Auth failures**: `API-187` anonymous → `401`; `API-188` as alice (a student, even one who bid on the class) → `403`; `API-189` as `dean` → `200`.
- **Idempotency / edge cases**: `API-190` unknown class id → `404`; `API-191` before resolution → `200` with an empty list (or active bids clearly flagged unresolved — assert the implemented choice); `API-192` cancelled bids are excluded.

### `PUT /api/admin/window`
- **Happy path**: `API-193` as an admin, `{opens_at: now−1h, closes_at: now+2h}` → `200` with `state: "open"`; `API-194` future-dated window → `state: "pending"`.
- **Validation failures**: `API-195` `closes_at == opens_at` → `422`; `API-196` `closes_at < opens_at` → `422`; `API-197` non-ISO date strings → `422`; `API-198` missing `closes_at` → `422`.
- **Auth failures**: `API-199` anonymous → `401`; `API-200` as alice → `403`.
- **Idempotency / edge cases**: `API-201` **new round** — after a resolved window, saving a window whose `closes_at` is in the future clears `resolved_at` to `NULL`, so the resolver will run again; `API-202` saving a window whose `closes_at` is in the **past** does not clear `resolved_at`; `API-203` there is never more than one window row (always `id = 1`, upsert not insert); `API-204` the DB `CHECK (closes_at > opens_at)` rejects a direct SQL insert that violates it.

### `POST /api/admin/points/reset`
- **Happy path**: `API-205` as an admin, with alice at `700` committed/active bids outstanding and a resolved window → `200`; afterwards every student's `point_balance` is `1000`, every previously `active` bid is `cancelled`, and `resolved_at` is `NULL`.
- **Validation failures**: `API-206` if a typed confirmation token is required in the body, an absent/incorrect one → `422` and **nothing** is mutated.
- **Auth failures**: `API-207` anonymous → `401`; `API-208` as alice → `403` and no balances change.
- **Idempotency / edge cases**: `API-209` historical `won`/`lost` bids are **retained**, not deleted or cancelled; `API-210` running it twice is safe and leaves the same state; `API-211` it is atomic — a forced failure mid-transaction rolls back every balance change (no partial reset); `API-212` after a reset, a student can immediately place a full 1000-point bid.

### `GET /api/admin/settings`
- **Happy path**: `API-213` as an admin → `200`, one entry per credential key (`postgresql`, `minio`, the Resend key, the PostgreSQL integration key) with `configured: boolean`.
- **Validation failures**: n/a.
- **Auth failures**: `API-214` anonymous → `401`; `API-215` as alice → `403`.
- **Idempotency / edge cases**: `API-216` **values are masked** — a configured secret is returned as a mask (e.g. `re_…abcd`), and the full plaintext appears nowhere in the response; `API-217` a key whose value is the literal `PLACEHOLDER_CONFIGURE_IN_SETTINGS` reports `configured: false`; `API-218` an unset key reports `configured: false` with a `null` value, not a `500`.

### `PATCH /api/admin/settings`
- **Happy path**: `API-219` as an admin, `{RESEND_..._API_KEY: "re_live_x"}` → `200`; a subsequent `GET` shows `configured: true` with the value masked, and the next student creation attempts a real send.
- **Validation failures**: `API-220` unknown/unlisted key → `422` (or ignored — assert the implemented choice) and no arbitrary row is written; `API-221` non-string value → `422`.
- **Auth failures**: `API-222` anonymous → `401`; `API-223` as alice → `403` and no `SystemSetting` row changes.
- **Idempotency / edge cases**: `API-224` writing the same key twice upserts (one row, `updated_at` advanced); `API-225` an env var takes precedence over the stored setting when both are present and the env value is not the placeholder; `API-226` the new value takes effect without a restart.

## UI / journey tests

### Journey: App shell renders and is acceptance-clean
- **Steps**: load `/` in a fresh browser with the app deployed.
- **Expected outcomes**: an element with `data-testid="app-ready"` is present (`UI-001`); the page does **not** contain the rejected scaffold signatures `home-title">Users<`, `Loading...` (as a stuck terminal state), or `Failed to load users.` (`UI-002`); no console errors (`UI-003`); the placeholder scaffold home is replaced by the bidding app's landing/redirect (`UI-004`).
- **Negative path**: with the backend down, the shell still renders `app-ready` and shows an error banner rather than a blank page or an infinite `Loading...` (`UI-005`).

### Journey: Admin login and logout
- **Steps**: visit `/admin/login` → type `root@school.edu` / `RootPw!234` → submit → land on `/admin` → open the nav menu → click **Log out**.
- **Expected outcomes**: URL becomes `/admin` (`UI-006`); the dashboard shows window status and counts (`UI-007`); the admin nav section is visible (`UI-008`); after logout the URL is `/admin/login` and revisiting `/admin` redirects back to the login page rather than flashing the dashboard (`UI-009`).
- **Negative path**: wrong password shows the server's generic 401 message verbatim, keeps the user on `/admin/login`, does not reveal whether the username exists, and leaves the password field clearable (`UI-010`).

### Journey: Unauthenticated access is redirected by role
- **Steps**: with no session, visit `/classes`, then `/my-bids`, then `/admin`, then `/admin/accounts`.
- **Expected outcomes**: student paths redirect to `/login` (`UI-011`); admin paths redirect to `/admin/login` (`UI-012`); no protected data renders even momentarily (`UI-013`).
- **Negative path**: a student signed in at `/classes` who navigates to `/admin` is refused (redirect or an explicit "not authorised" screen), never shown admin data (`UI-014`); an admin visiting `/my-bids` is likewise refused (`UI-015`).

### Journey: Student logs in from the emailed token link
- **Steps**: admin creates student Dave → capture the raw token from the stubbed email → open `{APP_BASE_URL}/login/token?token=<raw>`.
- **Expected outcomes**: the page auto-submits with a pending state and no manual click (`UI-016`); lands on `/classes` authenticated as Dave (`UI-017`); the balance meter reads `1000` available (`UI-018`).
- **Negative path**: reopening the same link shows an inline "link already used" error on `/login/token` and offers a route to request a new one (`UI-019`); an expired token shows an "expired" message (`UI-020`); `/login/token` with no `?token=` shows a manual paste form rather than an error (`UI-021`).

### Journey: Public signup is disabled
- **Steps**: visit `/signup` with `ALLOW_PUBLIC_SIGNUP=false`.
- **Expected outcomes**: a "public signup is disabled — contact an administrator" state renders with a link to `/login` (`UI-022`); no form is submittable (`UI-023`).
- **Negative path**: with the flag enabled, a working form renders and a duplicate email surfaces the `409` message inline (`UI-024`).

### Journey: Student browses and searches classes
- **Steps**: as alice on `/classes`, type `fin` into search, then change sort to `seat_cap`, then reload the page.
- **Expected outcomes**: the URL updates to `/classes?q=fin&sort=seat_cap` (`UI-025`); the list filters to `FIN101` (`UI-026`); the sort order changes accordingly (`UI-027`); after reload the query params are re-applied so the view is shareable (`UI-028`); each row shows name, seat cap, and *only* alice's own bid (`UI-029`).
- **Negative path**: a query matching nothing renders an explicit empty state, not a spinner or blank region (`UI-030`); a failed fetch renders `ErrorBanner` with a retry action (`UI-031`).

### Journey: Student places a bid
- **Steps**: as alice with the window open, open `/classes/:id?modal=bid` for `OPS300` → enter `300` → submit.
- **Expected outcomes**: the modal opens from the URL and is deep-linkable (`UI-032`); on success the modal closes, a success indicator appears, the balance meter drops to `700` available while committed stays `1000` (`UI-033`), and the class row shows her active bid (`UI-034`); `/my-bids` lists it without a manual refresh (cache invalidation) (`UI-035`).
- **Negative path**: `amount = 0` and negative amounts are blocked client-side with an inline message and no network call (`UI-036`); an amount above `available` is blocked client-side with the same rule the server enforces (`UI-037`); when the server nonetheless returns `422` (e.g. a race at close), the server message is surfaced **verbatim** and the modal stays open with the input intact (`UI-038`).

### Journey: Student edits an existing bid
- **Steps**: as alice with a `300` bid on `OPS300`, reopen the bid modal → change to `450` → submit.
- **Expected outcomes**: `/my-bids` still shows exactly **one** bid for that class at `450` — never two (`UI-039`); available balance is `550` (`UI-040`); the form pre-fills with the current amount (`UI-041`).
- **Negative path**: raising the amount beyond `available + current bid` is rejected with a clear message and the original bid is unchanged (`UI-042`).

### Journey: Student cancels a bid
- **Steps**: as alice on `/my-bids`, click **Cancel** on her `450` bid → confirm.
- **Expected outcomes**: the bid disappears from the active list (`UI-043`); available balance returns to `1000` (`UI-044`); the class list no longer shows an active bid for that class (`UI-045`).
- **Negative path**: if the window closes between render and click, the server `422` is surfaced and the bid remains `active` in the refreshed view (`UI-046`).

### Journey: Bidding is disabled when the window is closed
- **Steps**: admin sets the window to `CLOSED` → as alice visit `/classes` and `/classes/:id`.
- **Expected outcomes**: `WindowStatus` renders `closed` (`UI-047`); bid/edit/cancel controls are disabled (`UI-048`); an explanatory banner states why (`UI-049`).
- **Negative path**: with a `PENDING` window, controls are likewise disabled and the banner names the open time and countdown (`UI-050`).

### Journey: Student views results after resolution
- **Steps**: with bids placed and the window closed, wait for the scheduler (≤10s) → as alice visit `/results`.
- **Expected outcomes**: one row per resolved bid with class name, amount, and `won`/`lost` (`UI-051`); total points spent is shown and matches the balance drop (`UI-052`); the balance meter reflects the deduction, with losers **not** refunded (`UI-053`).
- **Negative path**: before resolution, `/results` shows an explicit "results are not available until the window closes" empty state rather than an error (`UI-054`).

### Journey: Root admin creates an admin account
- **Steps**: as root, `/admin/accounts?tab=admins` → open `?modal=new-admin` → fill username/password → submit.
- **Expected outcomes**: the modal is URL-driven (`UI-055`); the new admin appears in the list without a reload (`UI-056`); the new admin can log in (`UI-057`).
- **Negative path**: a duplicate username surfaces the `409` message inline and the modal stays open (`UI-058`); signed in as a **non-root** admin, the create action is hidden or disabled and a direct attempt surfaces the `403` explanation (`UI-059`).

### Journey: Root admin creates a student and handles email failure
- **Steps**: as root, `/admin/accounts?tab=students&modal=new-student` → enter Dave's name/email → submit, first with the mailer succeeding, then with it failing.
- **Expected outcomes**: on success the student appears with balance `1000` and a delivery confirmation (`UI-060`); on failure the student **still appears in the list** (`UI-061`) and a **persistent** `ErrorBanner` reports that the email was not delivered — it must not be a transient toast (`UI-062`); each student row exposes a **Resend token** action (`UI-063`).
- **Negative path**: clicking **Resend token** issues a new link and shows the same success/failure banner treatment (`UI-064`); an invalid email is rejected inline before submit (`UI-065`).

### Journey: Admin creates and edits a class
- **Steps**: as an admin, `/admin/classes?modal=new` → name `STR400`, seat cap `12` → submit → then `/admin/classes/:id/edit` → change seat cap to `20` → save.
- **Expected outcomes**: the class appears in the admin list and in the students' `/classes` (`UI-066`); the edit persists and is visible after reload (`UI-067`).
- **Negative path**: seat cap `0` or negative is blocked before submit with an inline message (`UI-068`); an empty name is blocked before submit (`UI-069`); a server `422` that slips past client validation is surfaced verbatim (`UI-070`).

### Journey: Admin sets the bidding window
- **Steps**: as an admin, `/admin/window` → set `opens_at` in the past and `closes_at` one hour out → save.
- **Expected outcomes**: the saved window is reflected on `/admin` and in students' `WindowStatus` as `open` with a countdown (`UI-071`); a warning explains that saving a future close time starts a **new round** and clears prior resolution (`UI-072`).
- **Negative path**: `closes_at <= opens_at` is rejected **before** submit with an inline message and no network call (`UI-073`); a server `422` is surfaced verbatim (`UI-074`).

### Journey: Admin reviews per-class results
- **Steps**: after resolution, as an admin visit `/admin/classes/:id/results` for `FIN101`.
- **Expected outcomes**: a table of every bidder's name, amount, and outcome sorted by amount descending (`UI-075`); winners are visually distinguished and the count of winners never exceeds `seat_cap` (`UI-076`).
- **Negative path**: before resolution the page shows an "not yet resolved" empty state (`UI-077`); an unknown class id shows a not-found state, not a crash (`UI-078`).

### Journey: Admin performs a destructive point reset
- **Steps**: as an admin on `/admin`, open `?modal=confirm-reset` → attempt confirm with an empty box → type the exact required phrase → confirm.
- **Expected outcomes**: the confirm button is **disabled** until the phrase matches exactly (`UI-079`); after confirming, every student's balance shows `1000` (`UI-080`), active bids are gone from `/my-bids` (`UI-081`), and the window shows as unresolved so a new round can run (`UI-082`).
- **Negative path**: a mistyped phrase never fires the request (`UI-083`); cancelling the modal changes nothing (`UI-084`); the modal copy clearly states the action is irreversible (`UI-085`).

### Journey: Admin configures integration credentials
- **Steps**: as an admin visit `/admin/settings` with the Resend key unset → enter a key → save.
- **Expected outcomes**: a prominent banner lists what needs credentials ("The following need credentials to activate: Resend REST API, PostgreSQL") (`UI-086`); each service shows a configured/unconfigured badge and a **masked** current value — never plaintext (`UI-087`); after saving, the badge flips to configured without a restart (`UI-088`).
- **Negative path**: as a student, `/admin/settings` is refused (`UI-089`); a save that fails server-side surfaces the error and leaves the badge unchanged (`UI-090`).

### Journey: End-to-end round — three students, one seat
- **Steps**: admin creates `FIN101` (cap 1) and a window closing ~60s out → alice bids `500`, bob `300`, carol `300` → wait past close for the scheduler.
- **Expected outcomes**: within ~10s of close, `/results` shows alice `won` and bob/carol `lost` (`UI-091`); alice's balance is `500`, bob's `700`, carol's `700` — losers are **not** refunded (`UI-092`); `seats_taken` for `FIN101` reads `1` on `/classes`, having read `0`/blank before resolution (`UI-093`); no student's page ever displays another student's bid amount at any point in the round (`UI-094`).
- **Negative path**: reloading everything after resolution shows identical numbers (no double deduction) (`UI-095`); a bid attempt after close is refused with `422` and the closed-window banner (`UI-096`).

## Data integrity tests
- `DATA-001` **Resolution — winner selection**: `FIN101` cap 1 with bids 500/300/300 → exactly one `won`, two `lost`, zero remaining `active` for that class.
- `DATA-002` **Cap overflow**: `MKT200` cap 2 with five bids (900/800/700/600/500) → the top two are `won`, the other three `lost`; the winner count never exceeds `seat_cap`.
- `DATA-003` **Random tie-break**: five students bid an identical `400` on a cap-1 class; over ≥30 independent resolution runs (reset between runs) every student wins at least once and no single student wins more than ~80% of the time — deterministic first-inserted-always-wins is a failure.
- `DATA-004` **No refund for losers**: after resolution, `point_balance = 1000 − Σ(amount of all won AND lost bids)` for every student.
- `DATA-005` **Cancelled bids never deduct**: a cancelled bid leaves `point_balance` untouched at resolution and is excluded from winner selection.
- `DATA-006` **Idempotent resolution**: invoking the resolver twice (and letting the 10s scheduler tick repeatedly) produces exactly one deduction per bid — balances after N ticks equal balances after 1.
- `DATA-007` **Advisory lock**: two concurrent `resolveWindow()` calls (or two app replicas) serialise via `pg_advisory_xact_lock`; no double deduction and no deadlock error.
- `DATA-008` **Resolution atomicity**: a fault injected after marking winners but before the balance update rolls back everything — no bid is left `won` with `resolved_at` still `NULL` and no balance is half-applied.
- `DATA-009` **Resolution preconditions**: the resolver no-ops when no window exists, when `now < closes_at`, or when `resolved_at IS NOT NULL`; `resolved_at` is set exactly once per round.
- `DATA-010` **Partial unique index**: a direct SQL insert of a second `active` bid for the same `(student, class)` violates the index; two `cancelled` rows for the same pair are permitted.
- `DATA-011` **Amount check constraint**: direct SQL insert of `amount = 0` or a negative amount is rejected by `CHECK (amount > 0)`.
- `DATA-012` **Seat-cap check constraint**: direct SQL insert/update of `seat_cap = 0` is rejected by `CHECK (seat_cap > 0)`.
- `DATA-013` **Window check constraint**: direct SQL insert with `closes_at <= opens_at` is rejected.
- `DATA-014` **Window singleton**: the `bidding_window` table never holds more than one row; repeated `PUT` upserts `id = 1`.
- `DATA-015` **Balance invariant while open**: at all times `Σ(active bid amounts) <= point_balance` for every student, verified after every mutation in the bid lifecycle suite.
- `DATA-016` **Token hashing**: `login_tokens.token_hash` is a 64-char hex SHA-256 and no raw token is ever persisted or logged.
- `DATA-017` **Token single use**: `used_at` is non-null after a successful login and that row can never authenticate again.
- `DATA-018` **Token uniqueness**: `token_hash` has a unique constraint; a duplicate insert fails.
- `DATA-019` **Password storage**: `passwordHash` starts with `$argon2`; no plaintext password exists in any column or log line.
- `DATA-020` **Cascade**: deleting a student removes their `login_tokens`; bids are handled per the implemented policy without leaving orphan FKs.
- `DATA-021` **Point reset invariants**: after reset, every `point_balance = 1000`, zero `active` bids remain, `resolved_at IS NULL`, and the count of `won` + `lost` rows is unchanged from before the reset.
- `DATA-022` **Seat-taken derivation**: `seats_taken` equals `COUNT(bids WHERE status = 'won')` per class post-resolution and is `0`/`null` while `resolved_at IS NULL`.
- `DATA-023` **Root-admin seeding is idempotent**: booting the app three times yields exactly one `isRoot` admin; with the env vars unset it logs a warning, creates nothing, and still boots.
- `DATA-024` **Migration cleanliness**: `prisma migrate deploy` (or `alembic upgrade head`) applies to an empty database and is re-runnable; `prisma migrate status` reports no drift.
- `DATA-025` **Performance NFR**: 200 active bids spread across ≥10 classes resolve in a single run in **under 30 seconds**, and no bid is left `active`.
- `DATA-026` **Bid write latency**: with the window open and concurrent writers, p95 latency of `POST /api/bids` stays under 500 ms; the class-detail read path never blocks on a bid write lock.

## Out of scope
- **Emails actually leaving the building.** The Resend HTTP call is stubbed in all automated tests; real deliverability and domain verification are a launch checklist item (flagged as a spec risk), not a test gate.
- **Tie-break auditability.** The spec explicitly accepts that `random()` tie-breaks are not reproducible, so no test asserts a specific ordering for equal bids beyond the statistical fairness check in `DATA-003`.
- **MinIO / object storage.** Provisioned by the deployment but the spec describes no upload feature; only its presence as a credential section on `/admin/settings` is tested (`UI-086`/`UI-087`).
- **Multi-window history.** The spec stores exactly one window row; there is no round archive, so nothing tests historical window records.
- **Password reset / self-service email change for students.** The spec provisions all accounts via the root admin and re-issues access with `resend-token`; no other recovery flow exists.
- **Admin password change, admin deletion, student deletion, class deletion.** No endpoints are specified for these.
- **Rate limiting, CAPTCHA, and account lockout** on the login endpoints — unspecified. `API-027` covers non-enumeration, but brute-force resistance is untested.
- **CSRF tokens.** The spec justifies their absence via same-origin `SameSite=Lax` + JSON-only endpoints; only the cookie attributes are asserted (`API-021`).
- **Notification of results by email.** The spec sends only login tokens.
- **Accessibility, responsive breakpoints, and browser matrix.** The spec sets no requirements; only functional DOM assertions are made.
- **Partial refunds or bid-amount proration.** The spec is explicit that losers are not refunded and there is no partial-award model.
- **Concurrent multi-window / multi-tenant isolation.** The system is single-cohort by design.
