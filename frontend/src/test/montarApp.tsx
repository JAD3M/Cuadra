import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { createMemoryRouter, type InitialEntry } from 'react-router';
import { App } from '@/App';
import { rutas } from '@/app/router';
import { CREDENCIALES } from '@/test/montarSesion';

/**
 * Monta la aplicación completa (proveedores reales, tabla de rutas real) sobre
 * un enrutador en memoria. Cada montaje es una página recién cargada: sin
 * tokens, sin sesión. Las respuestas de la API salen del servidor MSW.
 */
export function montarApp(entrada: InitialEntry) {
  const router = createMemoryRouter(rutas, { initialEntries: [entrada] });
  const vista = render(<App router={router} />);
  return { ...vista, router };
}

/** Escribe las credenciales de la demo en el formulario y lo envía. */
export async function enviarLogin(
  credenciales: { email: string; password: string } = CREDENCIALES,
) {
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Correo'),
    credenciales.email,
  );
  await usuario.type(
    screen.getByLabelText('Contraseña'),
    credenciales.password,
  );
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

/** Elige una empresa de la lista del paso 2 por su nombre. */
export async function elegirEmpresaPorNombre(nombre: RegExp | string) {
  const tarjeta = await screen.findByRole('button', { name: nombre });
  await userEvent.setup().click(tarjeta);
}

/** Login completo hasta ver el shell: correo, contraseña y empresa. */
export async function entrarALaApp(nombre: RegExp | string = /Ferreteria/) {
  await enviarLogin();
  await elegirEmpresaPorNombre(nombre);
  await screen.findByRole('banner');
}

/**
 * Espera a que la bandeja termine su primera carga (tabla y resumen). Desde
 * CU-22 entrar a `/bandeja` dispara peticiones: una prueba que espía las
 * solicitudes posteriores debe empezar después de ellas, o bajo carga de CPU
 * las cuenta como si fueran suyas.
 */
export async function esperarBandejaCargada() {
  await screen.findByText(/^Mostrando \d/);
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
}
