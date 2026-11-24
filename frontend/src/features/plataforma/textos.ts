/**
 * Textos de las pantallas de plataforma (mockup `Plataforma.dc.html`). Los
 * avisos se indexan por el motivo por el que se llegó a `/plataforma/login`.
 */
export const AVISOS_PLATAFORMA = {
  sesion_terminada: 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
  sesion_cerrada: 'Cerraste sesión.',
} as const;

export type MotivoAvisoPlataforma = keyof typeof AVISOS_PLATAFORMA;

export const TEXTOS_PLATAFORMA = {
  marca: 'Cuadra',
  chip: 'Plataforma',
  titularPanel: 'Operación de la plataforma.',
  apoyoPanel:
    'Acceso interno del dueño de Cuadra. Aquí no hay datos de ninguna empresa.',
  etiquetaAcceso: 'Acceso interno',
  tituloAcceso: 'Entrar a la plataforma',
  cerrarSesion: 'Cerrar sesión',
  tituloEmpresas: 'Empresas',
  subtituloEmpresas:
    'Todas las empresas de la plataforma, con su nombre y su RFC.',
  listaEmpresas: 'Lista de empresas',
  vacioTitulo: 'Aún no hay empresas',
  vacioDetalle: 'Cuando haya empresas, aparecerán aquí con su nombre y su RFC.',
  columnaRazonSocial: 'Razón social',
  columnaRfc: 'RFC',
} as const;

/** Alta de empresa (mockup `Plataforma.dc.html`, historia 1.4). */
export const TEXTOS_ALTA_EMPRESA = {
  crear: 'Crear empresa',
  creando: 'Creando…',
  titulo: 'Nueva empresa',
  cancelar: 'Cancelar',
  etiquetaRazonSocial: 'Razón social',
  etiquetaRfc: 'RFC',
  ayudaRfc: '12 o 13 caracteres. Se guarda en mayúsculas y sin espacios.',
  razonVacia: 'Escribe la razón social',
  rfcVacio: 'Escribe el RFC',
  razonInvalida:
    'La razón social no puede ir vacía ni pasar de 255 caracteres.',
  rfcFormato:
    'El RFC no tiene un formato válido: debe tener 12 o 13 caracteres (3 o 4 letras, fecha AAMMDD y homoclave).',
  rfcGenerico:
    'Este RFC es genérico (público en general o extranjero) y no puede usarse para una empresa.',
  duplicadoTitulo: 'Ese RFC ya pertenece a otra empresa',
  duplicadoDetalle: 'No se creó nada. Revisa el RFC e inténtalo de nuevo.',
  creadaTitulo: 'Empresa creada',
  creadaDetalle: (razonSocial: string) =>
    `${razonSocial} ya aparece en la lista.`,
} as const;

/** Invitar al administrador (mockup `Plataforma.dc.html`, historia 1.5). */
export const TEXTOS_INVITAR = {
  columnaAcciones: 'Acciones',
  boton: 'Invitar administrador',
  etiquetaBoton: (razonSocial: string) =>
    `Invitar administrador de ${razonSocial}`,
  titulo: (razonSocial: string) => `Invitar administrador de ${razonSocial}`,
  etiquetaCorreo: 'Correo del administrador',
  ayudaCorreo: 'La persona recibirá un enlace válido por 7 días.',
  correoInvalido: 'Escribe un correo válido.',
  enviar: 'Enviar invitación',
  enviando: 'Enviando…',
  cancelar: 'Cancelar',
  enviadaTitulo: (correo: string) => `Invitación enviada a ${correo}.`,
  enviadaDetalle: 'El enlace vence en 7 días.',
  sinServicioTitulo: 'No se pudo enviar el correo.',
  sinServicioDetalle: 'Inténtalo de nuevo.',
  limiteTitulo: 'Demasiadas invitaciones.',
  limiteDetalle: 'Espera unos minutos e inténtalo de nuevo.',
} as const;

