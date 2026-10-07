import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClaseErrorGuardado } from '@/features/tolerancia/errores';
import type { MotivoInvalido } from '@/features/tolerancia/validarTolerancia';
import {
  FormularioTolerancia,
  type FormularioToleranciaProps,
} from './FormularioTolerancia';

const ETIQUETA = 'Nuevo valor (0 a 100, hasta 4 decimales)';
const AYUDA_NORMAL =
  'El cambio queda en la bitácora con el valor anterior y el nuevo. Solo afecta corridas futuras del motor.';
const AYUDA_MISMO = 'Es el valor actual. Escribe otro para guardar.';
const EXITO = 'Tolerancia guardada. Aplica desde la próxima corrida del motor.';

const MOTIVOS: readonly (readonly [MotivoInvalido, string])[] = [
  ['vacio', 'Escribe un valor.'],
  ['formato', 'Escribe un número con punto decimal, por ejemplo 0.50.'],
  ['rango', 'El valor debe estar entre 0 y 100.'],
  ['decimales', 'Usa hasta 4 decimales.'],
];

function pintar(parcial: Partial<FormularioToleranciaProps> = {}) {
  const onCambiar = vi.fn();
  const onGuardar = vi.fn();
  const props: FormularioToleranciaProps = {
    texto: '0.75',
    ayuda: 'normal',
    invalido: null,
    puedeGuardar: true,
    guardando: false,
    exito: false,
    fallo: null,
    onCambiar,
    onGuardar,
    ...parcial,
  };
  const vista = render(<FormularioTolerancia {...props} />);
  return { ...vista, onCambiar, onGuardar };
}

const campo = () => screen.getByRole('textbox', { name: ETIQUETA });
const guardar = () => screen.getByRole('button', { name: /^Guardar/ });

describe('campo (TOL-3.1, TOL-11.2)', () => {
  it('es un textbox de texto con etiqueta enlazada, no un spinbutton', () => {
    pintar();
    expect(campo()).toHaveAttribute('type', 'text');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByLabelText(ETIQUETA)).toBe(campo());
  });

  it('inputMode decimal, sin autocompletar ni corrector', () => {
    pintar();
    expect(campo()).toHaveAttribute('inputmode', 'decimal');
    expect(campo()).toHaveAttribute('autocomplete', 'off');
    expect(campo()).toHaveAttribute('spellcheck', 'false');
  });

  it('muestra el texto que le da el contenedor', () => {
    pintar({ texto: '0.005' });
    expect(campo()).toHaveValue('0.005');
  });

  it('avisa de cada tecla con el texto completo que quedaría', async () => {
    const { onCambiar } = pintar({ texto: '0.7' });
    await userEvent.type(campo(), '5');
    expect(onCambiar).toHaveBeenCalledExactlyOnceWith('0.75');
  });

  it('la referencia del campo llega al input', () => {
    const campoRef = createRef<HTMLInputElement>();
    pintar({ campoRef });
    expect(campoRef.current).toBe(campo());
  });
});

describe('ayuda y descripción (TOL-3.3, TOL-5.1, TOL-11.2)', () => {
  it('válido y distinto: la ayuda normal es la descripción del campo', () => {
    pintar();
    expect(campo()).toHaveAccessibleDescription(AYUDA_NORMAL);
    expect(campo()).toHaveAttribute('aria-invalid', 'false');
  });

  it('igual al vigente: la ayuda de «es el valor actual» reemplaza a la normal', () => {
    pintar({ texto: '0.50', ayuda: 'mismo_valor', puedeGuardar: false });
    expect(campo()).toHaveAccessibleDescription(AYUDA_MISMO);
    expect(screen.queryByText(AYUDA_NORMAL)).toBeNull();
    expect(campo()).toHaveAttribute('aria-invalid', 'false');
  });

  it('la descripción es UN solo elemento enlazado por aria-describedby', () => {
    pintar();
    const ids = (campo().getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0] ?? '')).toHaveTextContent(
      AYUDA_NORMAL,
    );
  });
});

