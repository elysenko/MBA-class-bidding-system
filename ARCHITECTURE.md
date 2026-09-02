# Architecture

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL)

Note: the technical plan for this project described a FastAPI/React feature set, but the
platform stack for this app is fixed to `enterprise` at app-creation time. This scaffold
provides the Angular + NestJS + tRPC + Prisma structure; the plan's **features** (auth,
bidding, classes, resolution, etc.) should be implemented on top of this stack rather than
by introducing FastAPI/React.

## Scaffolding result
- ✅ `enterprise` — newly scaffolded (no prior `frontend/angular.json` or `backend/nest-cli.json` found)

## Layout
- `frontend/` — Angular 19 app (standalone components, signals), served via nginx with SPA fallback in production. Entry: `frontend/src/app/app.component.ts`. Home route: `frontend/src/app/home/home.component.ts`.
- `backend/` — NestJS app exposing a tRPC router (`backend/src/trpc/`) and a REST health check (`backend/src/health/health.controller.ts`). Data access via Prisma (`backend/src/prisma/`), example domain module `backend/src/users/`.
- `.pipeline/surface.json` — machine-readable manifest of routes, components, and `data-testid` values; kept in sync as features are added.
- `.colossus-acceptance.json` — post-deploy render-gate contract (readiness test id + reject signatures for the untouched template stub).
- `colossus.yaml` — build manifest read by deploy agents (framework, output dir, ports, backend build config).

## Next steps for the developer
1. Copy env templates if/when they are added (`backend/.env.template` → `backend/.env`); none exist yet in this template revision.
2. Configure `DATABASE_URL` for PostgreSQL and run Prisma migrations: `cd backend && npx prisma migrate dev`.
3. Install dependencies and run locally: `cd frontend && npm install && npm start`; `cd backend && npm install && npm run start:dev`.
4. Implement the plan's domain model (Admin, Student, LoginToken, Class, Bid, BiddingWindow) as Prisma models + NestJS/tRPC routers, replacing/extending the sample `users` module.
5. Build out the Angular routes/components/pages described in the plan (login, class list/detail, bids, results, admin screens), updating `.pipeline/surface.json` and `.colossus-acceptance.json` (`expect_text`) as real UI lands.
6. Wire up session-cookie auth, Resend email integration, and the scheduled bid-resolution job inside the NestJS backend.

## Template sources
- `template-enterprise/` from the scaffold template library, copied directly into the project root.