/** Bancos y vista previa (mockup `Plataforma.dc.html`, historia 3.6). */
export const TEXTOS_BANCOS = {
  titulo: 'Bancos',
  descripcion:
    'Aquí decides cuándo un banco deja de pedir vista previa. Se cuentan las cargas aceptadas de todas las empresas.',
  lista: 'Lista de bancos',
  columnaBanco: 'Banco',
  columnaAceptadas: 'Cargas aceptadas',
  columnaEstado: 'Estado',
  columnaAcciones: 'Acciones',
  obligatoria: 'Vista previa obligatoria',
  levantadaEl: (fecha: string) => `Levantada el ${fecha}`,
  sinAcciones: 'Sin acciones',
  faltan: (n: number) =>
    `Faltan ${n} ${n === 1 ? 'carga aceptada' : 'cargas aceptadas'}`,
  boton: 'Levantar vista previa',
  etiquetaBoton: (banco: string) => `Levantar la vista previa de ${banco}`,
  confirmarTitulo: (banco: string) => `Levantar la vista previa de ${banco}`,
  confirmarTexto: (banco: string) =>
    `Desde ahora, los PDF de ${banco} de todas las empresas pasarán directo a conciliación, sin vista previa. El cuadre de saldos sigue aplicando. Esto no se puede deshacer desde aquí.`,
  levantando: 'Levantando…',
  cancelar: 'Cancelar',
  levantadaTitulo: (banco: string) => `Vista previa de ${banco} levantada.`,
  levantadaDetalle: 'Quedó registrada con tu usuario y la fecha.',
  yaLevantadaTitulo: 'Ese banco ya estaba levantado.',
  yaLevantadaDetalle: 'No se cambió nada.',
  sinEvidenciaTitulo: 'Todavía no hay evidencia suficiente.',
} as const;

/** Separación de funciones por empresa (mockup `Plataforma.dc.html`, historia 5.5). */
export const TEXTOS_SEPARACION = {
  columna: 'Separación de funciones',
  activa: 'Activa',
  desactivada: 'Desactivada',
  botonDesactivar: 'Desactivar separación',
  botonActivar: 'Activar separación',
  etiquetaDesactivar: (razonSocial: string) =>
    `Desactivar la separación de funciones de ${razonSocial}`,
  etiquetaActivar: (razonSocial: string) =>
    `Activar la separación de funciones de ${razonSocial}`,
  formularioDesactivar: 'Desactivar separación de funciones',
  formularioActivar: 'Activar separación de funciones',
  tituloDesactivar: (razonSocial: string) =>
    `Desactivar la separación de funciones de ${razonSocial}`,
  tituloActivar: (razonSocial: string) =>
    `Volver a activar la separación de funciones de ${razonSocial}`,
  textoDesactivar:
    'Quien suba una carga de esta empresa podrá confirmar sus propias conciliaciones, y todos sus usuarios verán un aviso en la bandeja y en la bitácora. Solo afecta a esta empresa.',
  textoActivar:
    'La empresa volverá a impedir que quien sube una carga confirme sus propias conciliaciones, y el aviso de la bandeja y de la bitácora desaparece.',
  etiquetaMotivo: 'Motivo',
  ayudaMotivo:
    'Obligatorio, hasta 500 caracteres. Queda en la bitácora de la plataforma y en la de la empresa.',
  motivoVacio: 'Escribe el motivo del cambio.',
  guardando: 'Guardando…',
  cancelar: 'Cancelar',
  desactivadaTitulo: 'Separación de funciones desactivada.',
  activadaTitulo: 'Separación de funciones activada de nuevo.',
  cambiadaDetalle: (razonSocial: string) =>
    `${razonSocial}. Quedó en la bitácora de la plataforma y en la de la empresa, con tu usuario, la fecha y el motivo.`,
  yaEstabaTitulo: 'La separación de funciones ya estaba en ese estado.',
  yaEstabaDetalle: 'No se cambió nada.',
} as const;

