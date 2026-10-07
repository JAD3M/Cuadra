import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@/shared/tema';
import seccionCargasFuente from '@/features/kit/SeccionCargas.tsx?raw';
import { RutaKit } from './RutaKit';

function renderizar() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/__kit']}>
        <RutaKit />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('RutaKit (galería de componentes)', () => {
  it('muestra el título de la galería', () => {
    renderizar();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Galería de componentes' }),
    ).toBeVisible();
  });

  it('tiene un solo main y el header de la muestra queda dentro de él', () => {
    renderizar();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // Testing Library no aplica el contexto: un header dentro de main no es
    // banner según HTML-AAM, así que basta comprobar que está anidado en él.
    const main = screen.getByRole('main');
    for (const encabezado of screen.queryAllByRole('banner')) {
      expect(main).toContainElement(encabezado);
    }
  });

  it('cada sección tiene su encabezado', () => {
    renderizar();
    const secciones = [
      'Tema',
      'Botones',
      'Campos y alertas',
      'Pantalla de acceso',
      'Formulario de acceso',
      'Elección de empresa',
      'Tarjetas',
      'Chips de estado',
      'Tabla con montos',
      'Bandeja',
      'Caso',
      'Cargas',
      'Piezas del shell',
    ];
    for (const nombre of secciones) {
      expect(
        screen.getByRole('heading', { level: 2, name: nombre }),
      ).toBeInTheDocument();
    }
  });

  it('la galería de acceso no repite el main ni los encabezados de la página', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Pantalla de acceso' });
    expect(within(seccion).queryByRole('main')).not.toBeInTheDocument();
    expect(within(seccion).getAllByRole('status')).toHaveLength(2);
    expect(
      within(seccion).getByText('Cada peso del banco, con su CFDI.'),
    ).toBeInTheDocument();
  });

  it('la galería del formulario de acceso muestra sus estados sin un segundo h1', () => {
    renderizar();
    const seccion = screen.getByRole('region', {
      name: 'Formulario de acceso',
    });
    expect(within(seccion).getAllByRole('form')).toHaveLength(4);
    expect(within(seccion).queryByRole('heading', { level: 1 })).toBeNull();
    expect(within(seccion).getAllByRole('alert')).toHaveLength(2);
    expect(
      within(seccion).getByRole('button', { name: 'Entrando…' }),
    ).toBeDisabled();
    expect(document.body).toHaveFocus();
  });

  it('la galería de empresas muestra la lista en reposo, en curso y con una sola', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Elección de empresa' });
    expect(within(seccion).getAllByRole('list')).toHaveLength(4);
    expect(within(seccion).getAllByRole('button')).toHaveLength(11);
    expect(within(seccion).queryByRole('heading', { level: 1 })).toBeNull();
    expect(within(seccion).getByRole('alert')).toHaveTextContent(
      'Ya no tienes acceso a esta empresa.',
    );
    expect(
      within(seccion).getByRole('button', {
        name: '← Volver sin cambiar de empresa',
      }),
    ).toBeInTheDocument();
    expect(within(seccion).getByText('Entrando…')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('la galería de campos muestra un campo con error y una alerta', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Campos y alertas' });
    expect(within(seccion).getByLabelText('Correo con error')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(within(seccion).getByRole('alert')).toBeInTheDocument();
  });

  it('muestra los botones deshabilitados', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Botones' });
    expect(
      within(seccion)
        .getAllByRole('button')
        .filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(6);
  });

  it('muestra los seis tonos de chip', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Chips de estado' });
    expect(within(seccion).getAllByRole('listitem')).toHaveLength(6);
  });

  it('formatea montos grande, negativo e inválido', () => {
    renderizar();
    const tabla = screen.getByRole('table', { name: 'Movimientos de ejemplo' });
    expect(within(tabla).getByText('$18,450.00')).toBeInTheDocument();
    expect(
      within(tabla).getByText('−$1,234,567,890,123.45'),
    ).toBeInTheDocument();
    expect(
      within(tabla).getByText('$12,345,678,901,234,567,890.12'),
    ).toBeInTheDocument();
    expect(within(tabla).getByText('Monto no disponible')).toBeInTheDocument();
  });

  it('la tabla con montos muestra un monto en otra moneda con su código', () => {
    renderizar();
    const tabla = screen.getByRole('table', { name: 'Movimientos de ejemplo' });
    expect(within(tabla).getByText('$2,150.00 USD')).toBeInTheDocument();
  });

  describe('sección Caso', () => {
    const seccion = () => screen.getByRole('region', { name: 'Caso' });
    const VISTAS = [
      'sugerencia',
      'varias',
      'sin_match',
      'conciliado',
      'cargando',
      'error',
      'no_encontrado',
      'contrato',
      'enviando',
      'conflicto',
      'sin_permiso',
      'rechazo_largo',
      'confirmado',
      'rechazado',
    ] as const;

    /** El bloque de una vista, por el título que lleva en la galería. */
    function vista(nombre: (typeof VISTAS)[number]): HTMLElement {
      const titulo = within(seccion()).getByRole('heading', {
        level: 3,
        name: `Vista: ${nombre}`,
      });
      const bloque = titulo.parentElement;
      if (!(bloque instanceof HTMLElement)) throw new Error('sin bloque');
      return bloque;
    }

    it('muestra cada una de las 14 vistas de la maqueta sin romperse', () => {
      renderizar();
      for (const nombre of VISTAS) {
        expect(vista(nombre)).toBeInTheDocument();
      }
      expect(within(seccion()).queryByRole('heading', { level: 1 })).toBeNull();
    });

    it('sugerencia y varias: propuesta expandida, decisión y, con varias, el aviso y las filas', () => {
      renderizar();
      const una = within(vista('sugerencia'));
      expect(una.getByText('CFDI candidato')).toBeInTheDocument();
      expect(
        una.getByRole('button', { name: 'Confirmar conciliación A-1044' }),
      ).toBeEnabled();
      expect(una.queryByText(/Este movimiento tiene/)).toBeNull();
      const varias = within(vista('varias'));
      expect(
        varias.getByText(
          'Este movimiento tiene 3 propuestas. Al confirmar una, las demás se rechazan.',
        ),
      ).toBeInTheDocument();
      expect(
        varias.getAllByRole('button', { name: /^Ver propuesta/ }),
      ).toHaveLength(2);
    });

    it('sin_match y conciliado: solo lectura, sin controles de decisión', () => {
      renderizar();
      const sinMatch = within(vista('sin_match'));
      expect(
        sinMatch.getByText(
          'El motor no encontró un CFDI seguro para este movimiento.',
        ),
      ).toBeInTheDocument();
      expect(sinMatch.queryByRole('button', { name: /Confirmar/ })).toBeNull();
      const conciliado = within(vista('conciliado'));
      expect(
        conciliado.getByText('Este caso ya está cerrado y no admite cambios.'),
      ).toBeInTheDocument();
      expect(
        conciliado.queryByRole('button', { name: /Confirmar|Rechazar/ }),
      ).toBeNull();
    });

    it('cargando y los errores de lectura traen su copy aprobado', () => {
      renderizar();
      expect(
        vista('cargando').querySelector('[aria-busy="true"]'),
      ).not.toBeNull();
      expect(
        within(vista('error')).getByText(
          'No se pudo conectar con el servidor.',
        ),
      ).toBeInTheDocument();
      const noEncontrado = within(vista('no_encontrado'));
      expect(
        noEncontrado.getByText('No encontramos este caso.'),
      ).toBeInTheDocument();
      expect(
        noEncontrado.getByRole('link', { name: 'Volver a la bandeja' }),
      ).toHaveAttribute('href', '/bandeja');
      expect(
        within(vista('contrato')).getByText('No pudimos mostrar este caso.'),
      ).toBeInTheDocument();
    });

    it('enviando bloquea los controles y anuncia el envío', () => {
      renderizar();
      const enviando = within(vista('enviando'));
      expect(
        enviando.getByRole('button', { name: /Confirmando…/ }),
      ).toBeDisabled();
      expect(enviando.getByText('Enviando tu decisión')).toBeInTheDocument();
    });

    it('conflicto, sin_permiso y rechazo_largo muestran su alerta o su error en la decisión', () => {
      renderizar();
      const conflicto = within(vista('conflicto'));
      expect(conflicto.getByText('Este caso ya cambió.')).toBeInTheDocument();
      expect(
        conflicto.getByRole('button', { name: 'Recargar caso' }),
      ).toBeInTheDocument();
      expect(
        within(vista('sin_permiso')).getByText(
          'No puedes confirmar este caso.',
        ),
      ).toBeInTheDocument();
      const largo = within(vista('rechazo_largo'));
      expect(largo.getByText('512 / 500')).toBeInTheDocument();
      expect(
        largo.getByText('El motivo no puede pasar de 500 caracteres.'),
      ).toBeInTheDocument();
      expect(
        largo.getByLabelText('Motivo del rechazo (opcional)'),
      ).toHaveAttribute('aria-invalid', 'true');
    });

    it('confirmado y rechazado: banner de estado con su nota y sin navegación', () => {
      renderizar();
      const confirmado = within(vista('confirmado'));
      expect(
        confirmado.getByText(
          'Conciliación confirmada. El movimiento y el CFDI quedan cerrados.',
        ),
      ).toBeInTheDocument();
      expect(
        confirmado.getByText(
          'Las demás propuestas de este movimiento se rechazaron.',
        ),
      ).toBeInTheDocument();
      const rechazado = within(vista('rechazado'));
      expect(rechazado.getByText('Propuesta rechazada.')).toBeInTheDocument();
      expect(
        rechazado.getByText('El movimiento vuelve a sin match.'),
      ).toBeInTheDocument();
    });

    it('el historial se ve con eventos, vacío y con error', () => {
      renderizar();
      const bloque = (titulo: string) => {
        const encabezado = within(seccion()).getByRole('heading', {
          level: 3,
          name: titulo,
        });
        return within(encabezado.parentElement as HTMLElement);
      };
      expect(
        bloque('Historial: con eventos').getAllByRole('listitem').length,
      ).toBeGreaterThan(1);
      expect(
        bloque('Historial: vacío').getByText(
          'Aún no hay eventos en el historial.',
        ),
      ).toBeInTheDocument();
      expect(
        bloque('Historial: con error').getByRole('button', {
          name: 'Reintentar',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('sección Bandeja', () => {
    const seccion = () => screen.getByRole('region', { name: 'Bandeja' });

    it('muestra los indicadores cargados, en carga y con fallo', () => {
      renderizar();
      const bandeja = seccion();
      expect(within(bandeja).getByText('$138,990.40')).toBeInTheDocument();
      expect(
        within(bandeja).getAllByText('Monto por revisar').length,
      ).toBeGreaterThanOrEqual(3);
      expect(
        within(bandeja).getAllByRole('button', { name: 'Reintentar' }),
      ).toHaveLength(2);
      expect(
        bandeja.querySelectorAll('[aria-busy="true"]').length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('muestra los filtros por defecto y con el último chip activo', () => {
      renderizar();
      const bandeja = seccion();
      expect(
        within(bandeja).getAllByRole('group', { name: 'Filtrar por estado' }),
      ).toHaveLength(2);
      expect(
        within(bandeja).getByText('Debe quedar al menos un estado activo.'),
      ).toBeInTheDocument();
    });

    it('muestra la tabla con los tres estados, la fila en USD, la diferencia bajo un centavo y las insignias de IA', () => {
      renderizar();
      const tabla = within(seccion()).getByRole('table', {
        name: /Movimientos por revisar/,
      });
      expect(within(tabla).getAllByText('Sugerencia').length).toBeGreaterThan(
        0,
      );
      expect(within(tabla).getAllByText('Sin match').length).toBeGreaterThan(0);
      expect(within(tabla).getAllByText('Conciliado').length).toBeGreaterThan(
        0,
      );
      expect(within(tabla).getByText('$2,150.00 USD')).toBeInTheDocument();
      expect(within(tabla).getByText('menor a un centavo')).toBeInTheDocument();
      expect(within(tabla).getByText('IA')).toBeInTheDocument();
      expect(within(tabla).getByText('IA · simulada')).toBeInTheDocument();
    });

    it('muestra la paginación en la primera página, una intermedia y la última', () => {
      renderizar();
      const paginas = within(seccion()).getAllByRole('navigation', {
        name: 'Paginación',
      });
      expect(paginas).toHaveLength(3);
      expect(
        within(seccion()).getByText('Mostrando 1–20 de 100'),
      ).toBeInTheDocument();
      expect(
        within(seccion()).getByText('Mostrando 41–60 de 100'),
      ).toBeInTheDocument();
      expect(
        within(seccion()).getByText('Mostrando 81–100 de 100'),
      ).toBeInTheDocument();
    });

    it('muestra el vacío con filtros y por defecto, el error y el permiso denegado', () => {
      renderizar();
      const bandeja = seccion();
      expect(
        within(bandeja).getByText('No hay movimientos con estos filtros.'),
      ).toBeInTheDocument();
      expect(
        within(bandeja).getByRole('button', { name: 'Restablecer filtros' }),
      ).toBeInTheDocument();
      expect(
        within(bandeja).getByText('No hay movimientos por revisar.'),
      ).toBeInTheDocument();
      const alertas = within(bandeja).getAllByRole('alert');
      expect(alertas).toHaveLength(2);
      expect(
        within(bandeja).getByText('No se pudo conectar con el servidor.'),
      ).toBeInTheDocument();
      expect(
        within(bandeja).getByText('No tienes permiso para esta acción.'),
      ).toBeInTheDocument();
    });
  });

  describe('sección Cargas', () => {
    const seccion = () => screen.getByRole('region', { name: 'Cargas' });
    // Las 22 vistas de la maqueta v25 que se pueden fijar con datos estáticos.
    // `arrastrando` queda fuera: es el estado interno de la zona de soltar y
    // solo se produce con eventos de arrastre, no con props.
    const VISTAS = [
      'normal',
      'cargando',
      'vacio',
      'error',
      'revisor',
      'subiendo',
      'resultado_cfdi',
      'resultado_csv',
      'ya_existia',
      'error_400',
      'error_413',
      'sin_actualizar',
      'cuenta_completa',
      'sin_seleccion',
      'procesando_resultado',
      'resultado_fallida',
      'resultado_sin_actualizar',
      'error_subida',
      'sin_permiso_subida',
      'error_otro',
      'perfiles_error',
      'limites',
    ] as const;

    /** El bloque de una vista, por el título que lleva en la galería. */
    function vista(nombre: (typeof VISTAS)[number]): HTMLElement {
      const titulo = within(seccion()).getByRole('heading', {
        level: 3,
        name: `Vista: ${nombre}`,
      });
      const bloque = titulo.parentElement;
      if (!(bloque instanceof HTMLElement)) throw new Error('sin bloque');
      return bloque;
    }

    it('muestra cada una de las 22 vistas representables sin romperse', () => {
      renderizar();
      for (const nombre of VISTAS) {
        expect(vista(nombre)).toBeInTheDocument();
      }
      expect(within(seccion()).queryByRole('heading', { level: 1 })).toBeNull();
    });

    it('normal: archivos rechazados en las dos tarjetas y las cinco cargas del historial', () => {
      renderizar();
      const normal = within(vista('normal'));
      expect(
        normal.getByText('Solo se aceptan archivos .xml'),
      ).toBeInTheDocument();
      expect(normal.getByText('El archivo pasa de 2 MB')).toBeInTheDocument();
      expect(
        normal.getByText('Solo se aceptan archivos .csv'),
      ).toBeInTheDocument();
      expect(
        normal.getByText('2 de 4 listos. Los rechazados no se suben.'),
      ).toBeInTheDocument();
      expect(
        normal.getByRole('button', { name: 'Quitar rechazados' }),
      ).toBeEnabled();
      // Cabecera + cinco cargas.
      expect(normal.getAllByRole('row')).toHaveLength(6);
      // La carga fallida muestra «—» en Válidos y en Con error (decisión #187).
      const fallida = normal.getByRole('row', { name: /estado-jul-2026\.csv/ });
      expect(within(fallida).getAllByText('—')).toHaveLength(2);
    });

    it('cargando, vacio y error: lo que sustituye a la tabla', () => {
      renderizar();
      expect(
        within(vista('cargando')).getByText('Cargando cargas'),
      ).toBeInTheDocument();
      expect(within(vista('cargando')).queryByRole('table')).toBeNull();
      expect(
        within(vista('vacio')).getByText('Aún no hay cargas.'),
      ).toBeInTheDocument();
      const error = within(vista('error'));
      expect(error.getByRole('alert')).toBeInTheDocument();
      expect(
        error.getByRole('button', { name: 'Reintentar' }),
      ).toBeInTheDocument();
    });

    it('revisor: el aviso y todo apagado, sin ocultar nada', () => {
      renderizar();
      const revisor = within(vista('revisor'));
      expect(
        revisor.getByText('Tu rol solo permite consultar las cargas.'),
      ).toBeInTheDocument();
      expect(
        revisor.getByRole('button', { name: 'Subir 2 archivos' }),
      ).toBeDisabled();
      expect(
        revisor.getByRole('button', { name: 'Subir estado de cuenta' }),
      ).toBeDisabled();
      expect(revisor.getByLabelText('Cuenta')).toBeDisabled();
    });

    it('subiendo: la tarjeta de CFDI se apaga y la otra sigue disponible', () => {
      renderizar();
      const subiendo = within(vista('subiendo'));
      expect(
        subiendo.getByRole('button', { name: 'Subiendo…' }),
      ).toBeDisabled();
      expect(subiendo.getByText('Subiendo tus archivos')).toBeInTheDocument();
      expect(
        subiendo.getByRole('button', { name: 'Subir estado de cuenta' }),
      ).toBeEnabled();
    });

    it('resultado_cfdi y resultado_csv: resumen y detalle de lo que respondió el servidor', () => {
      renderizar();
      const cfdi = within(vista('resultado_cfdi'));
      expect(
        cfdi.getByRole('region', { name: 'Resultado por archivo' }),
      ).toBeInTheDocument();
      expect(
        cfdi.getByText(
          'El XML no es un CFDI 4.0 válido: falta el atributo Version.',
        ),
      ).toBeInTheDocument();
      const csv = within(vista('resultado_csv'));
      expect(
        csv.getByRole('region', { name: 'Filas con error' }),
      ).toBeInTheDocument();
      expect(
        csv.getByText('Fila 14: la fecha no tiene el formato AAAA-MM-DD.'),
      ).toBeInTheDocument();
      expect(
        csv.getByText('Fila 87: el monto no es un número válido.'),
      ).toBeInTheDocument();
    });

    it('ya_existia: terminada avisa y muestra el resultado; en cola avisa y sigue procesando', () => {
      renderizar();
      const ya = within(vista('ya_existia'));
      expect(ya.getByText('Este archivo ya se había cargado.')).toBeVisible();
      expect(ya.getByText('No se duplicó nada.')).toBeVisible();
      expect(
        ya.getByText(
          'Este archivo ya se había cargado y se volvió a poner en la cola.',
        ),
      ).toBeVisible();
      // Solo la que está en cola muestra la barra de proceso.
      expect(ya.getAllByText('Procesando la carga…')).toHaveLength(1);
      // Mockup v27: la terminada trae debajo el resultado de esa carga.
      expect(
        ya.getAllByRole('region', { name: 'Resultado por archivo' }),
      ).toHaveLength(1);
    });

    it('las alertas de subida usan el texto del mockup', () => {
      renderizar();
      const e400 = within(vista('error_400'));
      expect(e400.getByRole('alert')).toBeInTheDocument();
      expect(e400.getByText('No se pudo procesar la carga.')).toBeVisible();
      expect(
        e400.getByText(
          'El encabezado del CSV no coincide con el perfil banco-norte.',
        ),
      ).toBeVisible();
      expect(
        within(vista('error_413')).getByText('Los archivos pesan demasiado.'),
      ).toBeVisible();
      const conexion = within(vista('error_subida'));
      expect(
        conexion.getByText('No se pudo conectar con el servidor.'),
      ).toBeVisible();
      expect(
        conexion.getByRole('button', { name: 'Reintentar' }),
      ).toBeEnabled();
      expect(
        within(vista('sin_permiso_subida')).getByText(
          'No tienes permiso para esta acción.',
        ),
      ).toBeVisible();
      const otro = within(vista('error_otro'));
      expect(
        otro.getByText('No se pudo completar la solicitud.'),
      ).toBeVisible();
      expect(
        otro.getByText(
          'Tus archivos siguen seleccionados. Inténtalo de nuevo en unos minutos.',
        ),
      ).toBeVisible();
      // El error inesperado no ofrece reintento (mockup v25).
      expect(otro.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('sin_actualizar y resultado_sin_actualizar: el aviso con «Actualizar»', () => {
      renderizar();
      for (const nombre of [
        'sin_actualizar',
        'resultado_sin_actualizar',
      ] as const) {
        const bloque = within(vista(nombre));
        expect(
          bloque.getByText(/La lista dejó de actualizarse\./),
        ).toBeVisible();
        expect(
          bloque.getByRole('button', { name: 'Actualizar' }),
        ).toBeEnabled();
      }
    });

    it('cuenta_completa: avisa sin bloquear y la cuenta solo está en el campo', () => {
      renderizar();
      const cuenta = within(vista('cuenta_completa'));
      expect(
        cuenta.getByText(
          'Parece un número de cuenta completo. Escribe solo los últimos dígitos.',
        ),
      ).toBeVisible();
      expect(cuenta.getByLabelText('Cuenta')).toHaveValue('012345678901234567');
    });

    it('sin_seleccion: nada elegido y los botones de subir apagados', () => {
      renderizar();
      const vacia = within(vista('sin_seleccion'));
      expect(
        vacia.queryByRole('region', { name: 'Archivos elegidos' }),
      ).toBeNull();
      expect(
        vacia.getByRole('button', { name: 'Subir archivos' }),
      ).toBeDisabled();
      expect(
        vacia.getByRole('button', { name: 'Subir estado de cuenta' }),
      ).toBeDisabled();
    });

    it('procesando_resultado y resultado_fallida: la carga en curso y la que falló', () => {
      renderizar();
      expect(
        within(vista('procesando_resultado')).getByText('Procesando la carga…'),
      ).toBeVisible();
      const fallida = within(vista('resultado_fallida'));
      expect(
        fallida.getByText(
          'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
        ),
      ).toBeVisible();
      // Mockup v27: el chip Fallida sobre el aviso; sin mensaje del servidor.
      expect(fallida.getByText('Fallida')).toBeVisible();
    });

    it('perfiles_error: el select apagado con su mensaje y «Reintentar»', () => {
      renderizar();
      const perfiles = within(vista('perfiles_error'));
      expect(
        perfiles.getByText('No se pudieron cargar los perfiles.'),
      ).toBeVisible();
      expect(
        perfiles.getByRole('button', { name: 'Reintentar' }),
      ).toBeEnabled();
      expect(perfiles.getByLabelText('Perfil de lectura')).toBeDisabled();
    });

    it('limites: avisa una sola vez de cada tope del lote', () => {
      renderizar();
      const limites = within(vista('limites'));
      expect(
        limites.getByText(
          'Son más de 500 archivos. Divide la carga en partes más pequeñas.',
        ),
      ).toBeVisible();
      expect(
        limites.getByText(
          'La selección pasa de 50 MB. Divide la carga en partes más pequeñas.',
        ),
      ).toBeVisible();
    });

    it('los componentes se alimentan con datos estáticos: la sección no importa de @/shared/api', () => {
      expect(seccionCargasFuente).not.toMatch(/from\s+['"]@\/shared\/api/);
      expect(seccionCargasFuente).not.toMatch(
        /from\s+['"]@\/features\/cargas\/use/,
      );
    });
  });

  it('el control de tema cambia el tema del documento', async () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Tema' });
    await userEvent.setup().click(within(seccion).getByLabelText(/Claro/));
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.setup().click(within(seccion).getByLabelText(/Oscuro/));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ensambla la barra lateral, el usuario y la insignia de empresa', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Piezas del shell' });
    expect(
      within(seccion).getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('link', { name: /Bandeja/ }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(seccion).getByText('Administrador, Revisor'),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('button', { name: /Cambiar de empresa/ }),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('group', { name: 'Empresa activa' }),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('region', { name: 'Contenido de ejemplo' }),
    ).toBeInTheDocument();
  });

  it('marca Bandeja como activa en la muestra del shell', () => {
    renderizar();
    const nav = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    expect(within(nav).getByRole('link', { name: /Bandeja/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: 'Cargas' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('no monta un router propio: usa el que la rodea', () => {
    // Sin router alrededor, los enlaces de la muestra no pueden renderizar.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ThemeProvider>
          <RutaKit />
        </ThemeProvider>,
      ),
    ).toThrow();
    error.mockRestore();
  });
});
