# Historia 5.9: Dejar un comentario sobre una confirmación ajena

Rama: `feat/v2-5-9-backend` (cadena: backend, frontend)
Jira: KAN-152 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.9, FR-68)
Spine: AD-7, AD-11
Mirror Engram: `odd/v2-5-9-comentar-confirmacion/tasks`
Runner: backend `npm test -- <spec>` (Docker arriba); frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; cadena de PR. Todo lo que el frontend espeja del backend (acción `comentar`, etiquetas, tonos, detalle de bitácora) va en el MISMO PR que el cambio de `tipos.ts`. Inicio 2026-11-10.

## Specs

- S1: «se crea `decision_comentarios` (clase 1, solo agregar) con `company_id`, RLS con FORCE, su política y `SELECT` e `INSERT` para `cuadra_app`» y «queda registrada en `entidades.ts`, `TABLAS_CON_RLS` y `TABLAS_DOMINIO`».
- S2: «escribe un comentario de texto libre sobre un caso»: «se guarda en `decision_comentarios` con persona y fecha, se ve en el detalle del caso y queda en la bitácora como `comentar`».
- S3: «no cambia el estado de la decisión ni reabre, rechaza o edita nada» y «no se puede editar ni borrar».
- S4: «una persona con rol `auditor`»: «puede leer los comentarios pero no ve el campo para escribir».
- S5: «la contadora reabre con la historia 5.7, porque el comentario no hace nada por sí solo».
- S6: «el texto de un comentario vacío» «se rechaza con un mensaje claro».
- S7: «La acción `comentar` se registra en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva. El comentario necesita mockup antes del código (UX-DR9).»
- Supuesto A1: ruta `POST /conciliaciones/:id/comentarios {texto}` con permiso existente `conciliaciones.comentar` (admin, contador, revisor); `:id` es el id de la decisión. Texto recortado, máximo 1000.
- Supuesto A2: se puede comentar una decisión en cualquier estado (el criterio habla de confirmaciones, pero «sobre un caso»); 404 si no existe en la empresa.
- Supuesto A3: `GET /casos/:id` suma `comentarios` y `puedeComentar` (calculado en el servidor).

## Tasks

- [x] T1 (commit 1f4859e; S1-S3, S6-S7 backend + espejo mínimo del frontend, inline; Risk item 2: tabla de dominio nueva con RLS y GRANTs): migración, entidad, registros, `comentar` en `tipos.ts` y su espejo, `POST /conciliaciones/:id/comentarios`, `comentarios` y `puedeComentar` en `GET /casos/:id`, pruebas.
- [x] T2 (aprobado por el usuario; canvas v156; mockup, S4-S5, UX-DR9; números 3, 8 y 6): comentarios en el detalle del caso y `comentar` en la bitácora. Acordar con el usuario ANTES del código.
- [x] T3 (un escritor por respaldo de contexto; frontend, S2, S4, S6): contrato, hook, formulario y lista, etiquetas, tono y detalle de bitácora.

## Log

- L1 (2026-11-10): «hay que seguir» (retomar con la 5.9, siguiente en la lista).
- Mapa del explorador: el permiso `conciliaciones.comentar` ya existe en `matriz.ts` y su espejo; `comentar` no está en `ACCIONES_BITACORA`; la migración de la 5.7 (`1790716000000`) es la plantilla del CHECK (su lista «antes» debe incluir `'reabrir'`); la última migración es `1790717000000`; agregar `comentar` rompe la compilación del frontend hasta añadirlo en `etiquetas.ts` y `tonos.ts`.
- T1 hecha (inline, una unidad): migración 1790718000000 (`decision_comentarios` con RLS FORCE, política, GRANT solo SELECT e INSERT, FK RESTRICT, CHECK de texto 1..1000 y `comentar` en `ck_bitacora_accion`), entidad, registros (`entidades.ts`, `TABLAS_CON_RLS`, `TABLAS_DOMINIO`), `comentar` en `tipos.ts` y su espejo (etiqueta «Comentario», tono neutral, detalle «comentario: …», filtro de la bitácora), `POST /conciliaciones/:id/comentarios` (201; 400 «El comentario no puede estar vacío»; 403 + acceso denegado al auditor; 404 si no existe en la empresa o no es una conciliación), y `comentarios` + `puedeComentar` en `GET /casos/:id`. RED observado: 10 de 11 fallaban antes del código. Se ajustaron cuatro pruebas existentes por el cambio (cuerpo del auditor en casos, lista de tablas posteriores en la migración 4.3, `TRUNCATE` con FK, mapa de tonos y filtro de acciones). Backend 1979 y frontend 4983 verdes; typecheck, lint y prettier del frontend verdes; 4 errores de lint de `plataforma.integracion.spec.ts` ya existían. Textos del frontend que no están en el mockup 6 y quedan a confirmar en T2: «Comentario» (filtro y etiqueta) y «comentario: …» (detalle). Risk: item 2 (tabla de dominio nueva con RLS y GRANTs; la bitácora cambia su CHECK). Verificador independiente: uno al final de la historia, no por unidad (verificación al cierre de varias entregas inline).
- T2 publicada (canvas v156): mockups 3 (Detalle oscuro), 8 (Detalle claro) y 6 (Bitácora). El detalle gana la tarjeta «Comentarios» (lista con quién y cuándo, «Aún no hay comentarios en este caso.», campo «Dejar un comentario» con contador 0 / 1000, error «El comentario no puede estar vacío.», botón «Comentar» y la nota «No cambia el caso ni lo reabre. Si estás de acuerdo con un comentario, reabre la confirmación.»; el auditor ve «Solo lectura: tu rol no puede dejar comentarios.» y no el campo) y el historial suma el evento «Comentario». Vistas nuevas `comentarios` (ahora la predeterminada) y `comentario_vacio`. La bitácora suma la acción «Comentario» (filtro, chip neutral y la fila «comentario: …»). Pendiente la aprobación del usuario antes de T3.
- Mockups 3, 8 y 6 aprobados por el usuario («apruebo los mockup»).
- T3 hecha (un escritor, razón: respaldo de contexto): contrato `comentarios` y `puedeComentar` obligatorios, `respuestaComentario`, hook `useComentarDecision`, tarjeta `ComentariosCaso`, evento «Comentario» en el historial, `CampoMotivo` con `maximo` opcional. RED observado: contrato 11 fallaban, hook sin módulo, página 14 de 15, historial 1. Frontend 5024 pruebas, typecheck, lint y prettier verdes (repetido por el padre). Textos fuera del mockup, a confirmar: «El comentario no puede pasar de 1000 caracteres.», «Comentando…» y «Enviando el comentario» (solo lectores de pantalla). Risk: none.
