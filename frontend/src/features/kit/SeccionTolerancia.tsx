import type { ReactNode } from 'react';
import { AvisoSoloAdmin } from '@/features/tolerancia/components/AvisoSoloAdmin';
import {
  FormularioTolerancia,
  type FormularioToleranciaProps,
} from '@/features/tolerancia/components/FormularioTolerancia';
import {
  TarjetaCambios,
  type EstadoCambios,
  type FilaCambio,
} from '@/features/tolerancia/components/TarjetaCambios';
import {
  TarjetaValor,
  type EstadoValor,
} from '@/features/tolerancia/components/TarjetaValor';
import estilos from './KitPage.module.css';

// La pantalla de tolerancia con datos estáticos: sin API, sin consultas, sin
// sesión y sin estado de servidor. Cada `vista` de la maqueta aprobada
// (Tolerancia.dc.html, v31) se ve aquí con las mismas piezas que usa el
// contenedor. Los montos son cadenas ya formateadas: no pasan por ningún tipo
// numérico. `invalido` se abre en sus cuatro motivos y los roles que no
// administran se resumen en un solo bloque (contador y revisor ven lo mismo).

const SIN_ACCION = () => {};

const FILAS_BASE: readonly FilaCambio[] = [
  {
    id: 'kit-1',
    antes: '$0.005',
    despues: '$0.50',
    quien: 'Ana Mendoza',
    fecha: '2026-09-02 11:40',
    reciente: true,
  },
  {
    id: 'kit-2',
    antes: '$0.00',
    despues: '$0.005',
    quien: 'Ana Mendoza',
    fecha: '2026-08-28 09:12',
    reciente: false,
  },
  {
    id: 'kit-3',
    antes: '$1.00',
    despues: '$0.00',
    quien: 'Ana Mendoza',
    fecha: '2026-08-20 17:05',
    reciente: false,
  },
  {
    id: 'kit-4',
    antes: '$2.50',
    despues: '$1.00',
    quien: '—',
    fecha: '2026-08-11 13:22',
    reciente: false,
  },
  {
    id: 'kit-5',
    antes: '$0.00',
    despues: '$2.50',
    quien: 'Margarita de la Concepción Villaseñor Echeverría',
    fecha: '2026-08-01 10:00',
    reciente: false,
  },
];

/** Tras guardar 0.75 el cambio nuevo va primero y el más viejo sale de la lista. */
const FILAS_TRAS_GUARDAR: readonly FilaCambio[] = [
  {
    id: 'kit-0',
    antes: '$0.50',
    despues: '$0.75',
    quien: 'Ana Mendoza',
    fecha: '2026-10-07 16:30',
    reciente: true,
  },
  ...FILAS_BASE.slice(0, 4).map((fila) => ({ ...fila, reciente: false })),
];

const CAMBIOS_LISTA: EstadoCambios = { tipo: 'lista', filas: FILAS_BASE };
const CAMBIOS_CARGANDO: EstadoCambios = { tipo: 'cargando' };
const VALOR_ACTUAL: EstadoValor = { tipo: 'listo', valor: '0.5000' };

type PropsFormulario = Omit<
  FormularioToleranciaProps,
  'onCambiar' | 'onGuardar'
>;

/** El formulario con los valores de la maqueta; cada vista cambia lo suyo. */
function Formulario(cambios: Partial<PropsFormulario>) {
  return (
    <FormularioTolerancia
      texto="0.75"
      ayuda="normal"
      invalido={null}
      puedeGuardar
      guardando={false}
      exito={false}
      fallo={null}
      {...cambios}
      onCambiar={SIN_ACCION}
      onGuardar={SIN_ACCION}
    />
  );
}

interface PantallaKitProps {
  valor?: EstadoValor;
  cambios?: EstadoCambios;
  /** Lo que va dentro de la tarjeta del valor: el formulario o el aviso. */
  contenido?: ReactNode;
}

