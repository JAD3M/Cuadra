import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvisoAuth } from './AvisoAuth';
import { FormularioLogin, type FalloLogin } from './FormularioLogin';

const CREDENCIALES: FalloLogin = {
  titulo: 'Correo o contraseña incorrectos',
  detalle: 'Revisa tus datos e inténtalo de nuevo.',
  tipo: 'credenciales',
};
const CONEXION: FalloLogin = {
  titulo: 'No se pudo conectar con el servidor.',
  detalle: 'Inténtalo de nuevo.',
  tipo: 'conexion',
};

type Props = Partial<Parameters<typeof FormularioLogin>[0]>;

function montar(props: Props = {}) {
  const onEnviar = vi.fn();
  const vista = render(
    <FormularioLogin
      pendiente={false}
      fallo={null}
      onEnviar={onEnviar}
      {...props}
    />,
  );
  const reintentar = (nuevas: Props) =>
    vista.rerender(
      <FormularioLogin
        pendiente={false}
        fallo={null}
        onEnviar={onEnviar}
        {...props}
        {...nuevas}
      />,
    );
  return { onEnviar, reintentar, ...vista };
}

const correo = () => screen.getByLabelText('Correo');
const clave = () => screen.getByLabelText('Contraseña');

describe('FormularioLogin: estructura y atributos', () => {
  it('es un formulario post sin validación del navegador, con título y paso', () => {
    const { container } = montar();
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('novalidate');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Inicia sesión' })).toBe(form);
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('el correo declara tipo y ayudas de teclado y de gestor de contraseñas', () => {
    montar();
    expect(correo()).toHaveAttribute('type', 'email');
    expect(correo()).toHaveAttribute('autocomplete', 'username');
    expect(correo()).toHaveAttribute('inputmode', 'email');
    expect(correo()).toHaveAttribute('autocapitalize', 'none');
    expect(correo()).toHaveAttribute('autocorrect', 'off');
    expect(correo()).toHaveAttribute('spellcheck', 'false');
  });

  it('la contraseña es de tipo password con current-password', () => {
    montar();
    expect(clave()).toHaveAttribute('type', 'password');
    expect(clave()).toHaveAttribute('autocomplete', 'current-password');
  });

  it('rellena el correo inicial y no toma el foco por su cuenta', () => {
    montar({ correoInicial: 'ana@despacho.mx' });
    expect(correo()).toHaveValue('ana@despacho.mx');
    expect(document.body).toHaveFocus();
  });

  it('enfoca el correo al montarse cuando se pide', async () => {
    montar({ enfocarCorreo: true });
    await waitFor(() => expect(correo()).toHaveFocus());
  });

  it('muestra el aviso recibido sobre los campos', () => {
    montar({ aviso: <AvisoAuth>Cerraste sesión.</AvisoAuth> });
    expect(screen.getByRole('status')).toHaveTextContent('Cerraste sesión.');
  });

  it('no muestra alerta ni contadores sin fallo', () => {
    montar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/intento|bloque/i);
  });
});

describe('FormularioLogin: enlace de recuperación', () => {
  it('muestra el enlace que recibe, bajo la contraseña, y nada si no recibe', () => {
    const { unmount } = montar();
    expect(screen.queryByRole('link')).toBeNull();
    unmount();
    montar({ enlaceOlvido: <a href="/recuperar">¿Olvidaste tu contraseña?</a> });
    expect(
      screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }),
    ).toHaveAttribute('href', '/recuperar');
  });
});

describe('FormularioLogin: validación', () => {
  it('un envío inválido no envía nada, muestra ambos mensajes y enfoca el primero', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onEnviar).not.toHaveBeenCalled();
    const mensajeCorreo = await screen.findByText('Escribe un correo válido');
    const mensajeClave = screen.getByText('Escribe tu contraseña');
    expect(correo()).toHaveAttribute('aria-invalid', 'true');
    expect(clave()).toHaveAttribute('aria-invalid', 'true');
    expect(correo()).toHaveAttribute('aria-describedby', mensajeCorreo.id);
    expect(clave()).toHaveAttribute('aria-describedby', mensajeClave.id);
    await waitFor(() => expect(correo()).toHaveFocus());
  });

  it('con solo la contraseña vacía enfoca la contraseña', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.type(correo(), 'ana@despacho.mx');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByText('Escribe tu contraseña'),
    ).toBeInTheDocument();
    expect(onEnviar).not.toHaveBeenCalled();
    await waitFor(() => expect(clave()).toHaveFocus());
  });

  it('envía el correo recortado y la contraseña sin tocar', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.type(correo(), '  ana@despacho.mx ');
    await usuario.type(clave(), ' clave con espacios ');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalledTimes(1));
    expect(onEnviar.mock.calls[0]![0]).toEqual({
      email: 'ana@despacho.mx',
      password: ' clave con espacios ',
    });
  });

  it('Enter en la contraseña envía el formulario', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.type(correo(), 'ana@despacho.mx');
    await usuario.type(clave(), 'secreta{Enter}');
    await waitFor(() => expect(onEnviar).toHaveBeenCalledTimes(1));
  });
});

