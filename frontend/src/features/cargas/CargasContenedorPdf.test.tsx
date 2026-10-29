import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import type { SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import {
  CONTEXTO_SESION,
  SESION_LISTA,
  capacidadesDeRoles,
} from '@/test/fixtures';
import { almacenes } from '@/test/handlers';
import {
  LECTURA_PDF,
  lecturaPdfRechazada,
  subidaFalla,
  subidaRedDeFallo,
  subida413Html,
} from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { CargasContenedor } from './CargasContenedor';

// Historia 3.2: el modo «PDF BBVA» de la tarjeta de estado de cuenta lee el
// PDF y muestra qué se leyó; no importa nada ni toca el historial.

function sesionConRoles(roles: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({
      ...CONTEXTO_SESION,
      roles,
      capacidades: capacidadesDeRoles(roles),
    }),
  } as SessionState;
}

function montar(roles: string[] = ['contador']) {
  return render(
    <MemoryRouter>
      <CargasContenedor />
    </MemoryRouter>,
    {
      wrapper: envolturaCargas(clienteDePruebas(), () => sesionConRoles(roles)),
    },
  );
}

const usuario = () => userEvent.setup({ applyAccept: false });
const pdf = (nombre = 'estado-sep-2026.pdf') => new File(['%PDF-1.4'], nombre);
const csv = (nombre = 'estado.csv') => new File(['a,b'], nombre);

const tarjeta = () => screen.getByRole('region', { name: 'Estado de cuenta' });
const botonLeer = () =>
  screen.getByRole('button', { name: 'Leer estado de cuenta' });

async function entrarAPdf(u = usuario()) {
  await u.click(screen.getByRole('button', { name: 'PDF BBVA' }));
  return u;
}

