# 7.5 · Lista de verificación manual del demo (KAN-160)
Objetivo: una lista corta, en el repositorio, para comprobar a mano que pantalla y API reales trabajan juntas antes de cada demo.
Rama: `feat/v2-7-5-lista-verificacion-demo`. Entrega: un PR. Solo documentación: sin código de producción ni pruebas nuevas.

## Specs
- S1: «cubre los tres recorridos con la pantalla real: alta y equipo, conciliación de un mes, y revisión».
- S2: «cada paso» → «dice qué se debe ver, y si falla, qué se debe revisar».
- S3: «incluye revisar una pantalla de cada flujo en los dos temas y comprobar que ningún monto se sale de su caja».
- S4: «un entorno recién levantado con la historia 1.7» → «puede completarla en una sesión con los archivos de ejemplo de la historia 7.1».
- S5: «hay un lugar para anotar la fecha, quién la corrió y qué falló».

## Supuestos
- A1: el archivo es `docs/verificacion-demo.md`, junto a `docs/despliegue.md`, en español como los demás documentos del proyecto.
- A2: los CFDI del juego de 7.1 son de la Ferretería del seed (`FDB190215QK4`), así que la conciliación (recorrido B) usa esa empresa y a sus personas del seed. El alta (recorrido A) crea otra empresa y, en Ferretería, invita al revisor y a la auditora que usa el recorrido C.
- A3: en desarrollo el correo es simulado y el enlace de cada invitación sale en el log de la API (`correo.module.ts`); la lista lo dice en cada paso que lo necesita.
- A4: el motor corre solo tras procesar una carga y tras aceptar la vista previa; la lista no lo dispara a mano.
- A5: «Reabrir lote» vive en el recuadro del resultado del lote recién confirmado; «Confirmar en lote» abre con la regla 1 marcada y lo demás desmarcado (FR-18).
- A6: los pasos se escribieron leyendo los mockups aprobados (1, 2, 3, 4, 6, 10, 12, 16, 18 y sus temas claros) y el frontend; el primer recorrido real en el navegador es la verificación de la propia lista.
- A7: la verificación de la muestra mensual (épica 9) queda como un paso pendiente en el recorrido C.

## Tasks
- [x] T1 (S1-S5; inline): `docs/verificacion-demo.md`. Sin RED: es documentación pasiva. Comprobado contra el código: comandos y scripts existen, usuarios y contraseña del seed, rutas del router, textos de los mockups y del frontend, y el comportamiento del lote y de la reapertura.
- [x] T2: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «arranca, si» (historia 7.5 según la lista de historias).
