import type { ReactNode } from 'react';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import { Card } from '@/shared/ui/Card';
import { EstadoChip, TONOS_ESTADO_CHIP } from '@/shared/ui/EstadoChip';
import { Monto } from '@/shared/ui/Monto';
import { Td, Th, Tabla } from '@/shared/ui/Tabla';
import estilos from './KitPage.module.css';

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
                  <Monto valor={m.monto} />
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

      {muestraShell && (
        <Seccion id="kit-shell" titulo="Piezas del shell">
          <div className={estilos.marco}>{muestraShell}</div>
        </Seccion>
      )}
    </main>
  );
}