describe.each(MOTIVOS)('borrador inválido: %s (TOL-4.7)', (motivo, mensaje) => {
  it('muestra el mensaje, marca el campo y no deja guardar', () => {
    pintar({ invalido: motivo, puedeGuardar: false });
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(campo()).toHaveAccessibleDescription(mensaje);
    expect(guardar()).toBeDisabled();
  });

  it('el mensaje reemplaza a las ayudas, no se suma', () => {
    pintar({ invalido: motivo, puedeGuardar: false });
    expect(screen.queryByText(AYUDA_NORMAL)).toBeNull();
    expect(screen.queryByText(AYUDA_MISMO)).toBeNull();
  });

  it('el mensaje no se anuncia por su cuenta: no es una alerta ni un estado', () => {
    pintar({ invalido: motivo, puedeGuardar: false });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(screen.getByRole('status')).queryByText(mensaje)).toBeNull();
  });
});

it('al corregir, aria-invalid vuelve a false y la descripción cambia (TOL-4.7)', () => {
  const { rerender, onCambiar, onGuardar } = pintar({
    texto: '100.5',
    invalido: 'rango',
    puedeGuardar: false,
  });
  expect(campo()).toHaveAttribute('aria-invalid', 'true');
  rerender(
    <FormularioTolerancia
      texto="10.5"
      ayuda="normal"
      invalido={null}
      puedeGuardar
      guardando={false}
      exito={false}
      fallo={null}
      onCambiar={onCambiar}
      onGuardar={onGuardar}
    />,
  );
  expect(campo()).toHaveAttribute('aria-invalid', 'false');
  expect(campo()).toHaveAccessibleDescription(AYUDA_NORMAL);
});

