import { readFileSync } from 'fs';
import { basename, join } from 'path';
import { dinero } from '../../src/common/dinero';
import {
  construirEscenarios,
  esperado,
  type Empresa,
  type Esperado,
  type Fase,
  type MovimientoEscenario,
} from './escenarios';
import { nombreDeCfdi } from './generar';

/**
 * CU-18. El runner de la demo: un cliente HTTP que recorre el producto como
 * lo haría una persona (login, carga de CFDI y estado de cuenta, tolerancia,
 * confirmar, rechazar, aislamiento entre empresas) y se autoverifica contra
 * `esperado()`, que sale de la misma tabla de escenarios que generó los
 * archivos. Solo usa fetch/FormData nativos; no toca la base de datos.
 *
 * Lo comparten `npm run demo` (ejecutar.ts) y el spec de integración.
 */

/** Contraseña pública del seed (src/database/seeds/seed.ts); runner.spec vigila que coincidan. */
export const PASSWORD_DEMO = 'cuadra-dev-2026';

export const USUARIOS_DEMO = {
  ana: 'ana.reyes@fdb.mx',
  luis: 'luis.mendoza@fdb.mx',
  jorge: 'jorge.tapia@despacho.mx',
  carmen: 'carmen.olvera@cuautla.mx',
} as const;

/** Razón social de cada empresa tal como la siembra el seed. */
export const RAZON_SOCIAL: Readonly<Record<Empresa, string>> = {
  fdb: 'Ferreteria del Bajio SA de CV',
  tcu: 'Transportes Cuautla SA de CV',
};

const RAIZ = join(__dirname, '..', '..');
const PREFIJO_IA = 'Sugerencia de IA: [SIMULADA';
const REGLA_IA = 'llm_sugerencia';
const TOTAL_PASOS = 9;
const MOTIVO_RECHAZO = 'Pago parcial; no corresponde a la factura';

export interface OpcionesDemo {
  baseUrl: string;
  log: (linea: string) => void;
  /** Intervalo entre consultas. */
  pollMs?: number;
  /** Tope de espera por condición. */
  timeoutMs?: number;
  /** Ventana de calma tras llegar a lo esperado, para detectar llamadas de IA de más. */
  quietMs?: number;
}

/** Un paso que no dio lo esperado. El CLI imprime esperado, actual y la pista. */
export class ErrorDemo extends Error {
  constructor(
    readonly paso: string,
    mensaje: string,
    readonly detalle: {
      esperado?: unknown;
      actual?: unknown;
      pista?: string;
    } = {},
  ) {
    super(`${paso}: ${mensaje}`);
    this.name = 'ErrorDemo';
  }
}

const ANFITRIONES_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * El runner entra con la contraseña pública del seed: nunca debe apuntar a un
 * ambiente remoto por accidente. Solo loopback, salvo DEMO_PERMITIR_REMOTO=1.
 */
export function validarDestino(
  baseUrl: string,
  env: Record<string, string | undefined> = process.env,
): void {
  let anfitrion: string;
  try {
    anfitrion = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    throw new ErrorDemo(
      'destino',
      `DEMO_BASE_URL no es una URL válida: ${baseUrl}`,
    );
  }
  if (ANFITRIONES_LOCALES.has(anfitrion) || env.DEMO_PERMITIR_REMOTO === '1') {
    return;
  }
  throw new ErrorDemo(
    'destino',
    `${anfitrion} no es loopback; el runner usa la contraseña pública del seed`,
    {
      pista:
        'Solo se permite localhost, 127.0.0.1 o ::1. Con DEMO_PERMITIR_REMOTO=1 se desactiva la guarda bajo tu responsabilidad.',
    },
  );
}

interface FilaBandeja {
  movimientoId: string;
  fecha: string;
  monto: string;
  descripcion: string;
  referencia: string | null;
  estado: 'conciliado' | 'sugerencia' | 'sin_match';
  motivo: string | null;
  regla: string | null;
  mejorPropuesta: { conciliacionId: string } | null;
}

interface EventoHistorial {
  accion: string;
  datos: Record<string, unknown> | null;
  usuario: { nombre: string } | null;
}

/** Los campos de las respuestas que el runner lee; el resto se ignora. */
interface CuerpoHttp extends Partial<EstadoCargaHttp> {
  token?: string;
  empresas?: Array<{ id: string; razonSocial: string }>;
  datos?: unknown;
}

