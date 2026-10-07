import type { ReactNode } from 'react';
import { Paginacion } from '@/shared/ui/Paginacion';
import {
  ErrorBitacora,
  VacioBitacora,
} from '@/features/bitacora/components/EstadosBitacora';
import {
  FiltrosBitacora,
  type EstadoUsuarios,
} from '@/features/bitacora/components/FiltrosBitacora';
import {
  TablaBitacora,
  type EventoTabla,
} from '@/features/bitacora/components/TablaBitacora';
import type { FiltrosBitacora as Filtros } from '@/features/bitacora/filtrosUrl';
import estilos from './KitPage.module.css';

// La pantalla de la bitácora con datos estáticos: sin API, sin consultas, sin
// sesión y sin estado de servidor. Cada `vista` de la maqueta aprobada
// (Bitacora.dc.html) se ve aquí con las mismas piezas que usa el contenedor.
// Los montos viven en `datos` como cadenas decimales, igual que en la API, y
// los formatea `detalleEvento` sin pasar por ningún tipo numérico. Las horas
// se muestran en la zona de la maqueta (Ciudad de México).

const SIN_ACCION = () => {};
const ZONA = 'America/Mexico_City';

const LUIS = { nombre: 'Luis Reyes' };
const JORGE = { nombre: 'Jorge Tapia' };
const ANA = { nombre: 'Ana Mendoza' };

/** Las siete filas de la maqueta, del más nuevo al más antiguo. */
const EVENTOS: readonly EventoTabla[] = [
  {
    id: 'kit-bit-1',
    entidad: 'conciliaciones',
    entidadId: '0192a3f4-8c1e-7b2d-9f10-3e5c41a2d7b8',
    accion: 'confirmar',
    datos: {
      antes: { estado: 'propuesta' },
      despues: { estado: 'confirmada' },
      diferenciaMonto: '0.0000',
    },
    createdAt: '2026-09-18T22:02:00.000Z',
    usuario: LUIS,
  },
  {
    id: 'kit-bit-2',
    entidad: 'companies',
    entidadId: '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
    accion: 'acceso_denegado',
    datos: {
      metodo: 'PUT',
      ruta: '/empresa/tolerancia',
      motivo: 'rol_insuficiente',
      rolesRequeridos: ['admin'],
      rolesDelUsuario: ['revisor'],
    },
    createdAt: '2026-09-18T21:47:00.000Z',
    usuario: JORGE,
  },
  {
    id: 'kit-bit-3',
    entidad: 'conciliaciones',
    entidadId: '0192a3f4-3f9a-7c11-8d02-0c77e04b77d1',
    accion: 'rechazar',
    datos: {
      antes: { estado: 'propuesta' },
      despues: {
        estado: 'rechazada',
        motivo: 'el CFDI corresponde a otra obra',
      },
    },
    createdAt: '2026-09-18T18:30:00.000Z',
    usuario: LUIS,
  },
  {
    id: 'kit-bit-4',
    entidad: 'conciliaciones',
    entidadId: '0192a3f4-b27d-7e10-9a3c-51c0a3f48c1e',
    accion: 'crear',
    datos: {
      despues: { estado: 'propuesta' },
      origen: 'regla',
      diferenciaMonto: '0.5000',
    },
    createdAt: '2026-09-18T15:15:00.000Z',
    usuario: null,
  },
  {
    id: 'kit-bit-5',
    entidad: 'conciliaciones',
    entidadId: '0192a3f4-77d1-7a01-8b55-3f9a0c7712ab',
    accion: 'crear',
    datos: { despues: { estado: 'propuesta' }, origen: 'llm' },
    createdAt: '2026-09-18T00:20:00.000Z',
    usuario: null,
  },
  {
    id: 'kit-bit-6',
    entidad: 'companies',
    entidadId: '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
    accion: 'actualizar',
    datos: { campo: 'tolerancia_monto', antes: '0.0050', despues: '0.5000' },
    createdAt: '2026-09-02T17:40:00.000Z',
    usuario: ANA,
  },
  {
    id: 'kit-bit-7',
    entidad: 'conciliaciones',
    entidadId: '0192a3f4-e04b-7d77-9c20-41a28c1e3f9a',
    accion: 'rechazar',
    datos: {},
    createdAt: '2026-09-01T16:05:00.000Z',
    usuario: ANA,
  },
];

const USUARIOS: EstadoUsuarios = {
  tipo: 'lista',
  usuarios: [
    { id: '0192a3f4-0000-7000-8000-00000000a001', nombre: ANA.nombre },
    { id: '0192a3f4-0000-7000-8000-00000000a002', nombre: LUIS.nombre },
    { id: '0192a3f4-0000-7000-8000-00000000a003', nombre: JORGE.nombre },
  ],
};

const FILTROS_MAQUETA: Filtros = {
  desde: '2026-09-01',
  hasta: '2026-09-30',
  pagina: 1,
};

interface PantallaKitProps {
  filtros?: Filtros;
  usuarios?: EstadoUsuarios;
  /** Lo que va dentro de la tarjeta de eventos. */
  contenido?: ReactNode;
}

/** Los filtros y la tarjeta de eventos, como los dispone la pantalla. */
function Pantalla({
  filtros = FILTROS_MAQUETA,
  usuarios = USUARIOS,
  contenido = (
    <>
      <TablaBitacora eventos={EVENTOS} zona={ZONA} />
      <Paginacion pagina={1} total={312} limite={50} onIr={SIN_ACCION} />
    </>
  ),
}: PantallaKitProps) {
  return (
    <div className={estilos.columnaAncha}>
      <FiltrosBitacora
        filtros={filtros}
        usuarios={usuarios}
        onCambiar={SIN_ACCION}
      />
      <div className={estilos.tarjetaBitacora}>{contenido}</div>
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

/** Las nueve vistas de la maqueta de la bitácora. */
export function SeccionBitacora() {
  return (
    <div className={estilos.columnaAncha}>
      <Bloque titulo="Vista: normal">
        <Pantalla />
      </Bloque>
      <Bloque titulo="Vista: cargando">
        <Pantalla contenido={<TablaBitacora eventos={[]} cargando />} />
      </Bloque>
      <Bloque titulo="Vista: vacio">
        <Pantalla
          filtros={{ pagina: 1 }}
          contenido={
            <VacioBitacora conFiltros={false} onRestablecer={SIN_ACCION} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: vacio_filtros">
        <Pantalla
          contenido={<VacioBitacora conFiltros onRestablecer={SIN_ACCION} />}
        />
      </Bloque>
      <Bloque titulo="Vista: rango_invalido">
        <Pantalla
          filtros={{ desde: '2026-10-05', hasta: '2026-09-30', pagina: 1 }}
          contenido={null}
        />
      </Bloque>
      <Bloque titulo="Vista: error_conexion">
        <Pantalla
          contenido={
            <ErrorBitacora clase="conexion" onReintentar={SIN_ACCION} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: error_permiso">
        <Pantalla
          contenido={
            <ErrorBitacora clase="sin_permiso" onReintentar={SIN_ACCION} />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: error_otro">
        <Pantalla
          contenido={<ErrorBitacora clase="otro" onReintentar={SIN_ACCION} />}
        />
      </Bloque>
      <Bloque titulo="Vista: usuarios_error">
        <Pantalla usuarios={{ tipo: 'error' }} />
      </Bloque>
    </div>
  );
}