describe('envío (TOL-6.1, TOL-4.8, TOL-5.4)', () => {
  it('el botón Guardar envía una sola vez', async () => {
    const { onGuardar } = pintar();
    await userEvent.click(guardar());
    expect(onGuardar).toHaveBeenCalledTimes(1);
  });

  it('Enter en el campo envía una sola vez', async () => {
    const { onGuardar } = pintar();
    await userEvent.type(campo(), '{enter}');
    expect(onGuardar).toHaveBeenCalledTimes(1);
  });

  it('Enter con un borrador inválido no envía nada', async () => {
    const { onGuardar } = pintar({ invalido: 'formato', puedeGuardar: false });
    await userEvent.type(campo(), '{enter}');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('Enter con el valor igual al vigente no envía nada', async () => {
    const { onGuardar } = pintar({ ayuda: 'mismo_valor', puedeGuardar: false });
    await userEvent.type(campo(), '{enter}');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('el botón deshabilitado no responde al clic', async () => {
    const { onGuardar } = pintar({ puedeGuardar: false });
    expect(guardar()).toBeDisabled();
    await userEvent.click(guardar());
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('un submit forzado con borrador inválido o igual no envía: la puerta es del formulario', () => {
    const invalido = pintar({ invalido: 'rango', puedeGuardar: false });
    fireEvent.submit(campo().closest('form') as HTMLFormElement);
    expect(invalido.onGuardar).not.toHaveBeenCalled();
    invalido.unmount();

    const igual = pintar({ ayuda: 'mismo_valor', puedeGuardar: false });
    fireEvent.submit(campo().closest('form') as HTMLFormElement);
    expect(igual.onGuardar).not.toHaveBeenCalled();
  });

  it('un submit forzado mientras guarda no envía otra vez (TOL-6.3)', () => {
    const { onGuardar } = pintar({ guardando: true, puedeGuardar: true });
    fireEvent.submit(campo().closest('form') as HTMLFormElement);
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('el envío no recarga la página: se cancela el submit nativo', async () => {
    pintar();
    const formulario = campo().closest('form');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    formulario?.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });
});

describe('guardando (TOL-6.2)', () => {
  it('el botón dice «Guardando…» y está deshabilitado, igual que el campo', () => {
    pintar({ guardando: true, puedeGuardar: false });
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(campo()).toBeDisabled();
  });

  it('un guardado en curso deshabilita el botón aunque puedeGuardar llegue true', () => {
    pintar({ guardando: true, puedeGuardar: true });
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('anuncia «Guardando la tolerancia» en la región de estado', () => {
    pintar({ guardando: true, puedeGuardar: false });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Guardando la tolerancia',
    );
  });

  it('fuera de un guardado el botón dice «Guardar»', () => {
    pintar();
    expect(guardar()).toHaveTextContent(/^Guardar$/);
  });
});

describe('región de estado y éxito (TOL-6.4, TOL-6.8)', () => {
  it('antes de guardar existe, vacía, para que su cambio se anuncie', () => {
    pintar();
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
  });

  it('hay UNA sola región de estado en el formulario', () => {
    pintar();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('el éxito se pinta dentro de esa misma región', () => {
    const { rerender, onCambiar, onGuardar } = pintar();
    const region = screen.getByRole('status');
    rerender(
      <FormularioTolerancia
        texto="0.75"
        ayuda="mismo_valor"
        invalido={null}
        puedeGuardar={false}
        guardando={false}
        exito
        fallo={null}
        onCambiar={onCambiar}
        onGuardar={onGuardar}
      />,
    );
    expect(screen.getByRole('status')).toBe(region);
    expect(within(region).getByText(EXITO)).toBeInTheDocument();
  });

  it('el éxito convive con la ayuda de «es el valor actual»', () => {
    pintar({ ayuda: 'mismo_valor', puedeGuardar: false, exito: true });
    expect(screen.getByText(EXITO)).toBeInTheDocument();
    expect(campo()).toHaveAccessibleDescription(AYUDA_MISMO);
  });

  it('sin éxito no hay mensaje de guardado', () => {
    pintar();
    expect(screen.queryByText(EXITO)).toBeNull();
  });
});

describe('alertas de guardado (TOL-7)', () => {
  it('sin fallo no hay alerta', () => {
    pintar();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('400 (rechazo): una sola frase fija, sin título aparte (TOL-7.1)', () => {
    pintar({ fallo: 'rechazo' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(
      'El servidor no aceptó el valor. Escribe un número entre 0 y 100, con hasta 4 decimales.',
    );
    expect(within(alerta).getAllByText(/./)).toHaveLength(1);
  });

  it('403 (sin permiso): el copy compartido (TOL-7.3)', () => {
    pintar({ fallo: 'sin_permiso' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
  });

  it('red (conexión): avisa que el valor sigue en el campo (TOL-7.4)', () => {
    pintar({ fallo: 'conexion' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo. El valor que escribiste sigue en el campo.',
    );
  });

  it('otro (5xx y demás): el genérico, con el valor en el campo (TOL-7.5)', () => {
    pintar({ fallo: 'otro' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).toHaveTextContent(
      'El valor que escribiste sigue en el campo. Inténtalo de nuevo en unos minutos.',
    );
  });

  it.each<ClaseErrorGuardado>(['rechazo', 'sin_permiso', 'conexion', 'otro'])(
    'la clase %s nunca muestra texto del servidor ni códigos internos',
    (fallo) => {
      const { container } = pintar({ fallo });
      expect(container).not.toHaveTextContent(/toleranciaMonto/);
      expect(container).not.toHaveTextContent(/acceso_denegado/);
    },
  );

  it('la alerta se puede enfocar desde código: la referencia llega a ella (TOL-7.8)', () => {
    const alertaRef = createRef<HTMLDivElement>();
    pintar({ fallo: 'conexion', alertaRef });
    expect(alertaRef.current).toBe(screen.getByRole('alert'));
    expect(alertaRef.current).toHaveAttribute('tabindex', '-1');
  });

  it('tras un fallo el campo y el botón siguen disponibles con el texto escrito', () => {
    pintar({ fallo: 'otro', texto: '0.75' });
    expect(campo()).toBeEnabled();
    expect(campo()).toHaveValue('0.75');
    expect(guardar()).toBeEnabled();
  });
});
