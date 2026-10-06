import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOTIVO_IA_REAL, MOTIVO_IA_SIMULADA } from '@/test/fixturesBandeja';
import { TarjetaMotor } from './TarjetaMotor';

describe('TarjetaMotor', () => {
  it('muestra el título, el código de la regla y el motivo tal cual', () => {
    render(
      <TarjetaMotor
        regla="referencia_exacta"
        motivo='La referencia "A-1044" coincide con el CFDI A-1044.'
      />,
    );
    expect(screen.getByText('Por qué el motor lo propone')).toBeInTheDocument();
    expect(screen.getByText('referencia_exacta')).toBeInTheDocument();
    expect(
      screen.getByText('La referencia "A-1044" coincide con el CFDI A-1044.'),
    ).toBeInTheDocument();
  });

  it('una regla desconocida se muestra verbatim y sin insignia', () => {
    render(<TarjetaMotor regla="regla_nueva" motivo="Motivo nuevo" />);
    expect(screen.getByText('regla_nueva')).toBeInTheDocument();
    expect(screen.queryByText('IA')).toBeNull();
    expect(screen.queryByText('IA · simulada')).toBeNull();
  });

  it('la insignia «IA» solo sale con la regla llm_sugerencia', () => {
    render(<TarjetaMotor regla="llm_sugerencia" motivo={MOTIVO_IA_REAL} />);
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.queryByText('IA · simulada')).toBeNull();
  });

  it('«IA · simulada» solo con el prefijo completo al inicio del motivo', () => {
    render(<TarjetaMotor regla="llm_sugerencia" motivo={MOTIVO_IA_SIMULADA} />);
    expect(screen.getByText('IA · simulada')).toBeInTheDocument();
  });

  it('la etiqueta suelta o en medio del motivo no vuelve simulada la insignia', () => {
    render(
      <TarjetaMotor
        regla="llm_sugerencia"
        motivo="Nota [SIMULADA — no es un modelo real] en medio"
      />,
    );
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.queryByText('IA · simulada')).toBeNull();
  });

  it('otra regla con motivo de IA no lleva insignia', () => {
    render(<TarjetaMotor regla="monto_unico" motivo={MOTIVO_IA_SIMULADA} />);
    expect(screen.queryByText('IA')).toBeNull();
    expect(screen.queryByText('IA · simulada')).toBeNull();
  });

  it('B15: la frase «solo una persona cierra un caso» no está aquí, vive en la decisión', () => {
    render(<TarjetaMotor regla="referencia_exacta" motivo="x" />);
    expect(screen.queryByText(/Solo una persona cierra un caso/)).toBeNull();
  });

  it('sin regla ni motivo no muestra huecos ni errores', () => {
    render(<TarjetaMotor regla={null} motivo={null} />);
    expect(screen.getByText('Por qué el motor lo propone')).toBeInTheDocument();
    expect(screen.queryByText('null')).toBeNull();
  });
});
