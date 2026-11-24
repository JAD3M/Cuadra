import { z } from 'zod';

// Contratos de la API de plataforma (historia 1.3). Se derivan de
// src/plataforma/plataforma-auth.controller.ts y plataforma.controller.ts.
// Ojo con los nombres: el cuerpo del login usa `email` y las respuestas usan
// `correo`. Los objetos ignoran claves desconocidas; lo que falta falla en voz
// alta. Aquí no hay montos.

const id = z.guid();
const texto = z.string().min(1);

/** Cuenta del dueño de Cuadra tal como la devuelve el servidor. */
export const usuarioPlataforma = z.object({
  id,
  correo: z.email(),
});

/**
 * `POST /plataforma/auth/login` y `GET /plataforma/auth/me`. Sin token: la
 * sesión viaja en la cookie `httpOnly` y JavaScript no la lee.
 */
export const respuestaSesionPlataforma = z.object({
  usuario: usuarioPlataforma,
});

/** Cuerpo de `POST /plataforma/auth/login`. La contraseña viaja tal cual. */
export const solicitudLoginPlataforma = z.object({
  email: z.email(),
  password: texto,
});

/** Empresa de la lista de `GET /plataforma/empresas`. */
export const empresaPlataforma = z.object({
  id,
  razonSocial: texto,
  rfc: texto,
  /** `false` si el dueño desactivó la separación de funciones de esa empresa. */
  separacionFunciones: z.boolean(),
});

export const listaEmpresasPlataforma = z.array(empresaPlataforma);

/**
 * Cuerpo de `POST /plataforma/empresas` (historia 1.4). El RFC se manda ya
 * normalizado, pero quien lo normaliza y valida de verdad es el servidor.
 */
export const solicitudCrearEmpresa = z.object({
  razonSocial: texto,
  rfc: texto,
});

/** Respuesta de `POST /plataforma/empresas`: la misma forma que una fila de la lista. */
export const empresaCreadaPlataforma = empresaPlataforma;

/**
 * Cuerpo de `PUT /plataforma/empresas/:id/separacion-funciones` (historia 5.5).
 * El motivo es obligatorio; el servidor lo recorta y decide (1 a 500).
 */
export const solicitudCambiarSeparacion = z.object({
  activa: z.boolean(),
  motivo: texto,
});

/** Respuesta del PUT: la empresa con su estado nuevo. */
export const empresaSeparacionCambiada = empresaPlataforma;

/**
 * Banco de `GET /plataforma/bancos` y respuesta de
 * `POST /plataforma/bancos/:banco/levantar-vista-previa` (historia 3.6). El
 * mínimo de cargas aceptadas lo fija el servidor: la pantalla no lo inventa.
 * `levantadaEn` es un instante ISO, `null` si la vista previa sigue obligatoria.
 */
export const bancoPlataforma = z.object({
  banco: texto,
  // Conteos de cargas, no dinero.
  // eslint-disable-next-line no-restricted-syntax
  aceptadas: z.number().int().nonnegative(),
  // eslint-disable-next-line no-restricted-syntax
  minimoAceptadas: z.number().int().positive(),
  levantada: z.boolean(),
  levantadaEn: z.iso.datetime().nullable(),
});

export const listaBancosPlataforma = z.array(bancoPlataforma);

/**
 * Fila de `GET /plataforma/desacuerdo` (historia 9.2): una por empresa y banco.
 * `tasa` es un decimal en texto ("0.0400"), nunca un número; `null` si la
 * empresa no tiene propuestas tratadas. `banco` es `null` si no se conoce.
 */
export const desacuerdoPlataforma = z.object({
  companyId: id,
  razonSocial: texto,
  banco: texto.nullable(),
  // Conteos de propuestas, no dinero.
  // eslint-disable-next-line no-restricted-syntax
  propuestas: z.number().int().nonnegative(),
  // eslint-disable-next-line no-restricted-syntax
  tratadas: z.number().int().nonnegative(),
  // eslint-disable-next-line no-restricted-syntax
  desacuerdos: z.number().int().nonnegative(),
  tasa: z.string().nullable(),
});

export const listaDesacuerdoPlataforma = z.array(desacuerdoPlataforma);

/** Conteo de facturas o movimientos; no dinero. */
// eslint-disable-next-line no-restricted-syntax
const conteo = z.number().int().nonnegative();

/**
 * Fila de `GET /plataforma/fracciones` (historia 9.2): una por empresa, con los
 * conteos y las tres fracciones en texto; `null` si el total es 0.
 */
export const fraccionesPlataforma = z.object({
  companyId: id,
  razonSocial: texto,
  facturas: z.object({ total: conteo, ppd: conteo }),
  movimientos: z.object({
    total: conteo,
    parcialidades: conteo,
    comisiones: conteo,
  }),
  fraccionPpd: z.string().nullable(),
  fraccionParcialidades: z.string().nullable(),
  fraccionComisiones: z.string().nullable(),
});

export const listaFraccionesPlataforma = z.array(fraccionesPlataforma);

/** Umbral de la condición: lo que se pide, lo que hay y lo que falta. */
const criterioCondicion = z.object({
  pide: conteo,
  hoy: conteo,
  falta: conteo,
  cumple: z.boolean(),
});

/** Una de las dos medidas de la tasa; `tasa` es texto o `null` sin casos. */
const medidaTasaCondicion = z.object({
  casos: conteo,
  desacuerdos: conteo,
  tasa: z.string().nullable(),
});

/**
 * `GET /plataforma/condicion-cierre` (historia 9.5): si los datos de todas las
 * empresas cumplen la condición del PRD para considerar el cierre automático.
 * El servidor decide `cumple` y `falta`; las tasas viajan como texto de cuatro
 * decimales ("0.0495"), nunca como número.
 */
export const condicionCierrePlataforma = z.object({
  cumple: z.boolean(),
  criterios: z.object({
    propuestas: criterioCondicion,
    empresas: criterioCondicion,
    meses: criterioCondicion,
  }),
  tasa: z.object({
    registradas: medidaTasaCondicion,
    muestra: medidaTasaCondicion,
    usada: z.enum(['registradas', 'muestra']).nullable(),
    tasaUsada: z.string().nullable(),
    exceso: z.string().nullable(),
    maxima: z.string(),
    cumple: z.boolean(),
  }),
});

export type UsuarioPlataforma = z.infer<typeof usuarioPlataforma>;
export type RespuestaSesionPlataforma = z.infer<
  typeof respuestaSesionPlataforma
>;
export type SolicitudLoginPlataforma = z.infer<typeof solicitudLoginPlataforma>;
export type EmpresaPlataforma = z.infer<typeof empresaPlataforma>;
export type SolicitudCrearEmpresa = z.infer<typeof solicitudCrearEmpresa>;
export type SolicitudCambiarSeparacion = z.infer<
  typeof solicitudCambiarSeparacion
>;
export type BancoPlataforma = z.infer<typeof bancoPlataforma>;
export type DesacuerdoPlataforma = z.infer<typeof desacuerdoPlataforma>;
export type FraccionesPlataforma = z.infer<typeof fraccionesPlataforma>;
export type CondicionCierrePlataforma = z.infer<
  typeof condicionCierrePlataforma
>;
