import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CampoMotivo, type CampoMotivoProps } from './CampoMotivo';

/** Controlado como lo usa el panel: el texto vive en el padre. */
function Controlado(props: Partial<CampoMotivoProps> & { inicial?: string }) {
  const { inicial = '', ...resto } = props;
  const [valor, setValor] = useState(inicial);
  return (
    <CampoMotivo
      valor={valor}
      onCambio={setValor}
      invalido={false}
      deshabilitado={false}
      {...resto}
    />
  );
}

describe('CampoMotivo', () => {
  it('tiene la etiqueta «Motivo del rechazo (opcional)» y un contador en vivo', async () => {
    render(<Controlado />);
    const campo = screen.getByLabelText('Motivo del rechazo (opcional)');
    expect(campo.tagName).toBe('TEXTAREA');
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    await userEvent.type(campo, 'hola');
    expect(screen.getByText('4 / 500')).toBeInTheDocument();
  });

  it('el contador muestra el largo bruto, con los espacios de las orillas', () => {
    render(<Controlado inicial="  hola  " />);
    expect(screen.getByText('8 / 500')).toBeInTheDocument();
  });

  it('un emoji suma uno al contador', () => {
    render(<Controlado inicial="😀" />);
    expect(screen.getByText('1 / 500')).toBeInTheDocument();
  });

  it('no limita lo que se puede escribir: sin maxLength, el exceso se alcanza al pegar', () => {
    render(<Controlado />);
    const campo = screen.getByLabelText('Motivo del rechazo (opcional)');
    expect(campo).not.toHaveAttribute('maxlength');
    fireEvent.change(campo, { target: { value: 'a'.repeat(512) } });
    expect(screen.getByText('512 / 500')).toBeInTheDocument();
  });

  it('sin exceso no hay mensaje ni aria-invalid', () => {
    render(<Controlado />);
    const campo = screen.getByLabelText('Motivo del rechazo (opcional)');
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(
      screen.queryByText('El motivo no puede pasar de 500 caracteres.'),
    ).toBeNull();
  });

  it('inválido: mensaje, aria-invalid y descripción enlazada', () => {
    render(<Controlado inicial={'a'.repeat(512)} invalido />);
    const campo = screen.getByLabelText('Motivo del rechazo (opcional)');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    const mensaje = screen.getByText(
      'El motivo no puede pasar de 500 caracteres.',
    );
    const ayuda = campo.getAttribute('aria-describedby');
    expect(ayuda).toBeTruthy();
    const region = document.getElementById(ayuda as string);
    expect(region).toContainElement(mensaje);
    expect(region).toContainElement(screen.getByText('512 / 500'));
  });

  it('deshabilitado no deja escribir', () => {
    render(<Controlado deshabilitado />);
    expect(
      screen.getByLabelText('Motivo del rechazo (opcional)'),
    ).toBeDisabled();
  });

  it('entrega la referencia del textarea para poder enfocarlo', () => {
    let nodo: HTMLTextAreaElement | null = null;
    render(
      <Controlado
        campoRef={(el) => {
          nodo = el;
        }}
      />,
    );
    expect(nodo).toBe(screen.getByLabelText('Motivo del rechazo (opcional)'));
  });
});