/** Medición de la plataforma (mockup `PlataformaMedicion.dc.html`, historia 9.2). */
export const TEXTOS_MEDICION_PLATAFORMA = {
  navegacion: 'Secciones de la plataforma',
  pestanaEmpresas: 'Empresas y bancos',
  pestanaMedicion: 'Medición',
  titulo: 'Medición',
  descripcion:
    'Cuánto no está de acuerdo cada equipo con Cuadra y qué tan frecuentes son los casos difíciles. Solo conteos y porcentajes: aquí no se ve ningún movimiento ni factura de ninguna empresa.',
  cargando: 'Cargando la medición',
  errorTitulo: 'No se pudo conectar con el servidor.',
  errorDetalle: 'Revisa tu conexión e inténtalo de nuevo.',
  reintentar: 'Reintentar',
  desacuerdoTitulo: 'Tasa de desacuerdo',
  desacuerdoDescripcion:
    'Por empresa y por banco, con la definición del modo sombra. Se calcula cada vez que abres esta pantalla; no es un número guardado.',
  desacuerdoTabla: 'Tasa de desacuerdo por empresa y banco',
  sinDatosTitulo: 'Todavía no hay datos',
  sinDatosDetalle:
    'Cuando alguna empresa tenga propuestas de la regla 1, aquí verás su tasa. Una empresa sin propuestas no aparece.',
  columnaEmpresa: 'Empresa',
  columnaBanco: 'Banco',
  columnaPropuestas: 'Propuestas',
  columnaTratadas: 'Tratadas (muestra)',
  columnaDesacuerdos: 'Con desacuerdo',
  columnaTasa: 'Tasa',
  sinBanco: 'Sin banco',
  sinTasa: '—',
  sinTasaTitulo: 'Todavía no hay propuestas tratadas',
  notaTasa:
    'La tasa son los desacuerdos entre las propuestas tratadas. Con pocas tratadas, un porcentaje alto dice poco: mira siempre la columna de tratadas. Un guion significa que aún no hay ninguna tratada.',
  fraccionesTitulo: 'Casos difíciles por empresa',
  fraccionesDescripcion:
    'Qué parte de sus facturas son PPD (pago en parcialidades o diferido: se liquida en partes y exige su complemento de pago) y qué parte de sus movimientos son parcialidades o comisiones. Cada porcentaje trae el conteo del que sale.',
  fraccionesTabla: 'Fracciones de PPD, parcialidades y comisiones por empresa',
  columnaPpd: 'Facturas PPD',
  columnaPpdExplicacion: 'pago en parcialidades o diferido',
  columnaParcialidades: 'Parcialidades',
  columnaComisiones: 'Comisiones',
  sinFacturas: 'Sin facturas',
  sinMovimientos: 'Sin movimientos',
  deFacturas: (n: number, de: number) => `${n} de ${de} facturas`,
  deMovimientos: (n: number, de: number) => `${n} de ${de} movimientos`,
  notaFracciones:
    'Los movimientos importados antes de que Cuadra los clasificara no tienen clase y cuentan como ni parcialidad ni comisión.',
  condicionTitulo: 'Condición para considerar el cierre automático',
  condicionDescripcion:
    'Si los datos de todas las empresas cumplen lo que pide el PRD. Se calcula cada vez que abres esta pantalla; no es un resultado guardado, así que cambia si se reabre un caso o se verifica otro de la muestra.',
  condicionCumpleTitulo: 'La condición se cumple con los datos de hoy',
  condicionCumpleDetalle:
    'Es solo información. No activa nada y no cambia ninguna regla.',
  condicionNoCumpleTitulo: 'La condición todavía no se cumple',
  condicionTabla:
    'Umbrales de la condición para considerar el cierre automático',
  columnaCriterio: 'Criterio',
  columnaSePide: 'Se pide',
  columnaHoy: 'Hoy',
  columnaFalta: 'Falta',
  columnaEstado: 'Estado',
  criterioPropuestas: 'Propuestas de la regla 1',
  criterioPropuestasNota: 'En todas las empresas',
  criterioEmpresas: 'Empresas distintas',
  criterioEmpresasNota: 'Con al menos una propuesta',
  criterioMeses: 'Meses con propuestas',
  criterioMesesNota: 'Meses distintos con datos',
  criterioTasa: 'Tasa de desacuerdo',
  criterioTasaNota: 'La más alta de las dos medidas',
  estadoCumple: '✓ Cumple',
  estadoNoCumple: '✕ No cumple',
  faltaDentroDelLimite: 'Dentro del límite',
  faltaSinCasos: 'Sin casos todavía',
  deMas: (puntos: string) => `${puntos} de más`,
  resumenSinDatos: 'Aún no hay propuestas de la regla 1 ni casos verificados.',
  resumenFalta: (partes: string) => `Faltan ${partes} de datos`,
  resumenSupera: (maxima: string) =>
    `la tasa de desacuerdo supera el límite de ${maxima}`,
  resumenSinTasa: 'todavía no se puede calcular la tasa de desacuerdo',
  unidadPropuesta: ['propuesta', 'propuestas'],
  unidadEmpresa: ['empresa', 'empresas'],
  unidadMes: ['mes', 'meses'],
  tasasTitulo: 'Tasa de desacuerdo, en las dos medidas',
  tasasDescripcion:
    'Se muestran por separado. La condición usa la más alta de las dos, para que una muestra pequeña no tape un problema en las respuestas registradas.',
  medidaRegistradas: 'Respuestas registradas',
  medidaMuestra: 'Muestra verificada',
  medidaUsada: 'Se usa esta en la condición',
  unidadDesacuerdo: ['desacuerdo', 'desacuerdos'],
  unidadPropuestaTratada: ['propuesta tratada', 'propuestas tratadas'],
  unidadCasoVerificado: ['caso verificado', 'casos verificados'],
  sinPropuestasTratadas: 'Sin propuestas tratadas',
  sinCasosVerificados: 'Sin casos verificados',
  notaSinCasos:
    'Una tasa sin casos no cuenta como cumplida: sin datos, el criterio de la tasa no se cumple.',
  soloInformaTitulo: 'Esta pantalla solo informa',
  soloInformaDetalle:
    'El cierre automático no existe en esta versión. Aunque la condición se cumpla, cada caso sigue necesitando a una persona que lo confirme.',
} as const;