describe('FormularioLogin: intento en curso', () => {
  it('deshabilita de verdad el envío, anuncia "Entrando…" y marca aria-busy', () => {
    const { container } = montar({ pendiente: true });
    const boton = screen.getByRole('button', { name: 'Entrando…' });
    expect(boton).toBeDisabled();
    expect(container.querySelector('form')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('un segundo envío (Enter) mientras está pendiente no envía nada', async () => {
    const usuario = userEvent.setup();
    const { onEnviar, reintentar } = montar();
    await usuario.type(correo(), 'ana@despacho.mx');
    await usuario.type(clave(), 'secreta');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalledTimes(1));
    reintentar({ pendiente: true });
    await usuario.type(clave(), '{Enter}');
    await usuario.click(screen.getByRole('button', { name: 'Entrando…' }));
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });

  it('en reposo no está ocupado y el botón dice "Entrar"', () => {
    const { container } = montar();
    expect(container.querySelector('form')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});

describe('FormularioLogin: fallos', () => {
  it('un fallo que ya estaba al montarse no mueve el foco ni vacía nada', () => {
    montar({ fallo: CREDENCIALES });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('el título puede bajar a h3 cuando la página ya tiene su h1', () => {
    montar({ titulo: 'h3' });
    expect(
      screen.getByRole('heading', { level: 3, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  async function escribirYFallar(fallo: FalloLogin) {
    const usuario = userEvent.setup();
    const vista = montar();
    await usuario.type(correo(), 'ana@despacho.mx');
    await usuario.type(clave(), 'secreta');
    vista.reintentar({ fallo });
    return vista;
  }

  it('muestra la alerta exacta, vacía la contraseña y la enfoca enlazada a la alerta', async () => {
    await escribirYFallar(CREDENCIALES);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Correo o contraseña incorrectos');
    expect(alerta).toHaveTextContent('Revisa tus datos e inténtalo de nuevo.');
    expect(clave()).toHaveValue('');
    await waitFor(() => expect(clave()).toHaveFocus());
    expect(clave().getAttribute('aria-describedby')).toContain(alerta.id);
    expect(correo()).toHaveValue('ana@despacho.mx');
  });

  it('con fallo de conexión conserva correo y contraseña y enfoca la contraseña', async () => {
    await escribirYFallar(CONEXION);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    expect(correo()).toHaveValue('ana@despacho.mx');
    expect(clave()).toHaveValue('secreta');
    await waitFor(() => expect(clave()).toHaveFocus());
  });

  it('el fallo sin empresas también vacía la contraseña y conserva el correo', async () => {
    await escribirYFallar({
      titulo: 'Tu usuario no tiene empresas asignadas.',
      detalle: 'Contacta a un administrador.',
      tipo: 'sin_empresas',
    });
    expect(clave()).toHaveValue('');
    expect(correo()).toHaveValue('ana@despacho.mx');
  });

  it('la alerta desaparece al reintentar y la descripción de la contraseña se retira', async () => {
    const { reintentar } = await escribirYFallar(CREDENCIALES);
    reintentar({ fallo: null, pendiente: true });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(clave()).not.toHaveAttribute('aria-describedby');
  });

  it('un segundo fallo igual vuelve a vaciar la contraseña y a enfocarla', async () => {
    const usuario = userEvent.setup();
    const { reintentar } = await escribirYFallar(CREDENCIALES);
    reintentar({ fallo: null, pendiente: true });
    reintentar({ fallo: null, pendiente: false });
    await usuario.type(clave(), 'otra');
    correo().focus();
    reintentar({ fallo: CREDENCIALES });
    expect(clave()).toHaveValue('');
    await waitFor(() => expect(clave()).toHaveFocus());
  });
});

describe('FormularioLogin: mostrar y ocultar la contraseña', () => {
  it('empieza oculta y alterna con el botón sin perder el valor', async () => {
    const usuario = userEvent.setup();
    montar();
    expect(clave()).toHaveAttribute('type', 'password');
    await usuario.type(clave(), 'Cuadra-2026');
    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    expect(clave()).toHaveAttribute('type', 'text');
    expect(clave()).toHaveValue('Cuadra-2026');
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    );
    expect(clave()).toHaveAttribute('type', 'password');
  });

  it('el botón no envía el formulario y el envío usa lo escrito', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.type(correo(), 'ana@despacho.mx');
    await usuario.type(clave(), 'Cuadra-2026');
    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    expect(onEnviar).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(onEnviar).toHaveBeenCalledWith({
        email: 'ana@despacho.mx',
        password: 'Cuadra-2026',
      }),
    );
  });
});
