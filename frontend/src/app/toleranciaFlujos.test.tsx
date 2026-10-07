import {
  act,
  configure,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import { CLAVE_TEMA } from '@/shared/tema/tipos';
import { crearCompuerta } from '@/test/compuerta';
import {
  CONTEXTO_SESION,
  CONTEXTO_SESION_B,
  EMPRESAS_DISPONIBLES,
} from '@/test/fixtures';
import { almacenes } from '@/test/handlers';
import { contextoPorToken, espiarSolicitudes } from '@/test/handlersAuth';
import {
  guardarFalla,
  guardarFueraDeContrato,
  guardarRedDeFallo,
  valorFalla,
} from '@/test/handlersTolerancia';
import {
  elegirEmpresaPorNombre,
  entrarALaApp,
  montarApp,
} from '@/test/montarApp';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

let espia: ReturnType<typeof espiarSolicitudes> | null = null;

afterEach(() => {
  espia?.detener();
  espia = null;
  localStorage.removeItem(CLAVE_TEMA);
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

const tolerancia = almacenes.tolerancia;
const idB = EMPRESAS_DISPONIBLES[1]!.id;
const EMPRESA_A = CONTEXTO_SESION.empresa.razonSocial;
const EMPRESA_B = CONTEXTO_SESION_B.empresa.razonSocial;

const ETIQUETA = 'Nuevo valor (0 a 100, hasta 4 decimales)';
const EXITO = 'Tolerancia guardada. Aplica desde la próxima corrida del motor.';
const AYUDA_NORMAL =
  'El cambio queda en la bitácora con el valor anterior y el nuevo. Solo afecta corridas futuras del motor.';
const AYUDA_IGUAL = 'Es el valor actual. Escribe otro para guardar.';
const AVISO =
  'Solo un administrador de la empresa puede cambiar la tolerancia.';
const RECHAZO =
  'El servidor no aceptó el valor. Escribe un número entre 0 y 100, con hasta 4 decimales.';
const SIN_PERMISO_TITULO = 'No tienes permiso para esta acción.';
const SIN_PERMISO_DETALLE =
  'Si crees que es un error, pide acceso a un administrador de la empresa.';
const SIN_CONEXION = 'No se pudo conectar con el servidor.';
const SIN_CONEXION_GUARDADO =
  'Revisa tu conexión e inténtalo de nuevo. El valor que escribiste sigue en el campo.';
const GENERICO = 'No se pudo completar la solicitud.';
const GENERICO_GUARDADO =
  'El valor que escribiste sigue en el campo. Inténtalo de nuevo en unos minutos.';

const usuario = () => userEvent.setup({ applyAccept: false });
const campo = () => screen.getByRole('textbox', { name: ETIQUETA });
const botonGuardar = () => screen.getByRole('button', { name: /^Guardar/ });
const formulario = () => campo().closest('form')!;
const regionDeEstado = () => within(formulario()).getByRole('status');
const cambiarEmpresa = () =>
  screen.getByRole('button', { name: /Cambiar de empresa/ });
const guardados = () =>
  tolerancia.peticiones().filter((p) => p.metodo === 'PUT');

async function abrir(entrada = '/tolerancia') {
  const montada = montarApp(entrada);
  await entrarALaApp();
  await screen.findByText('$0.50');
  return montada;
}

async function escribir(texto: string) {
  const u = usuario();
  await u.clear(campo());
  if (texto !== '') await u.type(campo(), texto);
}

/** Enter en el campo y un submit directo: el segundo no lo frena un botón apagado. */
async function intentarEnviar() {
  await usuario().type(campo(), '{Enter}');
  fireEvent.submit(formulario());
}

/** `GET /auth/contexto` según el token: A con los roles dados; B con los suyos. */
function contextoConRoles(rolesA: string[], rolesB?: string[]) {
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) =>
      HttpResponse.json({ token: `token-de-sesion-${String(params.id)}` }),
    ),
    http.get('/api/auth/contexto', ({ request }) => {
      const esB = (request.headers.get('Authorization') ?? '').endsWith(idB);
      return HttpResponse.json(
        esB
          ? { ...CONTEXTO_SESION_B, roles: rolesB ?? CONTEXTO_SESION_B.roles }
          : { ...CONTEXTO_SESION, roles: rolesA },
      );
    }),
  );
}

