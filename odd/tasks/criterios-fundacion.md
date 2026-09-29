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
- [x] T2 CU-03.3: 403 by role writes an entry to `bitacora` (company_id,
      user_id, accion, datos). Test it. Route: delegated.
- [x] T3 CU-04.2: CI workflow running typecheck + tests with Postgres 18 and
      Redis services. Route: delegated.
- [x] T4 Update CUADRA.md bitácora; mark KAN-78/80/81 as Finalizado.

## Acceptance

Each criterion above has implementation + passing test; `npm test` and
`npm run typecheck` green.

## Progress / evidence

- T1 (ae199f3): `/health` now reports `redis` via `RedisHealthIndicator`
  (short-lived ioredis connection from `REDIS_URL`, 2 s timeouts, no retry);
  200 with both up, 503 with per-dependency detail. Tests:
  `src/health/health.integracion.spec.ts` (up / redis down),
  `src/config/env.validation.spec.ts` (missing var named). Boilerplate
  `test/app.e2e-spec.ts` removed together with dead `test/jest-e2e.json` and
  the `test:e2e` script/README line: the e2e config was Nest boilerplate that
  never ran in `npm test` and asserted a `GET /` that does not exist.
  Verification: `npm run typecheck` ok; `npm test` 13 suites / 215 tests ok;
  eslint on touched files ok.

- T2 (f7ddf77):
  `RolesGuard` calls `AccesosDenegados.registrar` before throwing 403 (role
  insufficient, or no membership: `datos.motivo` tells them apart). Guards run
  before `TransaccionEmpresaInterceptor`, so the service opens its own
  `TransaccionEmpresa.ejecutar(companyId)` (sets `app.company_id`, RLS
  `WITH CHECK` passes as `cuadra_app`). `company_id` comes from the signed
  session token, never from the request. Insert failure is caught and logged;
  403 is preserved. Migration `AccesoDenegadoEnBitacora` widens
  `ck_bitacora_accion` with `acceso_denegado` (no new table: RLS/GRANTs already
  exist). Row: entidad `companies`, entidad_id = company_id. Tests: guard unit
  spec, service unit spec, 5 integration cases in `auth.integracion.spec.ts`
  (one row, RLS isolation, no membership, allowed access writes nothing,
  logging failure still 403). Verification: `npm run typecheck` ok;
  `npm test` 14 suites / 224 tests ok; eslint on touched files ok.

- T3 (commit `ci: typecheck y tests con Postgres y Redis en cada push`):
  `.github/workflows/ci.yml` on push and pull_request: Node 24 (matches local
  v24.19.0; repo has no engines/.nvmrc), `npm ci`, `npm run typecheck`,
  `npm test`. Services `postgres:18-alpine` and `redis:7-alpine` as in
  docker-compose.yml; env vars from `validateEnv`. No separate migration step:
  the DB specs create `<base>_test`, migrate and seed it themselves (the
  `cuadra_app` role comes from the AislamientoRls migration). `npm test` runs
  `aislamiento.spec.ts` and `rls.spec.ts`, so an isolation failure fails the
  build. Verified locally: `@action-validator/cli` on the workflow ok; full
  suite with `.env` removed and a clean `env -i` environment against a fresh
  database: 14 suites / 224 tests ok. Not verified: an actual GitHub run.

- T3 commit: d4944c2.
- Review: lineage review-838e40f2c48416f3 (4 lenses) approved and acknowledged;
  advisory-only findings recorded in CUADRA.md bitácora (29 sep).
- T4: CUADRA.md bitácora 29 sep entry; Jira KAN-78/80/81 moved to Finalizado.
