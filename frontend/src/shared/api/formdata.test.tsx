import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { servidor } from '@/test/servidor';

// Spike M18 / ADR-6: comprueba, con `setup.ts` restaurando los globales
// nativos, que un FormData con un File llega a un manejador MSW que lo lee con
// `request.formData()`, y que `userEvent.upload` sigue funcionando con Files
// nativos. El camino por `api.fetch` se prueba en `client.test.ts`.
describe('FormData y File nativos en jsdom', () => {
  it('el manejador recibe las partes de archivo y los mismos nombres de campo', async () => {
    const vistos: Array<[string, string]> = [];
    servidor.use(
      http.post('/api/spike', async ({ request }) => {
        const datos = await request.formData();
        for (const [campo, valor] of datos.entries()) {
          vistos.push([
            campo,
            typeof valor === 'string' ? valor : `archivo:${valor.name}`,
          ]);
        }
        return HttpResponse.json({ ok: true });
      }),
    );
    const form = new FormData();
    form.append('archivos', new File(['<x/>'], 'a.xml'));
    form.append('banco', 'BBVA');
    await fetch('/api/spike', { method: 'POST', body: form });
    expect(vistos).toEqual([
      ['archivos', 'archivo:a.xml'],
      ['banco', 'BBVA'],
    ]);
  });

  it('userEvent.upload entrega Files nativos a un input de tipo file', async () => {
    const recibidos: File[] = [];
    render(
      <label>
        Elegir
        <input
          type="file"
          multiple
          onChange={(e) => recibidos.push(...Array.from(e.target.files ?? []))}
        />
      </label>,
    );
    const archivos = [
      new File(['<a/>'], 'a.xml', { type: 'text/xml' }),
      new File(['<b/>'], 'b.xml'),
    ];
    await userEvent.upload(screen.getByLabelText('Elegir'), archivos);
    expect(recibidos.map((f) => f.name)).toEqual(['a.xml', 'b.xml']);
    expect(await recibidos[0]?.text()).toBe('<a/>');
  });
});
