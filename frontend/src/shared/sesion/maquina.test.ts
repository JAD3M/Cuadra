import { describe, expect, it, vi } from 'vitest';
import {
  contextoSesion,
  listaEmpresasDisponibles,
} from '@/shared/api/contratos';
import { CONTEXTO_SESION, EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import {
  ESTADO_INICIAL,
  crearTienda,
  empresaVigente,
  reducir,
  sesionViva,
  type EstadoInterno,
  type EventoSesion,
} from './maquina';

const USUARIO = contextoSesion.parse(CONTEXTO_SESION).usuario;
const EMPRESAS = listaEmpresasDisponibles.parse(EMPRESAS_DISPONIBLES);
const [EMPRESA_A, EMPRESA_B] = EMPRESAS;
if (!EMPRESA_A || !EMPRESA_B)
  throw new Error('el fixture necesita dos empresas');

const LOGIN_OK: EventoSesion = {
  tipo: 'LOGIN_OK',
  usuario: USUARIO,
  empresas: EMPRESAS,
};
const elegir = (id: string): EventoSesion => ({
  tipo: 'SELECCION_OK',
  empresaId: id,
});

function aplicar(inicial: EstadoInterno, ...eventos: EventoSesion[]) {
  return eventos.reduce(reducir, inicial);
}

const ANONIMO = ESTADO_INICIAL;
const SELECCION = aplicar(ANONIMO, LOGIN_OK);
const SESION = aplicar(SELECCION, elegir(EMPRESA_A.id));
const CAMBIO = aplicar(SESION, { tipo: 'CAMBIO_OK', empresas: EMPRESAS });
const EXPIRADO = aplicar(SESION, {
  tipo: 'TERMINAR',
  motivo: 'sesion_expirada',
});

describe('reducir: transiciones legales', () => {
  it('arranca anónimo, en época 0 y sin empresa previa', () => {
    expect(ANONIMO).toEqual({
      fase: 'anonymous',
      epoca: 0,
      empresaPrevia: null,
    });
  });

  it('LOGIN_OK desde anónimo lleva a selecting(login) con usuario y lista', () => {
    expect(SELECCION).toMatchObject({
      fase: 'selecting',
      origen: 'login',
      usuario: USUARIO,
      empresas: EMPRESAS,
    });
  });

  it('LOGIN_OK también se acepta desde ended', () => {
    expect(aplicar(EXPIRADO, LOGIN_OK)).toMatchObject({
      fase: 'selecting',
      origen: 'login',
    });
  });

  it('SELECCION_OK lleva a sesion con la empresa elegida', () => {
    expect(SESION).toMatchObject({
      fase: 'sesion',
      empresaId: EMPRESA_A.id,
      usuario: USUARIO,
      restaurarOrigen: false,
      varias: true,
    });
  });

  it('SELECCION_OK recuerda si el usuario tiene más de una empresa', () => {
    const unica = aplicar(
      ANONIMO,
      { ...LOGIN_OK, empresas: [EMPRESA_A] },
      elegir(EMPRESA_A.id),
    );
    expect(unica).toMatchObject({ fase: 'sesion', varias: false });
  });

  it('SELECCION_OK incrementa la época en cada elección', () => {
    expect(SESION.epoca).toBe(1);
    const otra = aplicar(CAMBIO, elegir(EMPRESA_B.id));
    expect(otra.epoca).toBe(2);
    const misma = aplicar(
      otra,
      { tipo: 'CAMBIO_OK', empresas: EMPRESAS },
      elegir(EMPRESA_B.id),
    );
    expect(misma.epoca).toBe(3);
  });

  it('CAMBIO_OK desde sesion lleva a selecting(cambio) sin cambiar la época', () => {
    expect(CAMBIO).toMatchObject({
      fase: 'selecting',
      origen: 'cambio',
      empresaId: EMPRESA_A.id,
      epoca: SESION.epoca,
    });
  });

  it('REGRESAR desde selecting(cambio) restaura la sesión con la misma época', () => {
    const vuelta = aplicar(CAMBIO, { tipo: 'REGRESAR' });
    expect(vuelta).toEqual(SESION);
  });

  it('CIERRE desde sesion termina con cierre_voluntario y sin empresa previa', () => {
    expect(aplicar(SESION, { tipo: 'CIERRE' })).toEqual({
      fase: 'ended',
      epoca: 1,
      motivo: 'cierre_voluntario',
      empresaPrevia: null,
    });
  });

  it('CIERRE también se acepta durante un cambio de empresa', () => {
    expect(aplicar(CAMBIO, { tipo: 'CIERRE' })).toMatchObject({
      fase: 'ended',
      motivo: 'cierre_voluntario',
    });
  });

  it('VOLVER desde selecting(login) lleva a anónimo', () => {
    expect(aplicar(SELECCION, { tipo: 'VOLVER' })).toEqual({
      fase: 'anonymous',
      epoca: 0,
      empresaPrevia: null,
    });
  });

  it('EMPRESAS_REFRESCADAS cambia la lista y conserva el origen', () => {
    const una = [EMPRESA_B];
    const evento: EventoSesion = {
      tipo: 'EMPRESAS_REFRESCADAS',
      empresas: una,
    };
    expect(aplicar(SELECCION, evento)).toMatchObject({
      origen: 'login',
      empresas: una,
    });
    expect(aplicar(CAMBIO, evento)).toMatchObject({
      origen: 'cambio',
      empresas: una,
      empresaId: EMPRESA_A.id,
    });
  });

  it.each<[string, EstadoInterno, EventoSesion, string]>([
    [
      'sesion',
      SESION,
      { tipo: 'TERMINAR', motivo: 'sesion_expirada' },
      'sesion_expirada',
    ],
    [
      'sesion',
      SESION,
      { tipo: 'TERMINAR', motivo: 'sin_acceso' },
      'sin_acceso',
    ],
    [
      'cambio',
      CAMBIO,
      { tipo: 'TERMINAR', motivo: 'sesion_expirada' },
      'sesion_expirada',
    ],
    [
      'cambio',
      CAMBIO,
      { tipo: 'TERMINAR', motivo: 'sin_acceso' },
      'sin_acceso',
    ],
    [
      'sesion',
      SESION,
      { tipo: 'TERMINAR', motivo: 'reingreso', email: 'a@b.mx' },
      'reingreso',
    ],
    [
      'cambio',
      CAMBIO,
      { tipo: 'TERMINAR', motivo: 'reingreso', email: 'a@b.mx' },
      'reingreso',
    ],
    [
      'login',
      SELECCION,
      { tipo: 'TERMINAR', motivo: 'seleccion_vencida', email: 'a@b.mx' },
      'seleccion_vencida',
    ],
    [
      'login',
      SELECCION,
      { tipo: 'TERMINAR', motivo: 'sin_empresas', email: 'a@b.mx' },
      'sin_empresas',
    ],
    [
      'cambio',
      CAMBIO,
      { tipo: 'TERMINAR', motivo: 'sin_empresas', email: 'a@b.mx' },
      'sin_empresas',
    ],
    [
      'sesion',
      SESION,
      { tipo: 'TERMINAR', motivo: 'sin_empresas', email: 'a@b.mx' },
      'sin_empresas',
    ],
  ])('TERMINAR desde %s: %#', (_origen, estado, evento, motivo) => {
    expect(reducir(estado, evento)).toMatchObject({ fase: 'ended', motivo });
  });

  it('el correo viaja solo con reingreso, seleccion_vencida y sin_empresas', () => {
    const conCorreo = (
      motivo: 'reingreso' | 'seleccion_vencida' | 'sin_empresas',
    ) =>
      reducir(motivo === 'reingreso' ? SESION : SELECCION, {
        tipo: 'TERMINAR',
        motivo,
        email: 'a@b.mx',
      });
    expect(conCorreo('reingreso')).toMatchObject({ email: 'a@b.mx' });
    expect(conCorreo('seleccion_vencida')).toMatchObject({ email: 'a@b.mx' });
    expect(conCorreo('sin_empresas')).toMatchObject({ email: 'a@b.mx' });
    expect(EXPIRADO).not.toHaveProperty('email');
  });
});

describe('reducir: transiciones ilegales dejan el estado intacto', () => {
  const TODOS: Record<string, EstadoInterno> = {
    anonymous: ANONIMO,
    'selecting(login)': SELECCION,
    'selecting(cambio)': CAMBIO,
    sesion: SESION,
    ended: EXPIRADO,
  };
  const EVENTOS: Record<string, EventoSesion> = {
    LOGIN_OK,
    SELECCION_OK: elegir(EMPRESA_A.id),
    CAMBIO_OK: { tipo: 'CAMBIO_OK', empresas: EMPRESAS },
    REGRESAR: { tipo: 'REGRESAR' },
    CONSUMIR: { tipo: 'CONSUMIR' },
    CIERRE: { tipo: 'CIERRE' },
    VOLVER: { tipo: 'VOLVER' },
    EMPRESAS_REFRESCADAS: { tipo: 'EMPRESAS_REFRESCADAS', empresas: [] },
    'TERMINAR sesion_expirada': { tipo: 'TERMINAR', motivo: 'sesion_expirada' },
    'TERMINAR sin_acceso': { tipo: 'TERMINAR', motivo: 'sin_acceso' },
    'TERMINAR reingreso': { tipo: 'TERMINAR', motivo: 'reingreso' },
    'TERMINAR seleccion_vencida': {
      tipo: 'TERMINAR',
      motivo: 'seleccion_vencida',
    },
    'TERMINAR sin_empresas': { tipo: 'TERMINAR', motivo: 'sin_empresas' },
    'TERMINAR cierre_voluntario': {
      tipo: 'TERMINAR',
      motivo: 'cierre_voluntario',
    },
  };
  // Pares (fase, evento) que SÍ son legales; todo lo demás se ignora.
  const LEGALES = new Set([
    'anonymous|LOGIN_OK',
    'ended|LOGIN_OK',
    'selecting(login)|SELECCION_OK',
    'selecting(cambio)|SELECCION_OK',
    'sesion|CAMBIO_OK',
    'selecting(cambio)|REGRESAR',
    'ended|CONSUMIR',
    'sesion|CIERRE',
    'selecting(cambio)|CIERRE',
    'selecting(login)|VOLVER',
    'selecting(login)|EMPRESAS_REFRESCADAS',
    'selecting(cambio)|EMPRESAS_REFRESCADAS',
    'sesion|TERMINAR sesion_expirada',
    'selecting(cambio)|TERMINAR sesion_expirada',
    'sesion|TERMINAR sin_acceso',
    'selecting(cambio)|TERMINAR sin_acceso',
    'sesion|TERMINAR reingreso',
    'selecting(cambio)|TERMINAR reingreso',
    'selecting(login)|TERMINAR seleccion_vencida',
    'selecting(login)|TERMINAR sin_empresas',
    'selecting(cambio)|TERMINAR sin_empresas',
    'sesion|TERMINAR sin_empresas',
  ]);

  const ilegales = Object.keys(TODOS).flatMap((fase) =>
    Object.keys(EVENTOS)
      .filter((evento) => !LEGALES.has(`${fase}|${evento}`))
      .map((evento) => [fase, evento] as const),
  );

  it.each(ilegales)('%s ignora %s (mismo objeto)', (fase, evento) => {
    const estado = TODOS[fase];
    const ev = EVENTOS[evento];
    if (!estado || !ev) throw new Error('caso mal armado');
    expect(reducir(estado, ev)).toBe(estado);
  });

  it('cubre todas las combinaciones fase x evento', () => {
    expect(ilegales.length + LEGALES.size).toBe(
      Object.keys(TODOS).length * Object.keys(EVENTOS).length,
    );
  });
});

describe('idempotencia y CONSUMIR', () => {
  it('TERMINAR repetido no cambia nada tras el primero', () => {
    const otra = reducir(EXPIRADO, {
      tipo: 'TERMINAR',
      motivo: 'sesion_expirada',
    });
    expect(otra).toBe(EXPIRADO);
    expect(reducir(EXPIRADO, { tipo: 'TERMINAR', motivo: 'sin_acceso' })).toBe(
      EXPIRADO,
    );
  });

  it('CONSUMIR pasa de ended a anonymous una sola vez', () => {
    const anonimo = reducir(EXPIRADO, { tipo: 'CONSUMIR' });
    expect(anonimo.fase).toBe('anonymous');
    expect(reducir(anonimo, { tipo: 'CONSUMIR' })).toBe(anonimo);
  });

  it('CAMBIO_OK y EMPRESAS_REFRESCADAS actualizan varias con la lista fresca', () => {
    const unica: EventoSesion = {
      tipo: 'CAMBIO_OK',
      empresas: [EMPRESA_A],
    };
    const cambio = aplicar(SESION, unica);
    expect(cambio).toMatchObject({ origen: 'cambio', varias: false });
    const refrescada = aplicar(cambio, {
      tipo: 'EMPRESAS_REFRESCADAS',
      empresas: EMPRESAS,
    });
    expect(refrescada).toMatchObject({ varias: true });
    expect(aplicar(refrescada, { tipo: 'REGRESAR' })).toMatchObject({
      fase: 'sesion',
      varias: true,
    });
  });

  it('preserva el origen del paso de elección al refrescar la lista', () => {
    const refrescada = aplicar(
      CAMBIO,
      { tipo: 'EMPRESAS_REFRESCADAS', empresas: [EMPRESA_B] },
      { tipo: 'EMPRESAS_REFRESCADAS', empresas: EMPRESAS },
    );
    expect(refrescada).toMatchObject({ origen: 'cambio', empresas: EMPRESAS });
  });
});

describe('empresa previa (SA-2) y regreso al origen', () => {
  it('se fija al terminar por expiración desde la sesión', () => {
    expect(EXPIRADO).toMatchObject({ empresaPrevia: EMPRESA_A.id });
  });

  it('se fija al terminar durante un cambio de empresa', () => {
    expect(
      aplicar(CAMBIO, { tipo: 'TERMINAR', motivo: 'sesion_expirada' }),
    ).toMatchObject({ empresaPrevia: EMPRESA_A.id });
    expect(
      aplicar(CAMBIO, { tipo: 'TERMINAR', motivo: 'reingreso' }),
    ).toMatchObject({ empresaPrevia: EMPRESA_A.id });
  });

  it('sin_acceso no deja destino de regreso', () => {
    expect(
      aplicar(SESION, { tipo: 'TERMINAR', motivo: 'sin_acceso' }),
    ).toMatchObject({ empresaPrevia: null });
  });

  it('sobrevive a CONSUMIR y a LOGIN_OK', () => {
    const anonimo = aplicar(EXPIRADO, { tipo: 'CONSUMIR' });
    expect(anonimo).toMatchObject({ empresaPrevia: EMPRESA_A.id });
    expect(aplicar(anonimo, LOGIN_OK)).toMatchObject({
      origen: 'login',
      empresaPrevia: EMPRESA_A.id,
    });
    expect(aplicar(EXPIRADO, LOGIN_OK)).toMatchObject({
      empresaPrevia: EMPRESA_A.id,
    });
  });

  it('sobrevive a un fin de selección vencida', () => {
    const vencida = aplicar(EXPIRADO, LOGIN_OK, {
      tipo: 'TERMINAR',
      motivo: 'seleccion_vencida',
    });
    expect(vencida).toMatchObject({ empresaPrevia: EMPRESA_A.id });
  });

  it('SELECCION_OK la borra y activa restaurarOrigen solo con la misma empresa', () => {
    const misma = aplicar(EXPIRADO, LOGIN_OK, elegir(EMPRESA_A.id));
    expect(misma).toMatchObject({ fase: 'sesion', restaurarOrigen: true });
    expect(misma).not.toHaveProperty('empresaPrevia');

    const otra = aplicar(EXPIRADO, LOGIN_OK, elegir(EMPRESA_B.id));
    expect(otra).toMatchObject({ fase: 'sesion', restaurarOrigen: false });
  });

  it('tras elegir, una expiración posterior fija la nueva empresa previa', () => {
    const otra = aplicar(EXPIRADO, LOGIN_OK, elegir(EMPRESA_B.id), {
      tipo: 'TERMINAR',
      motivo: 'sesion_expirada',
    });
    expect(otra).toMatchObject({ empresaPrevia: EMPRESA_B.id });
  });

  it('VOLVER la borra', () => {
    const volvio = aplicar(EXPIRADO, LOGIN_OK, { tipo: 'VOLVER' });
    expect(volvio).toMatchObject({ fase: 'anonymous', empresaPrevia: null });
    expect(aplicar(volvio, LOGIN_OK, elegir(EMPRESA_A.id))).toMatchObject({
      restaurarOrigen: false,
    });
  });

  it('el cierre voluntario no recuerda la empresa', () => {
    const cierre = aplicar(
      SESION,
      { tipo: 'CIERRE' },
      LOGIN_OK,
      elegir(EMPRESA_A.id),
    );
    expect(cierre).toMatchObject({ restaurarOrigen: false });
  });

  it('un cambio de empresa nunca activa restaurarOrigen', () => {
    expect(aplicar(CAMBIO, elegir(EMPRESA_A.id))).toMatchObject({
      restaurarOrigen: false,
    });
  });

  it('REGRESAR y CAMBIO_OK conservan restaurarOrigen de la sesión', () => {
    const restaurada = aplicar(EXPIRADO, LOGIN_OK, elegir(EMPRESA_A.id));
    const ida = aplicar(restaurada, { tipo: 'CAMBIO_OK', empresas: EMPRESAS });
    expect(ida).toMatchObject({ restaurarOrigen: true });
    expect(aplicar(ida, { tipo: 'REGRESAR' })).toEqual(restaurada);
  });
});

describe('ayudantes de fase', () => {
  it('empresaVigente y sesionViva solo dan datos con la sesión viva', () => {
    expect(empresaVigente(SESION)).toBe(EMPRESA_A.id);
    expect(empresaVigente(CAMBIO)).toBe(EMPRESA_A.id);
    expect(empresaVigente(SELECCION)).toBeNull();
    expect(empresaVigente(ANONIMO)).toBeNull();
    expect(empresaVigente(EXPIRADO)).toBeNull();
    expect(sesionViva(SESION)).toBe(true);
    expect(sesionViva(CAMBIO)).toBe(true);
    expect(sesionViva(SELECCION)).toBe(false);
    expect(sesionViva(EXPIRADO)).toBe(false);
  });
});

describe('estado interno sin secretos', () => {
  it('ningún estado alcanzable contiene la palabra token', () => {
    const estados = [ANONIMO, SELECCION, SESION, CAMBIO, EXPIRADO];
    for (const estado of estados) {
      expect(JSON.stringify(estado).toLowerCase()).not.toContain('token');
    }
  });
});

describe('crearTienda', () => {
  it('notifica solo cuando el estado cambia', () => {
    const tienda = crearTienda(reducir, ANONIMO);
    const oyente = vi.fn();
    tienda.suscribir(oyente);
    tienda.enviar({ tipo: 'CONSUMIR' });
    expect(oyente).not.toHaveBeenCalled();
    tienda.enviar(LOGIN_OK);
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(tienda.obtener().fase).toBe('selecting');
  });

  it('deja de notificar a quien se desuscribe', () => {
    const tienda = crearTienda(reducir, ANONIMO);
    const oyente = vi.fn();
    const baja = tienda.suscribir(oyente);
    baja();
    tienda.enviar(LOGIN_OK);
    expect(oyente).not.toHaveBeenCalled();
  });

  it('el estado leído desde un oyente ya es el nuevo', () => {
    const tienda = crearTienda(reducir, ANONIMO);
    let visto = '';
    tienda.suscribir(() => {
      visto = tienda.obtener().fase;
    });
    tienda.enviar(LOGIN_OK);
    expect(visto).toBe('selecting');
  });
});
