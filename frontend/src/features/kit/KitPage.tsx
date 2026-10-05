import type { ReactNode } from 'react';
import { AvisoAuth } from '@/features/auth/components/AvisoAuth';
import { FormularioLogin } from '@/features/auth/components/FormularioLogin';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import {
  ListaEmpresas,
  type EmpresaElegible,
} from '@/features/auth/components/ListaEmpresas';
import { PasoEmpresa } from '@/features/auth/components/PasoEmpresa';
import { AVISOS } from '@/features/auth/components/textos';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import { Card } from '@/shared/ui/Card';
import { EstadoChip, TONOS_ESTADO_CHIP } from '@/shared/ui/EstadoChip';
import { Monto } from '@/shared/ui/Monto';
import { Td, Th, Tabla } from '@/shared/ui/Tabla';
import { SeccionBandeja } from './SeccionBandeja';
import estilos from './KitPage.module.css';

/** Empresas de ejemplo del paso 2 del acceso (una con dos roles). */
const EMPRESAS_EJEMPLO: EmpresaElegible[] = [
  {
    id: 'kit-a',
    razonSocial: 'Ferretería del Bajío',
    rfc: 'FDB190215QK4',
    roles: ['contador', 'admin'],
  },
  {
    id: 'kit-b',
    razonSocial: 'Transportes Cuautla',
    rfc: 'TCU170830R52',
    roles: ['revisor'],
  },
  {
    id: 'kit-c',
    razonSocial: 'Abarrotes y Distribuciones del Norte de la Sierra Madre',
    rfc: 'ADN200310AB1',
    roles: ['admin'],
  },
];

const ETIQUETAS_TONO: Record<(typeof TONOS_ESTADO_CHIP)[number], string> = {
  sugerencia: 'Sugerencia',
  sin_match: 'Sin match',
  conciliado: 'Conciliado',
  neutral: 'Neutral',
  ia: 'Sugerida por IA',
  peligro: 'Rechazado',
};

/** Movimientos de ejemplo: normal, grande, negativo e inválido. */
const MOVIMIENTOS = [
  {
    id: 'm1',
    fecha: '2026-09-28',
    concepto: 'Depósito SPEI Ferretería Industrial',
    monto: '18450.00',
    tono: 'sugerencia',
  },
  {
    id: 'm2',
    fecha: '2026-09-27',
    concepto: 'Pago a proveedor de acero',
    monto: '-1234567890123.45',
    tono: 'sin_match',
  },
  {
    id: 'm3',
    fecha: '2026-09-26',
    concepto: 'Liquidación de contrato marco',
    monto: '12345678901234567890.12',
    tono: 'conciliado',
  },
  {
    id: 'm4',
    fecha: '2026-09-25',
    concepto: 'Movimiento con monto ilegible',
    monto: 'abc',
    tono: 'neutral',
  },
  {
    id: 'm5',
    fecha: '2026-09-24',
    concepto: 'Pago de proveedor en dólares',
    monto: '2150.00',
    codigoMoneda: 'USD',
    tono: 'sugerencia',
  },
] as const;

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className={estilos.seccion} aria-labelledby={id}>
      <h2 id={id} className={estilos.subtitulo}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export interface KitPageProps {
  /**
   * Muestra del shell ya armada. La arma `app`, porque `features` no
   * importa de `app`; esta página solo la ubica y la rotula.
   */
  muestraShell?: ReactNode;
}

/**
 * Galería de componentes con datos de ejemplo realistas. Es una página
 * normal: un solo `main`, un encabezado por sección y solo tokens de color.
 */
