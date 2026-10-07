import type { ReactNode } from 'react';
import { AlertaSubida } from '@/features/cargas/components/AlertaSubida';
import { AvisoRevisor } from '@/features/cargas/components/AvisoRevisor';
import type { FilaHistorial } from '@/features/cargas/components/FilaCarga';
import { HistorialCargas } from '@/features/cargas/components/HistorialCargas';
import { ListaArchivos } from '@/features/cargas/components/ListaArchivos';
import {
  PanelCarga,
  type EntradaResultado,
} from '@/features/cargas/components/PanelCarga';
import { TarjetaCfdi } from '@/features/cargas/components/TarjetaCfdi';
import { TarjetaEstadoCuenta } from '@/features/cargas/components/TarjetaEstadoCuenta';
import {
  RECHAZO_CFDI,
  YA_EXISTIA_EN_COLA,
  YA_EXISTIA_TERMINADA,
} from '@/features/cargas/textos';
import { TIPO_CFDI, TIPO_ESTADO_CUENTA } from '@/shared/dominio';
import estilos from './KitPage.module.css';

// La pantalla de cargas con datos estáticos: sin API, sin consultas y sin
// estado de servidor. Cada `vista` de la maqueta aprobada (Cargas.dc.html,
// v25) se ve aquí con las mismas piezas que usa el contenedor. Falta
// `arrastrando`: es el estado interno de la zona de soltar y solo lo produce
// un arrastre real, no un valor de entrada.

const SIN_ACCION = () => {};
const KB = 1024;
const MB = 1024 * 1024;

/** Un archivo de ejemplo con el peso que se diga, sin cargar contenido. */
function archivo(nombre: string, bytes: number): File {
  const f = new File([], nombre);
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

const XML_LISTOS = [
  archivo('factura-A-1044.xml', 14 * KB),
  archivo('factura-A-1045.xml', 12 * KB),
];
const XML_CON_RECHAZADOS = [
  ...XML_LISTOS,
  archivo('conciliar.py', 3 * KB),
  archivo('respaldo-facturas.xml', Math.round(3.4 * MB)),
];
const CSV_LISTO = archivo('estado-sep-2026.csv', 186 * KB);
const CSV_RECHAZADO = archivo('movimientos.py', 5 * KB);
const PERFILES = [{ id: 'banco-norte' }, { id: 'banco-sur' }, { id: 'cuadra' }];

const HISTORIAL: readonly FilaHistorial[] = [
  {
    id: 'kit-1',
    tipo: TIPO_CFDI,
    nombreArchivo: '48 archivos: factura-A-1044.xml, factura-A-1045.xml, …',
    estado: 'procesando',
    registrosOk: 0,
    registrosError: 0,
    subidoPor: 'Luis Reyes',
    createdAt: '2026-10-06T09:14:00.000Z',
  },
  {
    id: 'kit-2',
    tipo: TIPO_ESTADO_CUENTA,
    nombreArchivo: 'estado-ago-2026.csv',
    estado: 'procesada',
    registrosOk: 212,
    registrosError: 0,
    subidoPor: 'Ana Mendoza',
    createdAt: '2026-10-05T17:42:00.000Z',
  },
  {
    id: 'kit-3',
    tipo: TIPO_CFDI,
    nombreArchivo: '35 archivos: factura-A-1031.xml, factura-A-1032.xml, …',
    estado: 'con_errores',
    registrosOk: 33,
    registrosError: 2,
    subidoPor: 'Luis Reyes',
    createdAt: '2026-10-05T11:08:00.000Z',
  },
  {
    id: 'kit-4',
    tipo: TIPO_CFDI,
    nombreArchivo: '12 archivos: factura-B-0207.xml, factura-B-0208.xml, …',
    estado: 'pendiente',
    registrosOk: 0,
    registrosError: 0,
    subidoPor: 'Jorge Tapia',
    createdAt: '2026-10-06T09:21:00.000Z',
  },
  {
    id: 'kit-5',
    tipo: TIPO_ESTADO_CUENTA,
    nombreArchivo: 'estado-jul-2026.csv',
    estado: 'fallida',
    registrosOk: 0,
    registrosError: 0,
    subidoPor: 'Ana Mendoza',
    createdAt: '2026-10-03T16:30:00.000Z',
  },
];

const RESULTADOS_CFDI: readonly EntradaResultado[] = [
  { archivo: 'factura-A-1044.xml', resultado: 'nuevo' },
  { archivo: 'factura-A-1045.xml', resultado: 'nuevo' },
  { archivo: 'factura-A-1031.xml', resultado: 'ya_existia' },
  {
    archivo: 'factura-B-0207.xml',
    resultado: 'error',
    motivo: 'El XML no es un CFDI 4.0 válido: falta el atributo Version.',
  },
];

const FILAS_CON_ERROR: readonly EntradaResultado[] = [
  {
    fila: 14,
    resultado: 'error',
    motivo: 'la fecha no tiene el formato AAAA-MM-DD.',
  },
  {
    fila: 87,
    resultado: 'error',
    motivo: 'el monto no es un número válido.',
  },
];

const SIN_CONTEO = { ok: 0, existentes: 0, error: 0 } as const;

interface CfdiKitProps {
  archivos?: readonly File[];
  deshabilitada?: boolean;
  subiendo?: boolean;
  resultado?: ReactNode;
  alerta?: ReactNode;
}

/** La tarjeta de CFDI con los valores de la maqueta; cada vista cambia lo suyo. */
function Cfdi({
  archivos = XML_CON_RECHAZADOS,
  deshabilitada = false,
  subiendo = false,
  resultado,
  alerta,
}: CfdiKitProps) {
  return (
    <TarjetaCfdi
      archivos={archivos}
      deshabilitada={deshabilitada}
      subiendo={subiendo}
      resultado={resultado}
      alerta={alerta}
      onSeleccionar={SIN_ACCION}
      onSubir={SIN_ACCION}
    />
  );
}

interface CsvKitProps {
  archivo?: File | null;
  cuenta?: string;
  perfilesFallo?: boolean;
  deshabilitada?: boolean;
  resultado?: ReactNode;
  alerta?: ReactNode;
}

/** La tarjeta de estado de cuenta con los valores de la maqueta. */
function Csv({
  archivo: elegido = CSV_RECHAZADO,
  cuenta = '',
  perfilesFallo = false,
  deshabilitada = false,
  resultado,
  alerta,
}: CsvKitProps) {
  return (
    <TarjetaEstadoCuenta
      archivo={elegido}
      banco="Banco del Norte"
      cuenta={cuenta}
      perfiles={perfilesFallo ? undefined : PERFILES}
      perfilesFallo={perfilesFallo}
      perfil={perfilesFallo ? null : 'banco-norte'}
      deshabilitada={deshabilitada}
      subiendo={false}
      resultado={resultado}
      alerta={alerta}
      onSeleccionar={SIN_ACCION}
      onBanco={SIN_ACCION}
      onCuenta={SIN_ACCION}
      onPerfil={SIN_ACCION}
      onReintentarPerfiles={SIN_ACCION}
      onSubir={SIN_ACCION}
    />
  );
}

function Pareja({ children }: { children: ReactNode }) {
  return <div className={estilos.parejaCargas}>{children}</div>;
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={estilos.columnaAncha}>
      <h3 className={estilos.encabezadoTarjeta}>{titulo}</h3>
      {children}
    </div>
  );
}

