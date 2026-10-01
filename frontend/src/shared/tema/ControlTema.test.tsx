import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearMatchMediaFalso } from '@/test/fixturesTema';
import { ControlTema } from './ControlTema';
import { CLAVE_TEMA } from './tipos';
import { ThemeProvider } from './ThemeProvider';

const tema = () => document.documentElement.getAttribute('data-theme');

function montar() {
  return render(
    <ThemeProvider>
      <ControlTema />
    </ThemeProvider>,
  );
}

function instalarSistema(oscuro: boolean) {
  const sistema = crearMatchMediaFalso(oscuro);
  vi.stubGlobal('matchMedia', sistema.matchMedia);
  window.matchMedia = sistema.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  instalarSistema(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ControlTema', () => {
  it('sin nada guardado marca "Sistema", no el tema resuelto', () => {
    instalarSistema(true);
    montar();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).not.toBeChecked();
    expect(tema()).toBe('dark');
  });

  it('con "system" guardado y el sistema en claro marca Sistema, no Claro', () => {
    localStorage.setItem(CLAVE_TEMA, 'system');
    montar();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Claro' })).not.toBeChecked();
    expect(tema()).toBe('light');
  });

  it('marca la preferencia guardada al iniciar', () => {
    localStorage.setItem(CLAVE_TEMA, 'dark');
    montar();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
  });

  it('elegir Oscuro aplica data-theme y lo guarda', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(tema()).toBe('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark');
  });

  it('elegir Claro aplica data-theme y lo guarda', async () => {
    instalarSistema(true);
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(tema()).toBe('light');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light');
  });

  it('volver a Sistema guarda "system" y sigue al sistema operativo', async () => {
    localStorage.setItem(CLAVE_TEMA, 'dark');
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema' }));
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('system');
    expect(tema()).toBe('light');
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
  });

  it('funciona con el teclado', async () => {
    montar();
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(tema()).toBe('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark');
  });

  it('si el almacenamiento falla no muestra error y el tema igual cambia', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota excedida');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado');
    });
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(tema()).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('fuera de ThemeProvider falla con un mensaje claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ControlTema />)).toThrow(/ThemeProvider/);
  });
});
