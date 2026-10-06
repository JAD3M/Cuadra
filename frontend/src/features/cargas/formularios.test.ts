import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api';
import { servidor } from '@/test/servidor';
import { construirFormCfdi, construirFormEstadoCuenta } from './formularios';

type Parte = [campo: string, valor: string];

/** Envía el formulario por el cliente real y devuelve las partes que recibe MSW. */
async function recibirPartes(form: FormData): Promise<Parte[]> {
  const partes: Parte[] = [];
  servidor.use(
    http.post('/api/subida', async ({ request }) => {
      for (const [campo, valor] of (await request.formData()).entries()) {
        partes.push([
          campo,
          typeof valor === 'string' ? valor : `archivo:${valor.name}`,
        ]);
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  await api.fetch('/subida', { method: 'POST', body: form });
  return partes;
}

describe('construirFormCfdi', () => {
  it('19.1: tres xml dan tres partes archivos y nada más', async () => {
    const archivos = ['a.xml', 'b.xml', 'c.xml'].map(
      (nombre) => new File(['<x/>'], nombre),
    );
    expect(await recibirPartes(construirFormCfdi(archivos))).toEqual([
      ['archivos', 'archivo:a.xml'],
      ['archivos', 'archivo:b.xml'],
      ['archivos', 'archivo:c.xml'],
    ]);
  });
});

describe('construirFormEstadoCuenta', () => {
  const csv = () => new File(['a,b'], 'movs.csv');

  it('19.2: csv + banco + perfil, con la cuenta vacía ausente', async () => {
    const form = construirFormEstadoCuenta({
      archivo: csv(),
      banco: 'BBVA',
      cuenta: '',
      perfil: 'banco-norte',
    });
    expect(await recibirPartes(form)).toEqual([
      ['archivo', 'archivo:movs.csv'],
      ['banco', 'BBVA'],
      ['perfil', 'banco-norte'],
    ]);
  });

  it('un perfil null no se envía', async () => {
    const form = construirFormEstadoCuenta({
      archivo: csv(),
      banco: 'BBVA',
      cuenta: '****1234',
      perfil: null,
    });
    expect(await recibirPartes(form)).toEqual([
      ['archivo', 'archivo:movs.csv'],
      ['banco', 'BBVA'],
      ['cuenta', '****1234'],
    ]);
  });

  it('los valores se envían como se escribieron, sin recortar', async () => {
    const form = construirFormEstadoCuenta({
      archivo: csv(),
      banco: ' BBVA ',
      cuenta: ' 1234 ',
      perfil: null,
    });
    expect(form.get('banco')).toBe(' BBVA ');
    expect(form.get('cuenta')).toBe(' 1234 ');
  });

  it('un campo de solo espacios no se agrega', () => {
    const form = construirFormEstadoCuenta({
      archivo: csv(),
      banco: '   ',
      cuenta: '\t',
      perfil: null,
    });
    expect([...form.keys()]).toEqual(['archivo']);
  });
});
