import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import cuentaFuente from '@/features/cargas/cuenta.ts?raw';
import textosFuente from '@/features/cargas/textos.ts?raw';
import { CampoCuenta } from './CampoCuenta';
import campoFuente from './CampoCuenta.tsx?raw';

const AYUDA =
  'Escribe solo los últimos dígitos. No hace falta el número completo.';
const COMPLETA =
  'Parece un número de cuenta completo. Escribe solo los últimos dígitos.';

function Arnes({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const [valor, setValor] = useState('');
  return (
    <CampoCuenta
      valor={valor}
      onCambiar={setValor}
      deshabilitado={deshabilitado}
    />
  );
}

describe('CampoCuenta', () => {
  it('etiqueta, ejemplo y tope de 32 caracteres (6.5)', () => {
    render(<Arnes />);
    const entrada = screen.getByLabelText('Cuenta');
    expect(entrada).toHaveAttribute('placeholder', '****1234');
    expect(entrada).toHaveAttribute('maxlength', '32');
  });

  it('muestra la ayuda por omisión y la enlaza con aria-describedby (6.1)', () => {
    render(<Arnes />);
    const entrada = screen.getByLabelText('Cuenta');
    const ayuda = screen.getByText(AYUDA);
    expect(entrada).toHaveAccessibleDescription(AYUDA);
    expect(entrada.getAttribute('aria-describedby')).toContain(ayuda.id);
    expect(screen.queryByText(COMPLETA)).toBeNull();
  });

  it('con 18 dígitos seguidos avisa, sin bloquear ni quitar la ayuda (6.2)', async () => {
    render(<Arnes />);
    const entrada = screen.getByLabelText('Cuenta');
    await userEvent.setup().type(entrada, '012345678901234567');
    expect(screen.getByText(COMPLETA)).toBeInTheDocument();
    expect(screen.getByText(AYUDA)).toBeInTheDocument();
    expect(entrada).toHaveAccessibleDescription(`${AYUDA} ${COMPLETA}`);
    expect(entrada).not.toHaveAttribute('aria-invalid');
  });

  it('el aviso aparece y desaparece al pasar el umbral de 10 dígitos', async () => {
    render(<Arnes />);
    const entrada = screen.getByLabelText('Cuenta');
    const usuario = userEvent.setup();
    await usuario.type(entrada, '123456789');
    expect(screen.queryByText(COMPLETA)).toBeNull();
    await usuario.type(entrada, '0');
    expect(screen.getByText(COMPLETA)).toBeInTheDocument();
    await usuario.type(entrada, '{Backspace}');
    expect(screen.queryByText(COMPLETA)).toBeNull();
  });

  it.each(['****1234', '0123-4567-8901'])(
    'no avisa con %s (6.3)',
    async (valor) => {
      render(<Arnes />);
      await userEvent.setup().type(screen.getByLabelText('Cuenta'), valor);
      expect(screen.queryByText(COMPLETA)).toBeNull();
    },
  );

  it('el valor nunca se repite fuera del input', async () => {
    const { container } = render(<Arnes />);
    await userEvent
      .setup()
      .type(screen.getByLabelText('Cuenta'), '012345678901234567');
    const fuera = Array.from(container.querySelectorAll('*'))
      .filter((n) => n.tagName !== 'INPUT')
      .map((n) => n.textContent ?? '')
      .join(' ');
    expect(fuera).not.toContain('012345678901234567');
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('deshabilitado: el input lo está', () => {
    render(<Arnes deshabilitado />);
    expect(screen.getByLabelText('Cuenta')).toBeDisabled();
  });

  it('el ejemplo de diez dígitos no aparece en el código de producción (6.5)', () => {
    const ejemplo = ['0123', '456789'].join('');
    for (const fuente of [campoFuente, cuentaFuente, textosFuente]) {
      expect(fuente).not.toContain(ejemplo);
    }
  });
});
