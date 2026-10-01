import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { useTema } from './useTema';
import { CLAVE_TEMA } from './tipos';
import {
  crearMatchMediaFalso,
  type MatchMediaFalso,
} from '@/test/fixturesTema';

function Sonda() {
  const { preferencia, resuelto, setPreferencia } = useTema();
  return (
    <div>
      <p data-testid="estado">{`${preferencia}|${resuelto}`}</p>
      <button onClick={() => setPreferencia('dark')}>oscuro</button>
      <button onClick={() => setPreferencia('light')}>claro</button>
      <button onClick={() => setPreferencia('system')}>sistema</button>
    </div>
  );
}

function montar() {
  return render(
    <ThemeProvider>
      <Sonda />
    </ThemeProvider>,
  );
}

const estado = () => screen.getByTestId('estado').textContent;
const tema = () => document.documentElement.getAttribute('data-theme');

let sistema: MatchMediaFalso;

function instalarSistema(oscuro: boolean) {
  sistema = crearMatchMediaFalso(oscuro);
  vi.stubGlobal('matchMedia', sistema.matchMedia);
  window.matchMedia = sistema.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  instalarSistema(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('sin nada guardado es system y sigue al sistema', () => {
    instalarSistema(true);
    montar();
    expect(estado()).toBe('system|dark');
    expect(tema()).toBe('dark');
  });

  it('una elección guardada gana sobre el sistema', () => {
    instalarSistema(true);
    localStorage.setItem(CLAVE_TEMA, 'light');
    montar();
    expect(estado()).toBe('light|light');
    expect(tema()).toBe('light');
  });

  it('elegir persiste y aplica data-theme', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'oscuro' }));
    expect(tema()).toBe('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark');
  });

  it('con system reacciona al cambio del sistema', () => {
    montar();
    expect(tema()).toBe('light');
    act(() => sistema.cambiarSistema(true));
    expect(estado()).toBe('system|dark');
    expect(tema()).toBe('dark');
  });

  it('con elección explícita ignora el cambio del sistema', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'claro' }));
    expect(sistema.escuchas()).toBe(0);
    act(() => sistema.cambiarSistema(true));
    expect(tema()).toBe('light');
  });

  it('volver a system retoma el sistema actual', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'claro' }));
    act(() => sistema.cambiarSistema(true));
    await userEvent.click(screen.getByRole('button', { name: 'sistema' }));
    expect(estado()).toBe('system|dark');
    expect(tema()).toBe('dark');
  });

  it('el evento storage sincroniza otra pestaña', () => {
    montar();
    act(() => {
      localStorage.setItem(CLAVE_TEMA, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_TEMA }));
    });
    expect(estado()).toBe('dark|dark');
    act(() => {
      localStorage.removeItem(CLAVE_TEMA);
      window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_TEMA }));
    });
    expect(estado()).toBe('system|light');
  });

  it('ignora el evento storage de otras claves', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'oscuro' }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'otra' }));
    });
    expect(estado()).toBe('dark|dark');
  });

  it('con almacenamiento bloqueado no falla y el tema aplica en la sesión', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    montar();
    expect(estado()).toBe('system|light');
    await userEvent.click(screen.getByRole('button', { name: 'oscuro' }));
    expect(estado()).toBe('dark|dark');
    expect(tema()).toBe('dark');
  });

  it('sin matchMedia asume oscuro y no falla', () => {
    vi.stubGlobal('matchMedia', undefined);
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    montar();
    expect(estado()).toBe('system|dark');
  });

  it('useTema fuera del proveedor lanza', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sonda />)).toThrow(/ThemeProvider/);
  });
});