/** `GET /empresa/tolerancia` de B responde otro valor; el de A, el del almacén. */
function valorDeBDistinto(valorB: string) {
  servidor.use(
    http.get('/api/empresa/tolerancia', ({ request }) => {
      const esB = (request.headers.get('Authorization') ?? '').endsWith(idB);
      return HttpResponse.json({
        toleranciaMonto: esB ? valorB : tolerancia.valor(),
      });
    }),
  );
}

describe('flujos de tolerancia: la pantalla y el administrador', () => {
  it('muestra el valor sin ceros de más, el campo con el vigente y la estructura de la página (TOL-1.1, 3.2, 11.1)', async () => {
    await abrir();
    expect(campo()).toHaveValue('0.50');
    expect(campo()).toHaveAttribute('type', 'text');
    expect(campo()).toHaveAttribute('inputmode', 'decimal');
    expect(botonGuardar()).toBeDisabled();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Valor actual' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tolerancia de monto' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Tolerancia · Cuadra'));
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it('guarda 0.0050: el PUT lleva la cadena, la tarjeta y el campo muestran 0.005 y el éxito se anuncia (TOL-6.4, 6.5, 12.4)', async () => {
    await abrir();
    await escribir('0.0050');
    expect(screen.getByText(AYUDA_NORMAL)).toBeInTheDocument();
    await usuario().click(botonGuardar());
    await waitFor(() =>
      expect(within(regionDeEstado()).getByText(EXITO)).toBeInTheDocument(),
    );
    expect(guardados()).toHaveLength(1);
    const cuerpo = guardados()[0]!.cuerpo as { toleranciaMonto: unknown };
    expect(cuerpo).toEqual({ toleranciaMonto: '0.0050' });
    expect(typeof cuerpo.toleranciaMonto).toBe('string');
    expect(screen.getByText('$0.005')).toBeInTheDocument();
    expect(campo()).toHaveValue('0.005');
    expect(botonGuardar()).toBeDisabled();
    // Como en el mockup (vista «guardado»): el campo vuelve a seguir al valor
    // vigente y la ayuda es la normal; «es el valor actual» solo sale tras
    // escribir un valor igual.
    expect(screen.getByText(AYUDA_NORMAL)).toBeInTheDocument();
    expect(screen.queryByText(AYUDA_IGUAL)).toBeNull();
  });

  it('el valor del servidor manda sobre lo escrito: 1 vuelve como 1.00 (TOL-6.5)', async () => {
    await abrir();
    await escribir('1');
    await usuario().click(botonGuardar());
    await screen.findByText('$1.00');
    expect(campo()).toHaveValue('1.00');
  });

  it('mientras el PUT está en curso: Guardando…, campo apagado, estado anunciado y la tarjeta conserva el valor (TOL-6.2)', async () => {
    await abrir();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await escribir('0.75');
    await usuario().click(botonGuardar());
    expect(
      await screen.findByRole('button', { name: 'Guardando…' }),
    ).toBeDisabled();
    expect(campo()).toBeDisabled();
    expect(
      within(regionDeEstado()).getByText('Guardando la tolerancia'),
    ).toBeInTheDocument();
    expect(screen.getByText('$0.50')).toBeInTheDocument();
    expect(screen.queryByText(EXITO)).toBeNull();
    compuerta.abrir();
    await screen.findByText('$0.75');
    expect(screen.queryByText('Guardando la tolerancia')).toBeNull();
  });

  it('el éxito persiste sin temporizador y se quita con la primera edición (TOL-6.6)', async () => {
    await abrir();
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByText(EXITO);
    await esperarIntervalos(5);
    expect(screen.getByText(EXITO)).toBeInTheDocument();
    await usuario().type(campo(), '1');
    expect(screen.queryByText(EXITO)).toBeNull();
  });

  it('el éxito no vuelve al salir y regresar a la pantalla (TOL-6.7)', async () => {
    const { router } = await abrir();
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByText(EXITO);
    await act(() => router.navigate('/bandeja'));
    await screen.findByRole('heading', { level: 1, name: /^Bandeja/ });
    await act(() => router.navigate('/tolerancia'));
    await screen.findByText('$0.75');
    expect(screen.queryByText(EXITO)).toBeNull();
    expect(campo()).toHaveValue('0.75');
  });

  it('un valor igual al vigente apaga Guardar y muestra la ayuda; 0.00500 es error de decimales, no igual (TOL-5.1, 5.2, 5.4)', async () => {
    await abrir();
    await escribir('0.5');
    expect(screen.getByText(AYUDA_IGUAL)).toBeInTheDocument();
    expect(botonGuardar()).toBeDisabled();
    await intentarEnviar();
    await esperarIntervalos(4);
    expect(guardados()).toHaveLength(0);
  });

  it('con 0.0050 vigente: 0.005 es igual y 0.00500 es error de decimales (TOL-5.2)', async () => {
    tolerancia.establecer('0.0050');
    montarApp('/tolerancia');
    await entrarALaApp();
    await screen.findByText('$0.005');
    await escribir('0.005');
    expect(screen.getByText(AYUDA_IGUAL)).toBeInTheDocument();
    expect(botonGuardar()).toBeDisabled();
    await escribir('0.00500');
    expect(screen.getByText('Usa hasta 4 decimales.')).toBeInTheDocument();
    expect(screen.queryByText(AYUDA_IGUAL)).toBeNull();
  });

  it.each([
    ['', 'Escribe un valor.'],
    ['0,5', 'Escribe un número con punto decimal, por ejemplo 0.50.'],
    ['100.5', 'El valor debe estar entre 0 y 100.'],
    ['-1', 'El valor debe estar entre 0 y 100.'],
    ['0.12345', 'Usa hasta 4 decimales.'],
  ])(
    'el valor «%s» muestra su mensaje y no envía nada (TOL-4)',
    async (texto, mensaje) => {
      await abrir();
      await escribir(texto);
      // Control positivo: la pantalla llegó al estado inválido.
      expect(screen.getByText(mensaje)).toBeInTheDocument();
      expect(campo()).toHaveAttribute('aria-invalid', 'true');
      expect(botonGuardar()).toBeDisabled();
      await intentarEnviar();
      await esperarIntervalos(4);
      expect(guardados()).toHaveLength(0);
    },
  );

  it('un doble envío síncrono con el PUT retenido envía una sola petición (TOL-6.3, 9.6)', async () => {
    await abrir();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await escribir('0.75');
    // Dos submit en el mismo tick: ninguno ve aún el render con el botón apagado.
    act(() => {
      fireEvent.submit(formulario());
      fireEvent.submit(formulario());
    });
    await waitFor(() => expect(guardados()).toHaveLength(1));
    expect(
      await screen.findByRole('button', { name: 'Guardando…' }),
    ).toBeDisabled();
    fireEvent.submit(formulario());
    await esperarIntervalos(4);
    expect(guardados()).toHaveLength(1);
    compuerta.abrir();
    await screen.findByText('$0.75');
    expect(guardados()).toHaveLength(1);
  });

  it('el inventario de peticiones de un recorrido completo es solo el de la pantalla (TOL-12.3)', async () => {
    await abrir();
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByText(EXITO);
    const permitidas = new Set([
      'GET /api/empresa/tolerancia',
      'PUT /api/empresa/tolerancia',
      'GET /api/bitacora',
    ]);
    const vistas = tolerancia.peticiones().map((p) => `${p.metodo} ${p.ruta}`);
    expect(vistas).toContain('GET /api/empresa/tolerancia');
    expect(vistas).toContain('PUT /api/empresa/tolerancia');
    for (const vista of vistas) expect(permitidas.has(vista)).toBe(true);
  });
});

describe('flujos de tolerancia: errores al guardar (TOL-7)', () => {
  async function intentarGuardar(texto = '0.75') {
    await abrir();
    await escribir(texto);
    await usuario().click(botonGuardar());
  }

  /** Tras el fallo: el texto sigue, los controles se habilitan y el foco está en la alerta. */
  async function comprobarEstadoTrasFallo(texto = '0.75') {
    const alerta = await screen.findByRole('alert');
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(campo()).toHaveValue(texto);
    expect(campo()).toBeEnabled();
    expect(botonGuardar()).toBeEnabled();
    expect(screen.getByText('$0.50')).toBeInTheDocument();
    expect(screen.queryByText(EXITO)).toBeNull();
    return alerta;
  }

  it('400 con una oración de Nest: copy fijo y «toleranciaMonto» no aparece (TOL-7.1)', async () => {
    servidor.use(
      guardarFalla(400, 'toleranciaMonto must not be greater than 100'),
    );
    await intentarGuardar();
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(RECHAZO);
    expect(screen.queryByText(/toleranciaMonto/)).toBeNull();
    expect(screen.queryByText(/greater than/)).toBeNull();
  });

  it('400 con un arreglo de oraciones: el mismo copy y ninguna de ellas (TOL-7.2)', async () => {
    servidor.use(
      guardarFalla(400, [
        'toleranciaMonto must be a string',
        'toleranciaMonto must match regex',
      ]),
    );
    await intentarGuardar();
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(RECHAZO);
    expect(screen.queryByText(/toleranciaMonto/)).toBeNull();
  });

  it('403 de un administrador con rol viejo: copy compartido y la sesión sigue lista (TOL-7.3, 8.6)', async () => {
    servidor.use(guardarFalla(403));
    const { router } = await abrir();
    await escribir('0.75');
    await usuario().click(botonGuardar());
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(SIN_PERMISO_TITULO);
    expect(alerta).toHaveTextContent(SIN_PERMISO_DETALLE);
    expect(screen.queryByText(/acceso_denegado/)).toBeNull();
    expect(router.state.location.pathname).toBe('/tolerancia');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('fallo de red: el valor escrito sigue, los controles se habilitan y el foco va a la alerta (TOL-7.4, 7.8)', async () => {
    servidor.use(guardarRedDeFallo());
    await intentarGuardar();
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(SIN_CONEXION);
    expect(alerta).toHaveTextContent(SIN_CONEXION_GUARDADO);
  });

  it('500: copy genérico y nada del servidor (TOL-7.5)', async () => {
    servidor.use(guardarFalla(500, 'boom del servidor'));
    await intentarGuardar();
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(GENERICO);
    expect(alerta).toHaveTextContent(GENERICO_GUARDADO);
    expect(screen.queryByText(/boom/)).toBeNull();
  });

  it('un 200 fuera de contrato se trata como «otro» y la tarjeta conserva el valor (TOL-7.6)', async () => {
    servidor.use(guardarFueraDeContrato());
    await intentarGuardar();
    const alerta = await comprobarEstadoTrasFallo();
    expect(alerta).toHaveTextContent(GENERICO);
    expect(alerta).toHaveTextContent(GENERICO_GUARDADO);
  });

  it('un 401 termina la sesión y va a /login sin mensaje de la pantalla (TOL-7.7)', async () => {
    servidor.use(guardarFalla(401));
    const { router } = await abrir();
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByText(AVISOS.sesion_expirada);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(RECHAZO)).toBeNull();
    expect(screen.queryByText(GENERICO)).toBeNull();
  });

  it('la alerta se quita al editar el campo (TOL-7.9)', async () => {
    servidor.use(guardarFalla(500));
    await intentarGuardar();
    await screen.findByRole('alert');
    await usuario().type(campo(), '1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('la alerta se quita al volver a enviar, antes de la respuesta (TOL-7.9)', async () => {
    servidor.use(guardarFalla(500));
    await intentarGuardar();
    await screen.findByRole('alert');
    // El siguiente intento queda retenido: se ve el estado intermedio.
    servidor.resetHandlers();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await usuario().click(botonGuardar());
    await screen.findByRole('button', { name: 'Guardando…' });
    expect(screen.queryByRole('alert')).toBeNull();
    compuerta.abrir();
    await screen.findByText(EXITO);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('flujos de tolerancia: roles (TOL-8)', () => {
  it('un contador sin admin ve el valor y el aviso, sin campo ni Guardar, y no hay ningún PUT (TOL-8.2, 8.4)', async () => {
    contextoConRoles(['contador']);
    montarApp('/tolerancia');
    await entrarALaApp();
    await screen.findByText('$0.50');
    expect(screen.getByRole('note')).toHaveTextContent(AVISO);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    await esperarIntervalos(4);
    expect(guardados()).toHaveLength(0);
  });

  it('un revisor (empresa B) ve exactamente lo mismo que un contador (TOL-8.3)', async () => {
    contextoPorToken(idB);
    montarApp('/tolerancia');
    await entrarALaApp(/Abarrotes/);
    await screen.findByText('$0.50');
    expect(screen.getByRole('note')).toHaveTextContent(AVISO);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    await esperarIntervalos(4);
    expect(guardados()).toHaveLength(0);
  });

  it('con los roles contador y admin se muestra el formulario (TOL-8.5)', async () => {
    contextoConRoles(['contador', 'admin']);
    montarApp('/tolerancia');
    await entrarALaApp();
    await screen.findByText('$0.50');
    expect(campo()).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('flujos de tolerancia: época y salidas con un PUT en vuelo (TOL-9)', () => {
  /** El PUT retenido que responde tras la compuerta con el resultado dado. */
  function guardarRetenido(
    compuerta: Promise<void>,
    responder: () => Response,
  ) {
    servidor.use(
      http.put('/api/empresa/tolerancia', async () => {
        await compuerta;
        return responder();
      }),
    );
  }

  async function cambiarAEmpresaB() {
    await usuario().click(cambiarEmpresa());
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByRole('heading', { level: 1, name: /^Bandeja/ });
    await usuario().click(screen.getByRole('link', { name: /^Tolerancia/ }));
  }

  it('cambiar de empresa con un PUT en vuelo que termina bien: B muestra su valor y nada de A (TOL-9.3)', async () => {
    contextoConRoles(['admin', 'contador'], ['admin']);
    valorDeBDistinto('2.5000');
    await abrir();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByRole('button', { name: 'Guardando…' });
    await cambiarAEmpresaB();
    await screen.findByText('$2.50');
    compuerta.abrir();
    // Control positivo: el PUT de A sí se aplicó en el servidor.
    await waitFor(() => expect(tolerancia.valor()).toBe('0.7500'));
    await esperarIntervalos(5);
    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.queryByText('$0.75')).toBeNull();
    expect(screen.queryByText(EXITO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(campo()).toHaveValue('2.50');
  });

  it('cambiar de empresa con un PUT en vuelo que falla: B no muestra la alerta de A (TOL-9.3)', async () => {
    contextoConRoles(['admin', 'contador'], ['admin']);
    valorDeBDistinto('2.5000');
    espia = espiarSolicitudes();
    await abrir();
    const compuerta = crearCompuerta();
    guardarRetenido(compuerta.promesa, () =>
      HttpResponse.json(
        { statusCode: 500, error: 'x', message: 'boom' },
        { status: 500 },
      ),
    );
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByRole('button', { name: 'Guardando…' });
    await cambiarAEmpresaB();
    await screen.findByText('$2.50');
    compuerta.abrir();
    // Control positivo: la respuesta retenida ya se soltó; se espera al temporizador.
    await esperarIntervalos(5);
    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(GENERICO)).toBeNull();
    expect(
      espia.solicitudes.some(
        (s) =>
          s.metodo === 'PUT' &&
          s.ruta === '/api/empresa/tolerancia' &&
          (s.autorizacion ?? '').endsWith(idB),
      ),
    ).toBe(false);
  });

  it('al cambiar de empresa se descarta el borrador escrito: el campo muestra el valor de B (TOL-9.5)', async () => {
    contextoConRoles(['admin', 'contador'], ['admin']);
    valorDeBDistinto('2.5000');
    await abrir();
    await escribir('9.9');
    expect(campo()).toHaveValue('9.9');
    await cambiarAEmpresaB();
    await screen.findByText('$2.50');
    expect(campo()).toHaveValue('2.50');
    expect(screen.queryByText(EXITO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cerrar sesión con un PUT en vuelo: no se escribe nada ni se pide nada más (TOL-9.4)', async () => {
    espia = espiarSolicitudes();
    await abrir();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByRole('button', { name: 'Guardando…' });
    await usuario().click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );
    await screen.findByText(AVISOS.cierre_voluntario);
    const hasta = espia.solicitudes.length;
    compuerta.abrir();
    // Control positivo: el PUT retenido sí llegó al servidor y se aplicó.
    await waitFor(() => expect(tolerancia.valor()).toBe('0.7500'));
    await esperarIntervalos(5);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      espia.solicitudes
        .slice(hasta)
        .filter((s) => /^\/api\/(empresa|bitacora)/.test(s.ruta)),
    ).toEqual([]);
  });

  it('salir de la ruta con un PUT en vuelo: no escribe en la pantalla ni lanza; al volver está el valor nuevo (TOL-9.9)', async () => {
    const { router } = await abrir();
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    await escribir('0.75');
    await usuario().click(botonGuardar());
    await screen.findByRole('button', { name: 'Guardando…' });
    await act(() => router.navigate('/bandeja'));
    await screen.findByRole('heading', { level: 1, name: /^Bandeja/ });
    compuerta.abrir();
    await waitFor(() => expect(tolerancia.valor()).toBe('0.7500'));
    await esperarIntervalos(5);
    expect(screen.queryByText(EXITO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(() => router.navigate('/tolerancia'));
    await screen.findByText('$0.75');
    expect(screen.queryByText(EXITO)).toBeNull();
  });
});

describe('flujos de tolerancia: lectura del valor (TOL-2)', () => {
  it('un 403 al leer muestra el copy de sin permiso, sin Reintentar ni formulario (TOL-2.3)', async () => {
    servidor.use(valorFalla(403));
    montarApp('/tolerancia');
    await entrarALaApp();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(SIN_PERMISO_TITULO);
    expect(alerta).toHaveTextContent(SIN_PERMISO_DETALLE);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Solo un administrador', { exact: false })).toBe(
      null,
    );
  });

  it('mientras el valor carga hay un estado de carga y ningún formulario (TOL-2.1)', async () => {
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ valor: compuerta.promesa });
    montarApp('/tolerancia');
    await entrarALaApp();
    expect(
      await screen.findByText('Cargando la tolerancia'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    compuerta.abrir();
    await screen.findByText('$0.50');
  });
});

describe('flujos de tolerancia: encabezado con la empresa activa (Q8)', () => {
  it('el título es «Tolerancia de monto» y el subtítulo lleva el nombre de la empresa activa', async () => {
    await abrir();
    expect(
      screen.getByText(`${EMPRESA_A} · aplica a movimientos y CFDI en MXN`),
    ).toBeInTheDocument();
  });

  it('tras cambiar de empresa el subtítulo muestra el nombre de B', async () => {
    contextoPorToken(idB);
    await abrir();
    await usuario().click(cambiarEmpresa());
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByRole('heading', { level: 1, name: /^Bandeja/ });
    await usuario().click(screen.getByRole('link', { name: /^Tolerancia/ }));
    expect(
      await screen.findByText(
        `${EMPRESA_B} · aplica a movimientos y CFDI en MXN`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`^${EMPRESA_A} ·`))).toBeNull();
  });

  it('las otras rutas conservan su subtítulo estático', async () => {
    montarApp('/cargas');
    await entrarALaApp();
    expect(
      await screen.findByText(
        'Sube CFDI y estados de cuenta. El motor corre al terminar cada carga.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/aplica a movimientos y CFDI/)).toBeNull();
  });
});