export function KitPage({ muestraShell }: KitPageProps) {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>Galería de componentes</h1>

      <Seccion id="kit-tema" titulo="Tema">
        <p className={estilos.nota}>
          Cambia el tema aquí; toda la página responde de inmediato.
        </p>
        <div className={estilos.control}>
          <ControlTema />
        </div>
      </Seccion>

      <Seccion id="kit-botones" titulo="Botones">
        <div className={estilos.fila}>
          <Button>Acento</Button>
          <Button tono="conciliado">Confirmar conciliación</Button>
          <Button tono="sin_match">Guardar tolerancia</Button>
          <Button variante="secundario">Anterior</Button>
          <Button variante="peligro">Rechazar</Button>
          <Button variante="fantasma">Ver detalle</Button>
        </div>
        <div className={estilos.fila}>
          <Button disabled>Acento</Button>
          <Button tono="conciliado" disabled>
            Confirmar conciliación
          </Button>
          <Button tono="sin_match" disabled>
            Guardar tolerancia
          </Button>
          <Button variante="secundario" disabled>
            Anterior
          </Button>
          <Button variante="peligro" disabled>
            Rechazar
          </Button>
          <Button variante="fantasma" disabled>
            Ver detalle
          </Button>
        </div>
      </Seccion>

      <Seccion id="kit-campos" titulo="Campos y alertas">
        <div className={estilos.columna}>
          <Campo
            etiqueta="Correo"
            type="email"
            defaultValue="tapia@despacho.mx"
          />
          <Campo etiqueta="Contraseña" type="password" placeholder="••••••••" />
          <Campo
            etiqueta="Correo con error"
            type="email"
            defaultValue="tapia@"
            error="Escribe un correo válido"
          />
          <AlertaError
            titulo="Correo o contraseña incorrectos"
            detalle="Revisa tus datos e inténtalo de nuevo."
          />
        </div>
      </Seccion>

      <Seccion id="kit-acceso" titulo="Pantalla de acceso">
        <p className={estilos.nota}>
          Layout con panel de marca y control de tema; bajo 900 px el panel se
          oculta.
        </p>
        <div className={estilos.marcoAcceso}>
          <LayoutAuth como="div" controlTema={<ControlTema />}>
            <div className={estilos.columna}>
              <AvisoAuth>{AVISOS.sesion_expirada}</AvisoAuth>
              <AvisoAuth>{AVISOS.reingreso}</AvisoAuth>
            </div>
          </LayoutAuth>
        </div>
      </Seccion>

      <Seccion id="kit-login" titulo="Formulario de acceso">
        <p className={estilos.nota}>
          Estados del paso 1: con aviso y correo, con credenciales incorrectas,
          sin conexión y enviando.
        </p>
        <div className={estilos.rejilla}>
          <FormularioLogin
            titulo="h3"
            correoInicial="tapia@despacho.mx"
            pendiente={false}
            fallo={null}
            aviso={<AvisoAuth>{AVISOS.reingreso}</AvisoAuth>}
            onEnviar={() => {}}
          />
          <FormularioLogin
            titulo="h3"
            correoInicial="tapia@despacho.mx"
            pendiente={false}
            fallo={{
              titulo: 'Correo o contraseña incorrectos',
              detalle: 'Revisa tus datos e inténtalo de nuevo.',
              tipo: 'credenciales',
            }}
            onEnviar={() => {}}
          />
          <FormularioLogin
            titulo="h3"
            correoInicial="tapia@despacho.mx"
            pendiente={false}
            fallo={{
              titulo: 'No se pudo conectar con el servidor.',
              detalle: 'Inténtalo de nuevo.',
              tipo: 'conexion',
            }}
            onEnviar={() => {}}
          />
          <FormularioLogin
            titulo="h3"
            correoInicial="tapia@despacho.mx"
            pendiente
            fallo={null}
            onEnviar={() => {}}
          />
        </div>
      </Seccion>

      <Seccion id="kit-empresas" titulo="Elección de empresa">
        <p className={estilos.nota}>
          Lista del paso 2: en reposo, con una petición en curso y con una sola
          empresa; después el paso completo en modo de cambio, con un fallo.
        </p>
        <div className={estilos.rejilla}>
          <ListaEmpresas
            empresas={EMPRESAS_EJEMPLO}
            pendienteId={null}
            onElegir={() => {}}
          />
          <ListaEmpresas
            empresas={EMPRESAS_EJEMPLO}
            pendienteId="kit-b"
            onElegir={() => {}}
          />
          <ListaEmpresas
            empresas={EMPRESAS_EJEMPLO.slice(0, 1)}
            pendienteId={null}
            onElegir={() => {}}
          />
          <PasoEmpresa
            titulo="h3"
            saludo="Estás en Ferretería del Bajío. Elige la empresa a la que quieres cambiar."
            empresas={EMPRESAS_EJEMPLO}
            pendienteId={null}
            fallo={{
              titulo: 'Ya no tienes acceso a esta empresa.',
              detalle: 'Elige otra de la lista.',
            }}
            textoVolver="← Volver sin cambiar de empresa"
            onElegir={() => {}}
            onVolver={() => {}}
          />
        </div>
      </Seccion>

      <Seccion id="kit-tarjetas" titulo="Tarjetas">
        <div className={estilos.rejilla}>
          <Card as="article">
            <h3 className={estilos.encabezadoTarjeta}>Superficie base</h3>
            <p className={estilos.nota}>
              Contenido de ejemplo sobre la superficie estándar.
            </p>
          </Card>
          <Card as="article" elevada>
            <h3 className={estilos.encabezadoTarjeta}>Superficie elevada</h3>
            <p className={estilos.nota}>
              Variante usada para los mosaicos de monto.
            </p>
          </Card>
        </div>
      </Seccion>

      <Seccion id="kit-chips" titulo="Chips de estado">
        <ul className={estilos.chips}>
          {TONOS_ESTADO_CHIP.map((tono) => (
            <li key={tono}>
              <EstadoChip tono={tono}>{ETIQUETAS_TONO[tono]}</EstadoChip>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion id="kit-tabla" titulo="Tabla con montos">
        <Tabla titulo="Movimientos de ejemplo">
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Concepto</Th>
              <Th numerica>Monto</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {MOVIMIENTOS.map((m) => (
              <tr key={m.id}>
                <Td>{m.fecha}</Td>
                <Td>{m.concepto}</Td>
                <Td numerica>
                  <Monto
                    valor={m.monto}
                    codigoMoneda={
                      'codigoMoneda' in m ? m.codigoMoneda : undefined
                    }
                  />
                </Td>
                <Td>
                  <EstadoChip tono={m.tono}>
                    {ETIQUETAS_TONO[m.tono]}
                  </EstadoChip>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Seccion>

      <Seccion id="kit-bandeja" titulo="Bandeja">
        <SeccionBandeja />
      </Seccion>

      {muestraShell && (
        <Seccion id="kit-shell" titulo="Piezas del shell">
          <div className={estilos.marco}>{muestraShell}</div>
        </Seccion>
      )}
    </main>
  );
}