function Historial({
  vista,
  actualizacion = null,
}: {
  vista: 'cargando' | 'vacio' | 'tabla' | 'fallo' | 'sin_permiso';
  actualizacion?: 'actualizando' | 'detenida' | null;
}) {
  return (
    <HistorialCargas
      vista={vista}
      cargas={vista === 'tabla' ? HISTORIAL : []}
      onReintentar={SIN_ACCION}
      actualizacion={actualizacion}
      onActualizar={SIN_ACCION}
    />
  );
}

/**
 * Sección «Cargas» de la galería: cada estado de la pantalla (las vistas de la
 * maqueta v25 que se fijan con datos estáticos) y el historial sin permiso.
 */
export function SeccionCargas() {
  return (
    <>
      <Bloque titulo="Vista: normal">
        <Pareja>
          <Cfdi />
          <Csv />
        </Pareja>
        <Historial vista="tabla" actualizacion="actualizando" />
      </Bloque>
      <Bloque titulo="Vista: cargando">
        <Historial vista="cargando" />
      </Bloque>
      <Bloque titulo="Vista: vacio">
        <Historial vista="vacio" />
      </Bloque>
      <Bloque titulo="Vista: error">
        <Historial vista="fallo" />
      </Bloque>
      <Bloque titulo="Vista: revisor">
        <AvisoRevisor />
        <Pareja>
          <Cfdi archivos={XML_LISTOS} deshabilitada />
          <Csv archivo={CSV_LISTO} deshabilitada />
        </Pareja>
      </Bloque>
      <Bloque titulo="Vista: subiendo">
        <Pareja>
          <Cfdi archivos={XML_LISTOS} subiendo />
          <Csv archivo={CSV_LISTO} />
        </Pareja>
      </Bloque>
      <Bloque titulo="Vista: resultado_cfdi">
        <Cfdi
          archivos={[]}
          resultado={
            <PanelCarga
              vista="por_archivo"
              frasesYaExistia={null}
              conteo={{ ok: 2, existentes: 1, error: 1 }}
              resultados={RESULTADOS_CFDI}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: resultado_csv">
        <Csv
          archivo={null}
          resultado={
            <PanelCarga
              vista="por_fila"
              frasesYaExistia={null}
              conteo={{ ok: 210, existentes: 0, error: 2 }}
              resultados={FILAS_CON_ERROR}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: ya_existia">
        <Pareja>
          <Cfdi
            archivos={[]}
            resultado={
              <PanelCarga
                vista="por_archivo"
                frasesYaExistia={YA_EXISTIA_TERMINADA}
                conteo={{ ok: 2, existentes: 1, error: 1 }}
                resultados={RESULTADOS_CFDI}
              />
            }
          />
          <Cfdi
            archivos={[]}
            resultado={
              <PanelCarga
                vista="en_curso"
                frasesYaExistia={YA_EXISTIA_EN_COLA}
                conteo={SIN_CONTEO}
                resultados={[]}
              />
            }
          />
        </Pareja>
      </Bloque>
      <Bloque titulo="Vista: error_400">
        <Csv
          archivo={CSV_LISTO}
          alerta={
            <AlertaSubida
              fallo={{
                clase: 'rechazo',
                detalle:
                  'El encabezado del CSV no coincide con el perfil banco-norte.',
              }}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: error_413">
        <Cfdi
          archivos={XML_LISTOS}
          alerta={<AlertaSubida fallo={{ clase: 'demasiado_grande' }} />}
        />
      </Bloque>
      <Bloque titulo="Vista: sin_actualizar">
        <Historial vista="tabla" actualizacion="detenida" />
      </Bloque>
      <Bloque titulo="Vista: cuenta_completa">
        <Csv archivo={CSV_LISTO} cuenta="012345678901234567" />
      </Bloque>
      <Bloque titulo="Vista: sin_seleccion">
        <Pareja>
          <Cfdi archivos={[]} />
          <Csv archivo={null} />
        </Pareja>
      </Bloque>
      <Bloque titulo="Vista: procesando_resultado">
        <Cfdi
          archivos={[]}
          resultado={
            <PanelCarga
              vista="en_curso"
              frasesYaExistia={null}
              conteo={SIN_CONTEO}
              resultados={[]}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: resultado_fallida">
        <Cfdi
          archivos={[]}
          resultado={
            <PanelCarga
              vista="sin_proceso"
              frasesYaExistia={null}
              conteo={SIN_CONTEO}
              resultados={[]}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: resultado_sin_actualizar">
        <Cfdi
          archivos={[]}
          resultado={
            <PanelCarga
              vista="en_curso"
              frasesYaExistia={null}
              conteo={SIN_CONTEO}
              resultados={[]}
              alActualizar={SIN_ACCION}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: error_subida">
        <Cfdi
          archivos={XML_LISTOS}
          alerta={
            <AlertaSubida
              fallo={{ clase: 'conexion' }}
              onReintentar={SIN_ACCION}
            />
          }
        />
      </Bloque>
      <Bloque titulo="Vista: sin_permiso_subida">
        <Cfdi
          archivos={XML_LISTOS}
          alerta={<AlertaSubida fallo={{ clase: 'sin_permiso' }} />}
        />
      </Bloque>
      <Bloque titulo="Vista: error_otro">
        <Cfdi
          archivos={XML_LISTOS}
          alerta={<AlertaSubida fallo={{ clase: 'otro' }} />}
        />
      </Bloque>
      <Bloque titulo="Vista: perfiles_error">
        <Csv archivo={CSV_LISTO} perfilesFallo />
      </Bloque>
      <Bloque titulo="Vista: limites">
        {/* Con una selección real habría 500 filas aceptadas; aquí solo los dos avisos del lote. */}
        <ListaArchivos
          archivos={[
            { archivo: { name: 'lote-501.xml', size: 0 }, motivo: 'cantidad' },
            { archivo: { name: 'lote-502.xml', size: 1 }, motivo: 'total' },
          ]}
          motivos={RECHAZO_CFDI}
          rotulo="Archivos elegidos"
        />
      </Bloque>
      <Bloque titulo="Historial: sin permiso">
        <Historial vista="sin_permiso" />
      </Bloque>
    </>
  );
}
