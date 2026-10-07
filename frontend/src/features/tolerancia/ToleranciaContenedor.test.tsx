import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import { almacenes } from '@/test/handlers';
import {
  cambiosFalla,
  cambiosFueraDeContrato,
  guardarFalla,
  cambiosRedDeFallo,
  valorFalla,
  valorRedDeFallo,
} from '@/test/handlersTolerancia';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { esperarValor } from '@/test/tarjetaValor';
import { ToleranciaContenedor } from './ToleranciaContenedor';

// Pruebas del contenedor con el cliente SIN reintentos: el de la app reintenta
// los fallos de red y los 5xx con espera, y haría lentas estas comprobaciones
// (los flujos de la app cubren solo los fallos que no se reintentan, como el
// 403).

const tolerancia = almacenes.tolerancia;

function montar(estado?: () => SessionState) {
  return render(<ToleranciaContenedor />, {
    wrapper: envoltura(clienteDePruebas(), estado),
  });
}

const usuario = () => userEvent.setup();
const campo = () =>
  screen.getByRole('textbox', {
    name: 'Nuevo valor (0 a 100, hasta 4 decimales)',
  });

describe('ToleranciaContenedor: lectura del valor', () => {
  it('un fallo de red al leer muestra la alerta con Reintentar; el segundo intento trae el valor y el formulario (TOL-2.2)', async () => {
    servidor.use(valorRedDeFallo());
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    // El siguiente intento usa el manejador por defecto.
    servidor.resetHandlers();
    await usuario().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await esperarValor('$0.50')).toBeInTheDocument();
    expect(campo()).toHaveValue('0.50');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 500 con «boom» en el cuerpo muestra el genérico y nunca el texto del servidor (TOL-2.4)', async () => {
    servidor.use(
      http.get('/api/empresa/tolerancia', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'x', message: 'boom' },
          { status: 500 },
        ),
      ),
    );
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(screen.queryByText(/boom/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('un 403 al leer muestra el copy de sin permiso, sin Reintentar (TOL-2.3)', async () => {
    servidor.use(valorFalla(403));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('sin sesión lista no pinta nada y no pide nada', async () => {
    const { container } = montar(() => ({
      status: 'loading',
      restaurarOrigen: false,
    }));
    await esperarIntervalos(4);
    expect(container).toBeEmptyDOMElement();
    expect(tolerancia.peticiones()).toHaveLength(0);
  });
});

describe('ToleranciaContenedor: el foco al terminar de guardar', () => {
  it('tras un éxito el foco vuelve al campo, que ya muestra el valor del servidor', async () => {
    montar();
    await esperarValor('$0.50');
    const u = usuario();
    await u.clear(campo());
    await u.type(campo(), '1');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await esperarValor('$1.00');
    await waitFor(() => expect(campo()).toHaveFocus());
    expect(campo()).toHaveValue('1.00');
  });

  it('un 401 no muestra nada y el foco vuelve al campo con el texto escrito', async () => {
    servidor.use(guardarFalla(401));
    montar();
    await esperarValor('$0.50');
    const u = usuario();
    await u.clear(campo());
    await u.type(campo(), '1');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    // Control positivo: el envío terminó y el botón volvió a estar disponible.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled(),
    );
    await waitFor(() => expect(campo()).toHaveFocus());
    await esperarIntervalos(4);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(campo()).toHaveValue('1');
  });
});

describe('ToleranciaContenedor: cambios recientes', () => {
  const TITULO = 'Últimos 5 cambios';
  const lista = () => screen.getByRole('list', { name: TITULO });
  const bitacoras = () =>
    tolerancia.peticiones().filter((p) => p.ruta === '/api/bitacora');
  const valores = () =>
    tolerancia.peticiones().filter((p) => p.ruta === '/api/empresa/tolerancia');

  it('mientras los cambios cargan, el valor y el formulario ya están y la lista aparece al abrir la compuerta (TOL-10.10)', async () => {
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ cambios: compuerta.promesa });
    montar();
    await esperarValor('$0.50');
    expect(campo()).toBeEnabled();
    expect(screen.getByText('Cargando los cambios')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: TITULO })).toBeNull();
    compuerta.abrir();
    await screen.findByRole('list', { name: TITULO });
    expect(screen.queryByText('Cargando los cambios')).toBeNull();
  });

  it('un fallo de red en los cambios no toca el valor ni el formulario; Reintentar pide solo la bitácora (TOL-10.9, 10.10)', async () => {
    servidor.use(cambiosRedDeFallo());
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar los cambios.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(await esperarValor('$0.50')).toBeInTheDocument();
    expect(campo()).toBeEnabled();
    const valoresAntes = valores().length;
    const bitacorasAntes = bitacoras().length;
    servidor.resetHandlers();
    await usuario().click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('list', { name: TITULO });
    expect(bitacoras()).toHaveLength(bitacorasAntes + 1);
    expect(valores()).toHaveLength(valoresAntes);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 403 en los cambios muestra el copy compartido sin Reintentar, y el valor sigue (TOL-10.9)', async () => {
    servidor.use(cambiosFalla(403));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(await esperarValor('$0.50')).toBeInTheDocument();
  });

  it('un sobre fuera de contrato en los cambios muestra el genérico y nunca texto del servidor', async () => {
    servidor.use(cambiosFueraDeContrato());
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(await esperarValor('$0.50')).toBeInTheDocument();
  });

  it('si el valor falla, la lista se pinta y cada Reintentar toca solo lo suyo (TOL-2.5)', async () => {
    servidor.use(valorRedDeFallo());
    montar();
    await screen.findByRole('list', { name: TITULO });
    expect(lista()).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    const bitacorasAntes = bitacoras().length;
    servidor.resetHandlers();
    await usuario().click(screen.getByRole('button', { name: 'Reintentar' }));
    await esperarValor('$0.50');
    await esperarIntervalos(4);
    expect(bitacoras()).toHaveLength(bitacorasAntes);
  });

  it('el orden del teclado es el campo, Guardar y luego Reintentar de los cambios', async () => {
    servidor.use(cambiosRedDeFallo());
    montar();
    await screen.findByRole('alert');
    await esperarValor('$0.50');
    const u = usuario();
    await u.click(campo());
    await u.type(campo(), '1');
    await u.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  });
});