interface Respuesta {
  status: number;
  cuerpo: CuerpoHttp | null;
}

interface EstadoCargaHttp {
  id: string;
  estado: string;
  registrosOk: number;
  totalRegistros: number;
  yaExistia?: boolean;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Conteos por estado y regla tal como los muestra la bandeja, en la forma de `Esperado`. */
export function resumir(filas: readonly FilaBandeja[]): Esperado {
  const r: Esperado = {
    sugerencia: 0,
    sin_match: 0,
    conciliado: 0,
    porRegla: {},
    ia: 0,
  };
  for (const f of filas) {
    r[f.estado]++;
    if (f.estado === 'conciliado') continue;
    const regla = f.regla ?? '(sin regla)';
    r.porRegla[regla] = (r.porRegla[regla] ?? 0) + 1;
    if (regla === REGLA_IA) r.ia++;
  }
  return r;
}

export function coincide(actual: Esperado, esperada: Esperado): boolean {
  if (
    actual.sugerencia !== esperada.sugerencia ||
    actual.sin_match !== esperada.sin_match ||
    actual.conciliado !== esperada.conciliado ||
    actual.ia !== esperada.ia
  ) {
    return false;
  }
  const a = actual.porRegla;
  const e = esperada.porRegla;
  const reglas = new Set([...Object.keys(a), ...Object.keys(e)]);
  return [...reglas].every((k) => (a[k] ?? 0) === (e[k] ?? 0));
}

const texto = (e: Esperado): string =>
  `sugerencia ${e.sugerencia} (IA ${e.ia}) / sin_match ${e.sin_match} / conciliado ${e.conciliado} ` +
  JSON.stringify(Object.fromEntries(Object.entries(e.porRegla).sort()));

export async function ejecutarDemo(
  o: OpcionesDemo,
): Promise<'ok' | 'ya-cargado'> {
  const pollMs = o.pollMs ?? 500;
  const timeoutMs = o.timeoutMs ?? 60_000;
  const quietMs = o.quietMs ?? 2_000;
  const base = o.baseUrl.replace(/\/+$/, '');
  const { log } = o;
  validarDestino(base);

  const escenarios = construirEscenarios();
  let paso = 0;
  let nombrePaso = '';

  const iniciar = (nombre: string) => {
    paso++;
    nombrePaso = nombre;
  };
  const ok = (detalle: string) =>
    log(`[${paso}/${TOTAL_PASOS}] ${nombrePaso} ... OK (${detalle})`);
  const fallar = (mensaje: string, detalle: ErrorDemo['detalle'] = {}) =>
    new ErrorDemo(`[${paso}/${TOTAL_PASOS}] ${nombrePaso}`, mensaje, detalle);

  async function http(
    metodo: string,
    ruta: string,
    token?: string,
    cuerpo?: unknown,
  ): Promise<Respuesta> {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    let body: FormData | string | undefined;
    if (cuerpo instanceof FormData) body = cuerpo;
    else if (cuerpo !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(cuerpo);
    }
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const crudo = await res.text();
    let json: CuerpoHttp | null = null;
    try {
      json = crudo ? (JSON.parse(crudo) as CuerpoHttp) : null;
    } catch {
      json = null;
    }
    return { status: res.status, cuerpo: json };
  }

  const esperarHasta = async <T>(
    leer: () => Promise<T>,
    listo: (v: T) => boolean,
    alFallar: (ultimo: T) => ErrorDemo,
  ): Promise<T> => {
    const limite = Date.now() + timeoutMs;
    let ultimo = await leer();
    while (!listo(ultimo)) {
      if (Date.now() > limite) throw alFallar(ultimo);
      await dormir(pollMs);
      ultimo = await leer();
    }
    return ultimo;
  };

  // --- Sesiones -----------------------------------------------------------
  const sesiones = new Map<string, string>();
  async function sesion(email: string, empresa: Empresa): Promise<string> {
    const llave = `${email}|${empresa}`;
    const previa = sesiones.get(llave);
    if (previa) return previa;
    const login = await http('POST', '/auth/login', undefined, {
      email,
      password: PASSWORD_DEMO,
    });
    if (login.status !== 200) {
      throw fallar(`login de ${email} devolvió ${login.status}`, {
        pista: 'Falta el seed: docker compose exec api npm run seed',
      });
    }
    const destino = login.cuerpo?.empresas?.find(
      (e) => e.razonSocial === RAZON_SOCIAL[empresa],
    );
    if (!destino) {
      throw fallar(`${email} no tiene la empresa ${RAZON_SOCIAL[empresa]}`, {
        pista: 'Falta el seed: docker compose exec api npm run seed',
      });
    }
    const elegida = await http(
      'POST',
      `/auth/empresa/${destino.id}`,
      login.cuerpo?.token,
    );
    const token = elegida.cuerpo?.token;
    if (elegida.status !== 200 || !token) {
      throw fallar(`seleccionar empresa devolvió ${elegida.status}`);
    }
    sesiones.set(llave, token);
    return token;
  }

  // --- Cargas -------------------------------------------------------------
  const archivoCsv = (empresa: Empresa, n: 1 | 2): string =>
    empresa === 'tcu'
      ? 'demo/estado-cuenta-tcu.csv'
      : `demo/estado-cuenta-${n}.csv`;

  const cfdisDe = (empresa: Empresa): string[] =>
    escenarios.flatMap((e) =>
      e.cfdis.filter((c) => c.empresa === empresa).map(nombreDeCfdi),
    );

  const formXml = (rutas: string[]): FormData => {
    const f = new FormData();
    for (const ruta of rutas) {
      f.append(
        'archivos',
        new Blob([readFileSync(join(RAIZ, ruta), 'utf8')], {
          type: 'application/xml',
        }),
        basename(ruta),
      );
    }
    return f;
  };

  async function subirCfdi(token: string, empresa: Empresa) {
    return http('POST', '/cargas/cfdi', token, formXml(cfdisDe(empresa)));
  }

  async function subirCsv(token: string, ruta: string) {
    const f = new FormData();
    f.append(
      'archivo',
      new Blob([readFileSync(join(RAIZ, ruta), 'utf8')], { type: 'text/csv' }),
      basename(ruta),
    );
    f.append('banco', 'BANCO DEMO (sintético)');
    f.append('cuenta', '****0001');
    f.append('perfil', 'cuadra');
    return http('POST', '/cargas/estado-cuenta', token, f);
  }

  async function terminarCarga(
    token: string,
    carga: EstadoCargaHttp,
    registros: number,
  ): Promise<EstadoCargaHttp> {
    const final = await esperarHasta(
      async () =>
        (await http('GET', `/cargas/${carga.id}`, token))
          .cuerpo as EstadoCargaHttp,
      (c) => ['procesada', 'con_errores', 'fallida'].includes(c.estado),
      (c) =>
        fallar(`la carga ${carga.id} sigue en '${c.estado}'`, {
          pista: 'Revisa que el worker esté corriendo: docker compose logs api',
        }),
    );
    if (final.estado !== 'procesada' || final.registrosOk !== registros) {
      throw fallar('la carga no terminó como se esperaba', {
        esperado: { estado: 'procesada', registrosOk: registros },
        actual: { estado: final.estado, registrosOk: final.registrosOk },
      });
    }
    return final;
  }

  // --- Bandeja ------------------------------------------------------------
  const leerBandeja = async (token: string): Promise<FilaBandeja[]> => {
    const res = await http(
      'GET',
      '/bandeja?estado=sugerencia&estado=sin_match&estado=conciliado&limite=200',
      token,
    );
    if (res.status !== 200) {
      throw fallar(`GET /bandeja devolvió ${res.status}`);
    }
    return res.cuerpo?.datos as FilaBandeja[];
  };

  const PISTA_IA =
    'Verifica LLM_HABILITADO=true y LLM_PROVEEDOR=simulado en .env y reinicia la api (docker compose up -d api).';

  /** Espera a que la bandeja llegue a lo esperado y a que se quede ahí (sin llamadas de IA de más). */
  async function esperarFase(
    token: string,
    fase: Fase,
    empresa: Empresa,
  ): Promise<FilaBandeja[]> {
    const esperada = esperado(fase, empresa, escenarios);
    const filas = await esperarHasta(
      () => leerBandeja(token),
      (f) => coincide(resumir(f), esperada),
      (f) =>
        fallar('la bandeja no llegó a lo esperado', {
          esperado: texto(esperada),
          actual: texto(resumir(f)),
          pista: PISTA_IA,
        }),
    );
    await dormir(quietMs);
    const despues = await leerBandeja(token);
    if (!coincide(resumir(despues), esperada)) {
      throw fallar('la bandeja cambió después de llegar a lo esperado', {
        esperado: texto(esperada),
        actual: texto(resumir(despues)),
      });
    }
    return filas.length === despues.length ? despues : filas;
  }

  const localizar = (
    filas: readonly FilaBandeja[],
    m: MovimientoEscenario,
  ): FilaBandeja => {
    const fila = filas.find(
      (f) =>
        f.fecha === m.fecha &&
        f.descripcion === m.descripcion &&
        dinero(f.monto).eq(dinero(m.monto)),
    );
    if (!fila) {
      throw fallar(
        `no encontré en la bandeja el movimiento ${m.fecha} ${m.descripcion}`,
      );
    }
    return fila;
  };

  const movimientoCon = (accion: 'confirmar' | 'rechazar') => {
    const m = escenarios
      .flatMap((e) => e.movimientos)
      .find((x) => x.accion === accion);
    if (!m) throw new Error(`La tabla no declara un movimiento para ${accion}`);
    return m;
  };

  async function historial(
    token: string,
    conciliacionId: string,
  ): Promise<EventoHistorial[]> {
    const res = await http(
      'GET',
      `/conciliaciones/${conciliacionId}/historial`,
      token,
    );
    if (res.status !== 200) throw fallar(`historial devolvió ${res.status}`);
    return res.cuerpo?.datos as EventoHistorial[];
  }

  const acciones = (h: EventoHistorial[]) => h.map((e) => e.accion).join(' > ');

  // =========================================================================
  // 1. API disponible
  iniciar('API disponible');
  try {
    const salud = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    // La app de pruebas no expone /health: basta con que responda.
    if (salud.status >= 500) throw new Error(`HTTP ${salud.status}`);
  } catch (error) {
    throw fallar(`API no disponible en ${base} (${(error as Error).message})`, {
      pista: 'Levanta el stack: docker compose up -d',
    });
  }
  ok(base);

  // 2. CFDI (primero, siempre)
  iniciar('Luis carga 40 CFDI de Ferretería');
  const luis = await sesion(USUARIOS_DEMO.luis, 'fdb');
  const cfdiFdb = cfdisDe('fdb');
  const subida = await subirCfdi(luis, 'fdb');
  if (subida.cuerpo?.yaExistia) {
    log(
      '[2/9] Los datos de la demo ya estaban cargados. Para empezar de cero: docker compose down -v',
    );
    return 'ya-cargado';
  }
  if (subida.status !== 202) {
    throw fallar(`POST /cargas/cfdi devolvió ${subida.status}`, {
      esperado: 202,
      actual: JSON.stringify(subida.cuerpo),
    });
  }
  const cargaCfdi = await terminarCarga(
    luis,
    subida.cuerpo as EstadoCargaHttp,
    cfdiFdb.length,
  );
  ok(`${cargaCfdi.registrosOk} CFDI procesados`);

  // 3. Estado de cuenta 1 (siempre después de los CFDI)
  iniciar('Luis carga el estado de cuenta 1 (45 movimientos)');
  const csv1 = await subirCsv(luis, archivoCsv('fdb', 1));
  if (csv1.status !== 202) {
    throw fallar(`POST /cargas/estado-cuenta devolvió ${csv1.status}`, {
      actual: JSON.stringify(csv1.cuerpo),
    });
  }
  const cargaCsv1 = await terminarCarga(
    luis,
    csv1.cuerpo as EstadoCargaHttp,
    45,
  );
  ok(`${cargaCsv1.registrosOk} movimientos procesados`);

  // 4. Motor e IA, fase 1
  iniciar('El motor propone y la IA simulada sugiere (fase 1)');
  const fase1 = await esperarFase(luis, 'fase1', 'fdb');
  const e1 = esperado('fase1', 'fdb', escenarios);
  ok(
    `${e1.sugerencia} sugerencias (${e1.ia} de IA simulada), ${e1.sin_match} sin match, ${e1.conciliado} conciliados`,
  );
  const filasIa = fase1.filter((f) => f.motivo?.startsWith(PREFIJO_IA));
  if (filasIa.length !== e1.ia) {
    throw fallar('las sugerencias de IA no traen la etiqueta de simulada', {
      esperado: `${e1.ia} con motivo "${PREFIJO_IA}..."`,
      actual: filasIa.length,
    });
  }

  // 5. Tolerancia y estado de cuenta 2
  iniciar('Ana fija tolerancia 5.00 y Luis carga el estado de cuenta 2');
  const ana = await sesion(USUARIOS_DEMO.ana, 'fdb');
  const tol = await http('PUT', '/empresa/tolerancia', ana, {
    toleranciaMonto: '5.00',
  });
  if (tol.status !== 200) {
    throw fallar(`PUT /empresa/tolerancia devolvió ${tol.status}`);
  }
  const csv2 = await subirCsv(luis, archivoCsv('fdb', 2));
  if (csv2.status !== 202) {
    throw fallar(`POST /cargas/estado-cuenta (2) devolvió ${csv2.status}`);
  }
  await terminarCarga(luis, csv2.cuerpo as EstadoCargaHttp, 5);
  const fase2 = await esperarFase(luis, 'fase2', 'fdb');
  const e2 = esperado('fase2', 'fdb', escenarios);
  ok(
    `con tolerancia 5.00 el pago de 1155.00 ahora se propone; ${e2.sugerencia} sugerencias, ${e2.sin_match} sin match`,
  );

  // 6. D-08: quien subió no confirma; otra persona sí
  iniciar('Confirmación: Luis (quien subió) no puede, Jorge sí');
  const aConfirmar = localizar(fase2, movimientoCon('confirmar'));
  const idConfirmar = aConfirmar.mejorPropuesta?.conciliacionId;
  if (!idConfirmar)
    throw fallar('el movimiento a confirmar no tiene propuesta');
  const deLuis = await http(
    'POST',
    `/conciliaciones/${idConfirmar}/confirmar`,
    luis,
  );
  if (deLuis.status !== 403) {
    throw fallar('Luis pudo confirmar lo que él mismo subió', {
      esperado: 403,
      actual: deLuis.status,
    });
  }
  const jorge = await sesion(USUARIOS_DEMO.jorge, 'fdb');
  const deJorge = await http(
    'POST',
    `/conciliaciones/${idConfirmar}/confirmar`,
    jorge,
  );
  if (deJorge.status !== 200) {
    throw fallar('Jorge no pudo confirmar', {
      esperado: 200,
      actual: `${deJorge.status} ${JSON.stringify(deJorge.cuerpo)}`,
    });
  }
  const histConfirmada = await historial(jorge, idConfirmar);
  if (!acciones(histConfirmada).includes('confirmar')) {
    throw fallar('el historial no registra la confirmación', {
      actual: acciones(histConfirmada),
    });
  }
  ok(`Luis: 403; Jorge: 200; historial: ${acciones(histConfirmada)}`);

  // 7. Rechazo con motivo e historial (propuesta del motor y propuesta de IA)
  iniciar('Jorge rechaza un pago parcial y se revisa el historial');
  const aRechazar = localizar(fase2, movimientoCon('rechazar'));
  const idRechazar = aRechazar.mejorPropuesta?.conciliacionId;
  if (!idRechazar) throw fallar('el movimiento a rechazar no tiene propuesta');
  const rechazo = await http(
    'POST',
    `/conciliaciones/${idRechazar}/rechazar`,
    jorge,
    {
      motivo: MOTIVO_RECHAZO,
    },
  );
  if (rechazo.status !== 200) {
    throw fallar(`rechazar devolvió ${rechazo.status}`, {
      actual: JSON.stringify(rechazo.cuerpo),
    });
  }
  const histRechazada = await historial(jorge, idRechazar);
  if (!acciones(histRechazada).includes('rechazar')) {
    throw fallar('el historial no registra el rechazo', {
      actual: acciones(histRechazada),
    });
  }
  const filaIa = fase2.find((f) => f.motivo?.startsWith(PREFIJO_IA));
  const idIa = filaIa?.mejorPropuesta?.conciliacionId;
  if (!idIa)
    throw fallar('no hay una propuesta de IA para revisar su historial');
  const histIa = await historial(jorge, idIa);
  const creada = histIa.find((e) => e.accion === 'crear');
  if (
    !creada ||
    creada.usuario !== null ||
    creada.datos?.origen !== 'llm' ||
    creada.datos?.modelo !== 'simulado-demo'
  ) {
    throw fallar('la propuesta de IA no quedó auditada como simulada', {
      esperado: 'crear, sin usuario, origen llm, modelo simulado-demo',
      actual: JSON.stringify(creada),
    });
  }
  const final = await esperarFase(jorge, 'final', 'fdb');
  ok(
    `rechazada; historial: ${acciones(histRechazada)}; IA: ${acciones(histIa)} (modelo simulado-demo, sin usuario)`,
  );

  // 8. Resumen
  iniciar('Resumen de Ferretería');
  const r = resumir(final);
  ok(`${final.length} movimientos abonados en la bandeja`);
  log('');
  log('  Estado        Movimientos');
  log(
    `  conciliado    ${String(r.conciliado).padStart(4)}   (confirmado por una persona)`,
  );
  log(
    `  sugerencia    ${String(r.sugerencia).padStart(4)}   (${r.ia} de IA simulada)`,
  );
  log(`  sin_match     ${String(r.sin_match).padStart(4)}`);
  log('');
  log('  Regla                              Movimientos');
  for (const [regla, n] of Object.entries(r.porRegla).sort()) {
    log(`  ${regla.padEnd(34)} ${String(n).padStart(4)}`);
  }
  log('');
  log(
    '  AVISO: las sugerencias de IA son SIMULADAS (modelo simulado-demo); no se llamó a ningún modelo real.',
  );
  log('  El motor de reglas decidió; nadie confirmó las propuestas de IA.');
  log('');

  // 9. TCU y aislamiento
  iniciar('Carmen carga Transportes y se verifica el aislamiento');
  const carmen = await sesion(USUARIOS_DEMO.carmen, 'tcu');
  const cfdiTcu = cfdisDe('tcu');
  const subidaTcu = await subirCfdi(carmen, 'tcu');
  if (subidaTcu.status !== 202) {
    throw fallar(`CFDI de Transportes devolvió ${subidaTcu.status}`, {
      actual: JSON.stringify(subidaTcu.cuerpo),
    });
  }
  await terminarCarga(
    carmen,
    subidaTcu.cuerpo as EstadoCargaHttp,
    cfdiTcu.length,
  );
  const csvTcu = await subirCsv(carmen, archivoCsv('tcu', 1));
  if (csvTcu.status !== 202) {
    throw fallar(`estado de cuenta de Transportes devolvió ${csvTcu.status}`);
  }
  await terminarCarga(carmen, csvTcu.cuerpo as EstadoCargaHttp, 5);
  const filasTcu = await esperarFase(carmen, 'final', 'tcu');
  const eTcu = esperado('final', 'tcu', escenarios);

  const cargaAjena = await http('GET', `/cargas/${cargaCfdi.id}`, carmen);
  const historialAjeno = await http(
    'GET',
    `/conciliaciones/${idConfirmar}/historial`,
    carmen,
  );
  if (cargaAjena.status !== 404 || historialAjeno.status !== 404) {
    throw fallar('Transportes alcanzó datos de Ferretería', {
      esperado: '404 y 404',
      actual: `${cargaAjena.status} y ${historialAjeno.status}`,
    });
  }
  const revisor = await sesion(USUARIOS_DEMO.jorge, 'tcu');
  const deRevisor = await subirCfdi(revisor, 'tcu');
  if (deRevisor.status !== 403) {
    throw fallar('un revisor pudo cargar CFDI', {
      esperado: 403,
      actual: deRevisor.status,
    });
  }
  const fdbDespues = await leerBandeja(ana);
  if (fdbDespues.length !== final.length) {
    throw fallar('la bandeja de Ferretería cambió al cargar Transportes', {
      esperado: final.length,
      actual: fdbDespues.length,
    });
  }
  ok(
    `Transportes: ${eTcu.sugerencia} sugerencias / ${eTcu.sin_match} sin match / ${eTcu.conciliado} conciliados (${filasTcu.length} abonos en la bandeja); ` +
      `ajeno: 404/404; revisor sube CFDI: 403; Ferretería intacta`,
  );

  log('');
  log('Demo completa: todo coincide con lo esperado.');
  return 'ok';
}
