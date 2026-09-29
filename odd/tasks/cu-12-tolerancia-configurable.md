# CU-12 Tolerancia configurable (KAN-89)

## Objective

Move the matching tolerance from a code constant (`ToleranciaConstante`, 0 MXN)
to each company's configuration, strict by default, loosened only on purpose.

## Acceptance criteria (Jira)

1. The tolerance lives in the company's configuration, not in code.
2. The default is strict; it is loosened on purpose, never the other way around.

## Decisions (user-approved 2026-09-29)

| # | Decision |
|---|---|
| D1 | Absolute amount in MXN (no percentage). |
| D2 | Range 0 ≤ tolerance ≤ 100.00 MXN, enforced by a DB `CHECK`; negatives rejected. |
| D3 | `companies.tolerancia_monto numeric(18,4) NOT NULL DEFAULT 0`. |
| D4 | Only role `admin` may change it (first admin-only route). |
| D5 | Every change is written to `bitacora` as `actualizar` with previous and new value. |
| D6 | Changing it does NOT re-run `conciliar`; applies from the next run. |
| D7 | Endpoints now: `GET /empresa/tolerancia` and `PUT /empresa/tolerancia`. |
| D8 | Stored as a column on `companies` with `GRANT UPDATE (tolerancia_monto)` to `cuadra_app`; company always from the session token, never from body/params. |
| D9 | Tolerance applies only to MXN pairs; other currencies stay exact (0). |

## Requirements

- R1 Migration (timestamp > 1790708600000): add column (D3) + `CHECK` (D2) +
  column-level `GRANT UPDATE` (D8); `down()` reverses. Entity updated; drift and
  reversibility tests in `esquema.spec.ts` stay green.
- R2 `ToleranciaPorEmpresa` replaces `ToleranciaConstante` in
  `conciliacion.module.ts`; keeps token `ProveedorTolerancia` and method
  `obtener(companyId): Promise<Dinero>` (existing spies rely on it). Reads
  `companies.tolerancia_monto` filtered by id, as text into `dinero()`; never `Number`.
- R3 Engine: tolerance used only when the pair's currency is MXN; otherwise 0 (D9).
- R4 `GET /empresa/tolerancia` returns the current value as a string (any member
  of the company). `PUT /empresa/tolerancia` with `@Roles('admin')`, body amount
  as a decimal string validated with `esDecimal` and range (D2); 400 on invalid,
  403 for non-admin (logged as `acceso_denegado` by the existing guard).
- R5 `PUT` updates the column and writes a `bitacora` row (`actualizar`, entidad
  `companies`, entidad_id = company, datos with antes/después, user_id) in the
  same `TransaccionEmpresa`; no conciliation re-run (D6).
- R6 Tests: migration/default/CHECK; provider reads per company (isolation:
  company A's value never used for B); MXN vs non-MXN behaviour; endpoint roles,
  validation, bitacora row; end-to-end: loosened tolerance turns a
  `referencia_monto_diferente` case into `referencia_monto_exacto` on the next load.

## Scope / constraints

- Branch `feat/cu-12-tolerancia` (off master). No push/merge.
- Route: direct (ODD), SDD-style rigor. TDD not configured; checks:
  `npm run typecheck`, `npm test`, eslint on touched files (no --fix).
- Out of scope: percentage tolerance, re-running conciliation, UI, CU-13+.
- Forecast < 400 authored lines. Delivery: ask-on-risk.

## Tasks

- [x] T1 R1+R2+R3 migration, entity, provider, engine currency rule + tests. Route: delegated.
- [x] T2 R4+R5 endpoints, DTO, bitacora + integration tests. Route: delegated.
- [ ] T3 CUADRA.md bitácora; Jira KAN-89 Finalizado. Route: inline.

## Progress / evidence

### T1 (done, commit f3c3373)

- Route: delegated (single writer).
- Migration `1790708700000-ToleranciaPorEmpresa`: column numeric(18,4) NOT NULL
  DEFAULT 0, CHECK `ck_companies_tolerancia_monto_rango` (0..100), `GRANT UPDATE
  (tolerancia_monto)` to cuadra_app; `down()` reverses. Entity updated.
- R2: `ToleranciaPorEmpresa` reads `companies.tolerancia_monto::text WHERE id = $1`
  through the app `DataSource` (own connection; companies has no RLS, cuadra_app has
  SELECT). Token and `obtener(companyId)` signature unchanged, so the existing spy in
  `conciliacion.integracion.spec.ts` still works. Missing company falls back to 0.
- R3: `toleranciaEn(moneda, tolerancia)` in `evaluar-par.ts`, used by `evaluarPar` and
  the `porMonto` predicate of `seleccionarPropuestas`.
- Tests: `esquema.spec` (default 0, exact decimals, CHECK, column grant),
  `evaluar-par.spec` (MXN vs USD, inclusive edge), `conciliacion.integracion.spec`
  (provider per company, isolation A/B through the engine, USD ignores tolerance).
- Checks: typecheck clean; `npm test -- src/conciliacion src/database`: 8 suites,
  161 tests passed.


### T2 (done; commit hash is in `git log`, a commit cannot cite itself)

- Route: delegated (same writer).
- Placement: `src/companies/` (`CompaniesModule`, `EmpresaController` at `/empresa`,
  `ToleranciaService`, `dto/tolerancia.dto.ts`); registered in `AppModule` and in the
  shared test app (`app-de-cargas.ts`).
- `GET /empresa/tolerancia` any member; `PUT` `@Roles('admin')`. Body validated by
  `ToleranciaValida` (`esDecimal`, `^\d+(\.\d{1,4})?$`, <= 100 via decimal.js).
  Company always from `@UsuarioActual` (body `companyId` is rejected by the global
  `forbidNonWhitelisted` pipe).
- Write uses the request's `TransaccionEmpresa` manager (interceptor): a raw
  `UPDATE ... FROM (SELECT ... FOR UPDATE)` touching only `tolerancia_monto` (the only
  granted column, so `updated_at` is not bumped) plus the `bitacora` insert
  (`actualizar`, `companies`, datos `{campo, antes, despues}`), atomic. `ck_bitacora_accion`
  already allowed `actualizar`; RLS INSERT passes since `app.company_id` is set.
- Tests: `src/companies/tolerancia.integracion.spec.ts` (26): GET roles/401/isolation,
  PUT 403 (+ `acceso_denegado`), 400 matrix, boundaries, bitacora antes/despues,
  B-only change, and end to end referencia_monto_diferente (0.5, -60.0000) ->
  no re-run on PUT (D6) -> next run referencia_monto_exacto (1.0, -60.0000).
