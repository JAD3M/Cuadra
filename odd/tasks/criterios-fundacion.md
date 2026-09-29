# Criterios de Fundación (CU-01, CU-03, CU-04)

## Objective

Close the acceptance criteria that the audit of 2026-09-29 found unmet in
stories already marked done in Jira (KAN-78, KAN-80, KAN-81).

## Problem

- CU-01.2: `/health` only reports Postgres; Redis is not reported.
- CU-01.3: missing-env-var startup failure has no test.
- CU-01: `test/app.e2e-spec.ts` is the Nest boilerplate (`GET /` → "Hello World!").
- CU-03.3: a 403 by role is returned but not written to `bitacora`.
- CU-04.2: no CI pipeline; the isolation test never fails a build.

## Scope / constraints

- Branch `fix/criterios-fundacion`. No push, no PR, no merge (user decides).
- Project rules from CLAUDE.md apply: company_id on every domain query,
  RLS + GRANTs for cuadra_app, NUMERIC money, snake_case columns.
- Out of scope: CU-11..CU-18, CU-08.2 backoff test, CUADRA.md spec drift.
- TDD: not configured (source: none found). Ordinary checks:
  `npm run typecheck`, `npm test` (Postgres + Redis running).
- Delivery strategy: ask-on-risk. Forecast < 400 authored lines.

## Tasks

- [x] T1 CU-01: `/health` reports Redis; e2e/integration test for `/health`;
      test that `validateEnv` fails naming the missing variable. Route: delegated.
- [ ] T2 CU-03.3: 403 by role writes an entry to `bitacora` (company_id,
      user_id, accion, datos). Test it. Route: delegated.
- [ ] T3 CU-04.2: CI workflow running typecheck + tests with Postgres 18 and
      Redis services. Route: delegated.
- [ ] T4 Update CUADRA.md bitácora; mark KAN-78/80/81 as Finalizado.

## Acceptance

Each criterion above has implementation + passing test; `npm test` and
`npm run typecheck` green.

## Progress / evidence

- T1 (0594489): `/health` now reports `redis` via `RedisHealthIndicator`
  (short-lived ioredis connection from `REDIS_URL`, 2 s timeouts, no retry);
  200 with both up, 503 with per-dependency detail. Tests:
  `src/health/health.integracion.spec.ts` (up / redis down),
  `src/config/env.validation.spec.ts` (missing var named). Boilerplate
  `test/app.e2e-spec.ts` removed together with dead `test/jest-e2e.json` and
  the `test:e2e` script/README line: the e2e config was Nest boilerplate that
  never ran in `npm test` and asserted a `GET /` that does not exist.
  Verification: `npm run typecheck` ok; `npm test` 13 suites / 215 tests ok;
  eslint on touched files ok.