/** Las dos tarjetas de la pantalla, en la misma rejilla que el contenedor. */
function Pantalla({
  valor = VALOR_ACTUAL,
  cambios = CAMBIOS_LISTA,
  contenido = <Formulario />,
}: PantallaKitProps) {
  return (
    <div className={estilos.parejaTolerancia}>
      <TarjetaValor estado={valor} onReintentar={SIN_ACCION}>
        {contenido}
      </TarjetaValor>
      <TarjetaCambios estado={cambios} onReintentar={SIN_ACCION} />
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={estilos.columnaAncha}>
      <h3 className={estilos.encabezadoTarjeta}>{titulo}</h3>
      {children}
    </div>
  );
}

/**
 * Sección «Tolerancia» de la galería: cada vista de la maqueta v31 con datos
 * estáticos, la lista de cambios en todos sus estados y el aviso de los roles
 * que solo consultan.
 */
export function SeccionTolerancia() {
  return (
    <>
      <Bloque titulo="Vista: normal">
        <Pantalla />
      </Bloque>
      <Bloque titulo="Vista: cargando">
        <Pantalla valor={{ tipo: 'cargando' }} cambios={CAMBIOS_CARGANDO} />
      </Bloque>
      <Bloque titulo="Vista: error_lectura">
        <Pantalla valor={{ tipo: 'error', clase: 'conexion' }} />
      </Bloque>
      <Bloque titulo="Vista: error_lectura_permiso">
        <Pantalla valor={{ tipo: 'error', clase: 'sin_permiso' }} />
      </Bloque>
      <Bloque titulo="Vista: error_lectura_otro">
        <Pantalla valor={{ tipo: 'error', clase: 'otro' }} />
      </Bloque>
      <Bloque titulo="Vista: sin_cambios">
        <Pantalla
          contenido={
            <Formulario texto="0.50" ayuda="mismo_valor" puedeGuardar={false} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: invalido_vacio">
        <Pantalla
          contenido={
            <Formulario texto="" invalido="vacio" puedeGuardar={false} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: invalido_formato">
        <Pantalla
          contenido={
            <Formulario texto="0,5" invalido="formato" puedeGuardar={false} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: invalido_rango">
        <Pantalla
          contenido={
            <Formulario texto="100.5" invalido="rango" puedeGuardar={false} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: invalido_decimales">
        <Pantalla
          contenido={
            <Formulario
              texto="0.12345"
              invalido="decimales"
              puedeGuardar={false}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: guardando">
        <Pantalla contenido={<Formulario guardando puedeGuardar={false} />} />
      </Bloque>
      <Bloque titulo="Vista: guardado">
        <Pantalla
          valor={{ tipo: 'listo', valor: '0.7500' }}
          cambios={{ tipo: 'lista', filas: FILAS_TRAS_GUARDAR }}
          contenido={<Formulario exito puedeGuardar={false} />}
        />
      </Bloque>
      <Bloque titulo="Vista: error_400">
        <Pantalla contenido={<Formulario fallo="rechazo" />} />
      </Bloque>
      <Bloque titulo="Vista: error_403">
        <Pantalla contenido={<Formulario fallo="sin_permiso" />} />
      </Bloque>
      <Bloque titulo="Vista: error_conexion">
        <Pantalla contenido={<Formulario fallo="conexion" />} />
      </Bloque>
      <Bloque titulo="Vista: error_otro">
        <Pantalla contenido={<Formulario fallo="otro" />} />
      </Bloque>
      <Bloque titulo="Vista: cambios_vacio">
        <Pantalla cambios={{ tipo: 'vacio' }} />
      </Bloque>
      <Bloque titulo="Vista: cambios_error">
        <Pantalla cambios={{ tipo: 'error', clase: 'conexion' }} />
      </Bloque>
      <Bloque titulo="Vista: rol_contador_revisor">
        <Pantalla contenido={<AvisoSoloAdmin />} />
      </Bloque>
    </>
  );
}