describe('CargasContenedor: lectura de PDF', () => {
  it('lee el PDF, muestra conteos, saldos y estado, y no toca el historial', async () => {
    montar();
    const filasAntes = almacenes.cargas.filas().length;
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    const resultado = await within(tarjeta()).findByText(/movimientos leídos/);
    expect(resultado).toHaveTextContent(
      '14 movimientos leídos. Los saldos cuadran.',
    );
    expect(within(tarjeta()).getByText('10,000.00')).toBeInTheDocument();
    expect(within(tarjeta()).getByText('11,250.50')).toBeInTheDocument();
    expect(
      within(tarjeta()).getByText('Pendiente de vista previa'),
    ).toBeInTheDocument();
    expect(within(tarjeta()).queryByText('⚠')).not.toBeInTheDocument();
    expect(
      within(tarjeta()).getByRole('link', { name: 'Revisar vista previa' }),
    ).toHaveAttribute('href', `/cargas/${LECTURA_PDF.cargaId}/vista-previa`);

    const [subida] = almacenes.cargas.subidas();
    expect(almacenes.cargas.subidas()).toHaveLength(1);
    expect(subida?.ruta).toBe('estado-cuenta/pdf');
    expect(subida?.campos).toEqual([['banco', 'bbva']]);
    expect(almacenes.cargas.filas()).toHaveLength(filasAntes);
    // Nada se importó: el archivo sigue elegido para volver a leerlo.
    expect(within(tarjeta()).getByText('estado-sep-2026.pdf')).toBeVisible();
  });

  it('mientras lee: «Leyendo…», texto y barra del mockup, y todo apagado', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    const boton = await screen.findByRole('button', { name: 'Leyendo…' });
    expect(boton).toBeDisabled();
    expect(
      within(tarjeta()).getByText('Leyendo el estado de cuenta…'),
    ).toBeInTheDocument();
    expect(within(tarjeta()).getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
    compuerta.abrir();
    await within(tarjeta()).findByText(/movimientos leídos/);
    expect(
      screen.queryByText('Leyendo el estado de cuenta…'),
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'pdf_sin_texto',
      'El PDF no tiene texto seleccionable (parece una imagen escaneada). Descarga el PDF desde el portal del banco.',
      'No se pudo leer el PDF',
    ],
    [
      'pdf_ilegible',
      'No reconocimos el formato del estado de cuenta BBVA.',
      'No se pudo leer el PDF',
    ],
    [
      'moneda_no_mxn',
      'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
      'Archivo rechazado',
    ],
  ])('el rechazo %s muestra su alerta', async (codigo, detalle, titulo) => {
    servidor.use(lecturaPdfRechazada(codigo, 'texto del servidor'));
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    const alerta = await within(tarjeta()).findByRole('alert');
    expect(alerta).toHaveTextContent(titulo);
    expect(alerta).toHaveTextContent(detalle);
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(
      within(tarjeta()).queryByText(/movimientos leídos/),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(botonLeer()).toBeEnabled();
  });

  it.each([
    [
      'saldos_no_cuadran',
      'Archivo rechazado: los saldos no cuadran',
      'Los saldos del estado de cuenta no cuadran (servidor).',
      {
        saldoEsperado: '11500.50',
        diferencia: '-250.00',
        lineasNoLeidas: [{ linea: 18, texto: '07/SEP PAGO 1,25' }],
      },
      ['11,500.50', '−250.00', 'Línea 18 · 07/SEP PAGO 1,25'],
    ],
    [
      'lineas_no_leidas',
      'Archivo rechazado: hay líneas sin leer',
      'No pudimos leer algunas líneas (servidor).',
      { lineasNoLeidas: [{ linea: 31, texto: '12/SEP CARGO ILEGIBLE' }] },
      ['Línea 31 · 12/SEP CARGO ILEGIBLE'],
    ],
    [
      'sin_movimientos',
      'Archivo rechazado: sin movimientos',
      'No pudimos leer ningún movimiento (servidor).',
      { lineasNoLeidas: [] },
      [],
    ],
  ])(
    'el rechazo %s muestra título, mensaje del servidor y sus datos',
    async (codigo, titulo, mensaje, extra, textos) => {
      servidor.use(lecturaPdfRechazada(codigo, mensaje, extra));
      montar();
      const u = await entrarAPdf();
      await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
      await u.click(botonLeer());
      const alerta = await within(tarjeta()).findByRole('alert');
      expect(alerta).toHaveTextContent(titulo);
      expect(alerta).toHaveTextContent(mensaje);
      for (const texto of textos) {
        expect(within(alerta).getByText(texto)).toBeInTheDocument();
      }
      expect(
        within(tarjeta()).queryByText(/movimientos leídos/),
      ).not.toBeInTheDocument();
      await waitFor(() => expect(alerta).toHaveFocus());
    },
  );

  it('un 400 con motivo en texto muestra el motivo del servidor', async () => {
    servidor.use(...subidaFalla(400, 'El archivo pasa de 10 MB'));
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    const alerta = await within(tarjeta()).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo procesar la carga.');
    expect(alerta).toHaveTextContent('El archivo pasa de 10 MB');
  });

  it('un 413 usa la alerta compartida', async () => {
    servidor.use(...subida413Html());
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    expect(await within(tarjeta()).findByRole('alert')).toHaveTextContent(
      'Los archivos pesan demasiado.',
    );
  });

  it('un corte de red ofrece Reintentar y vuelve a leer lo mismo', async () => {
    servidor.use(...subidaRedDeFallo());
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    const alerta = await within(tarjeta()).findByRole('alert');
    servidor.resetHandlers();
    await u.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await within(tarjeta()).findByText(/movimientos leídos/);
  });

  it('un archivo que no es .pdf no se envía y dice por qué', async () => {
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('movs.xlsx'));
    expect(
      within(tarjeta()).getByText('Solo se aceptan archivos .pdf'),
    ).toBeInTheDocument();
    expect(botonLeer()).toBeDisabled();
    expect(almacenes.cargas.subidas()).toHaveLength(0);
  });

  it('cambiar de formato muestra cada modo con su propio archivo y resultado', async () => {
    montar();
    const u = await entrarAPdf();
    await u.upload(screen.getByLabelText('Elegir archivo'), pdf());
    await u.click(botonLeer());
    await within(tarjeta()).findByText(/movimientos leídos/);

    await u.click(screen.getByRole('button', { name: 'CSV' }));
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Cuenta')).toBeInTheDocument();
    expect(screen.queryByText(/movimientos leídos/)).not.toBeInTheDocument();
    expect(screen.queryByText('estado-sep-2026.pdf')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'PDF BBVA' }));
    expect(screen.getByText(/movimientos leídos/)).toBeInTheDocument();
  });

  it('el modo CSV sigue subiendo por la ruta de siempre', async () => {
    montar();
    const u = usuario();
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Perfil de lectura') as HTMLSelectElement)
          .options.length,
      ).toBe(3),
    );
    await u.upload(screen.getByLabelText('Elegir archivo'), csv());
    await u.click(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    );
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    expect(almacenes.cargas.subidas()[0]?.ruta).toBe('estado-cuenta');
  });
});
