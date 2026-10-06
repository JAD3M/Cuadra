import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelDecision, type PanelDecisionProps } from './PanelDecision';

function dibujar(props: Partial<PanelDecisionProps> = {}) {
  const onConfirmar = vi.fn();
  const onRechazar = vi.fn();
  const resultado = render(
    <PanelDecision
      etiquetaCfdi="A-1044"
      enviando={null}
      onConfirmar={onConfirmar}
      onRechazar={onRechazar}
      {...props}
    />,
  );
  return { onConfirmar, onRechazar, ...resultado };
}

const confirmar = () =>
  screen.getByRole('button', { name: 'Confirmar conciliación A-1044' });
const rechazar = () => screen.getByRole('button', { name: 'Rechazar A-1044' });
const campo = () => screen.getByLabelText('Motivo del rechazo (opcional)');

describe('PanelDecision', () => {
  it('es la tarjeta «Tu decisión» con sus dos botones y la frase de la maqueta', () => {
    dibujar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tu decisión' }),
    ).toBeInTheDocument();
    expect(confirmar()).toBeEnabled();
    expect(rechazar()).toBeEnabled();
    // B15: la frase vive aquí, no en la tarjeta del motor.
    expect(
      screen.getByText(
        'El motor y la IA solo proponen. Solo una persona cierra un caso.',
      ),
    ).toBeInTheDocument();
  });

  it('los nombres accesibles nombran el CFDI y contienen el texto visible', () => {
    dibujar();
    expect(confirmar()).toHaveTextContent('✓');
    expect(confirmar()).toHaveTextContent('Confirmar conciliación');
    expect(rechazar()).toHaveTextContent('Rechazar');
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('✕')).toHaveAttribute('aria-hidden', 'true');
  });

  it('un clic en confirmar llama una vez, sin diálogo ni segundo paso', async () => {
    const { onConfirmar, onRechazar } = dibujar();
    await userEvent.click(confirmar());
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onRechazar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('no hay «Cancelar» ni «Enviar rechazo»', () => {
    dibujar();
    expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Enviar rechazo/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rechazar sin motivo llama con undefined', async () => {
    const { onRechazar } = dibujar();
    await userEvent.click(rechazar());
    expect(onRechazar).toHaveBeenCalledTimes(1);
    expect(onRechazar).toHaveBeenCalledWith(undefined);
  });

  it('solo espacios cuenta como sin motivo', async () => {
    const { onRechazar } = dibujar();
    await userEvent.type(campo(), '   ');
    await userEvent.click(rechazar());
    expect(onRechazar).toHaveBeenCalledWith(undefined);
  });

  it('el motivo se envía recortado', async () => {
    const { onRechazar } = dibujar();
    await userEvent.type(campo(), '  Monto no corresponde  ');
    await userEvent.click(rechazar());
    expect(onRechazar).toHaveBeenCalledWith('Monto no corresponde');
  });

  it('exactamente 500 tras recortar sí se envía', async () => {
    const { onRechazar } = dibujar();
    fireEvent.change(campo(), { target: { value: `${'a'.repeat(500)}  ` } });
    await userEvent.click(rechazar());
    expect(onRechazar).toHaveBeenCalledWith('a'.repeat(500));
    expect(campo()).not.toHaveAttribute('aria-invalid');
  });

  it('501 tras recortar: mensaje, aria-invalid, nada se envía y el foco vuelve al campo', async () => {
    const { onRechazar } = dibujar();
    fireEvent.change(campo(), { target: { value: 'a'.repeat(501) } });
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('El motivo no puede pasar de 500 caracteres.'),
    ).toBeInTheDocument();
    expect(screen.getByText('501 / 500')).toBeInTheDocument();
    await userEvent.click(rechazar());
    expect(onRechazar).not.toHaveBeenCalled();
    expect(campo()).toHaveFocus();
  });

  it('confirmar no se pre-bloquea por un motivo demasiado largo', async () => {
    const { onConfirmar } = dibujar();
    fireEvent.change(campo(), { target: { value: 'a'.repeat(600) } });
    await userEvent.click(confirmar());
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('el texto sobrevive a un intento fallido (sigue montado y editable)', async () => {
    const { rerender, onConfirmar, onRechazar } = dibujar();
    await userEvent.type(campo(), 'porque sí');
    await userEvent.click(rechazar());
    rerender(
      <PanelDecision
        etiquetaCfdi="A-1044"
        enviando="rechazar"
        onConfirmar={onConfirmar}
        onRechazar={onRechazar}
      />,
    );
    rerender(
      <PanelDecision
        etiquetaCfdi="A-1044"
        enviando={null}
        onConfirmar={onConfirmar}
        onRechazar={onRechazar}
      />,
    );
    expect(campo()).toHaveValue('porque sí');
    expect(rechazar()).toBeEnabled();
  });

  describe('enviando', () => {
    it('confirmando: ambos botones deshabilitados, «Confirmando…» y región en vivo', () => {
      dibujar({ enviando: 'confirmar' });
      expect(
        screen.getByRole('button', { name: /^Confirmando…/ }),
      ).toBeDisabled();
      expect(rechazar()).toBeDisabled();
      const region = screen.getByRole('status');
      expect(region).toHaveTextContent('Enviando tu decisión');
    });

    it('rechazando: «Rechazando…» y el otro botón conserva su texto', () => {
      dibujar({ enviando: 'rechazar' });
      expect(
        screen.getByRole('button', { name: /^Rechazando…/ }),
      ).toBeDisabled();
      expect(confirmar()).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Enviando tu decisión',
      );
    });

    it('el campo también se deshabilita mientras se envía', () => {
      dibujar({ enviando: 'rechazar' });
      expect(campo()).toBeDisabled();
    });

    it('sin envío no hay región en vivo ni botones deshabilitados', () => {
      dibujar();
      expect(screen.queryByRole('status')).toBeNull();
      expect(confirmar()).toBeEnabled();
    });

    it('un clic con el envío en curso no llama a nada', async () => {
      const { onConfirmar, onRechazar } = dibujar({ enviando: 'confirmar' });
      await userEvent.click(
        screen.getByRole('button', { name: /^Confirmando…/ }),
      );
      expect(onConfirmar).not.toHaveBeenCalled();
      expect(onRechazar).not.toHaveBeenCalled();
    });
  });

  it('cualquier usuario ve los controles habilitados: el panel no conoce el rol', () => {
    dibujar();
    expect(confirmar()).toBeEnabled();
    expect(rechazar()).toBeEnabled();
  });
});
