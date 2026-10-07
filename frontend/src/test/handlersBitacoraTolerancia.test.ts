import { describe, expect, it } from 'vitest';
import { EVENTOS_MAQUETA } from '@/test/fixturesBitacora';
import { almacenes } from '@/test/handlers';
import { crearHandlersBitacora } from '@/test/handlersBitacora';
import { crearHandlersTolerancia } from '@/test/handlersTolerancia';
import { servidor } from '@/test/servidor';

// El mock de la tolerancia (CU-25) y el de la bitácora (CU-26) comparten UN
// almacén de eventos y UN `GET /bitacora` registrado (ver handlers.ts).

const bitacora = almacenes.bitacora;

async function pedir(ruta: string, init?: RequestInit) {
  const respuesta = await fetch(`/api${ruta}`, init);
  const texto = await respuesta.text();
  let cuerpo: unknown = texto;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // cuerpo no JSON: se devuelve el texto.
  }
  return { status: respuesta.status, cuerpo };
}

interface Sobre {
  datos: { id: string }[];
  total: number;
}

const lista = (consulta = '') =>
  pedir(consulta === '' ? '/bitacora' : `/bitacora?${consulta}`);
const ids = (cuerpo: unknown) => (cuerpo as Sobre).datos.map((e) => e.id);

describe('compatibilidad con el mock de la tolerancia', () => {
  it('el PUT de la tolerancia antepone una fila visible en GET /bitacora y en el almacén compartido', async () => {
    const antes = bitacora.eventos().length;
    const guardado = await pedir('/empresa/tolerancia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toleranciaMonto: '0.75' }),
    });
    expect(guardado.status).toBe(200);
    expect(bitacora.eventos()).toHaveLength(antes + 1);
    expect(bitacora.eventos()[0]).toMatchObject({
      entidad: 'companies',
      accion: 'actualizar',
    });
    const { cuerpo } = await lista('entidad=companies&accion=actualizar');
    expect((cuerpo as Sobre).datos[0]!.id).toBe(bitacora.eventos()[0]!.id);
    // La tolerancia sigue viendo lo mismo por su propia API.
    expect(almacenes.tolerancia.cambios()).toBe(bitacora.eventos());
  });

  it('lo que fija el almacén de la bitácora lo sirve el GET registrado una sola vez', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { cuerpo } = await lista();
    expect(ids(cuerpo)).toEqual(EVENTOS_MAQUETA.map((e) => e.id));
    expect(almacenes.tolerancia.cambios()).toEqual(EVENTOS_MAQUETA);
  });

  it('crearHandlersTolerancia() con su propio almacén sigue sirviendo GET /bitacora y su PUT', async () => {
    const propio = crearHandlersTolerancia();
    servidor.use(...propio.handlers);
    const antes = propio.cambios().length;
    const inicial = await lista('entidad=companies&accion=actualizar');
    expect((inicial.cuerpo as Sobre).total).toBeGreaterThan(0);
    await pedir('/empresa/tolerancia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toleranciaMonto: '9' }),
    });
    expect(propio.cambios()).toHaveLength(antes + 1);
    const { cuerpo } = await lista('entidad=companies&accion=actualizar');
    expect((cuerpo as Sobre).datos[0]!.id).toBe(propio.cambios()[0]!.id);
  });

  it('un almacén inyectado se comparte entre la bitácora y la tolerancia', async () => {
    const compartido = crearHandlersBitacora([]);
    const tolerancia = crearHandlersTolerancia('0.5000', undefined, compartido);
    servidor.use(...compartido.handlersUsuarios, ...tolerancia.handlers);
    await pedir('/empresa/tolerancia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toleranciaMonto: '1' }),
    });
    expect(compartido.eventos()).toHaveLength(1);
    expect(tolerancia.cambios()).toBe(compartido.eventos());
    expect((await lista()).cuerpo).toMatchObject({ total: 1 });
    // El registro de la bitácora vio el GET que atendió la tolerancia.
    expect(compartido.peticiones().map((p) => p.ruta)).toEqual([
      '/api/bitacora',
    ]);
    expect(tolerancia.peticiones().map((p) => p.ruta)).toEqual([
      '/api/empresa/tolerancia',
      '/api/bitacora',
    ]);
  });
});
