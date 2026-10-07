import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '@/shared/sesion';
import { almacenes } from '@/test/handlers';
import {
  guardarFalla,
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
