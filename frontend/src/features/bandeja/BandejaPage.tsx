import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { mensajeDeError } from '@/shared/api';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { EstadoVacio } from './components/EstadoVacio';
import { ErrorBandeja } from './components/ErrorBandeja';
import { FiltrosEstado } from './components/FiltrosEstado';
import { KpiBandeja } from './components/KpiBandeja';
import { Paginacion } from './components/Paginacion';
import { TablaBandeja } from './components/TablaBandeja';
import { LIMITE_PAGINA } from './constantes';
import {
  alternarEstado,
  leerFiltros,
  paginaMaxima,
  serializar,
} from './filtrosUrl';
import { ERROR_CONEXION, detallePorTipo } from './textos';
import { useBandeja } from './useBandeja';
import { useResumenBandeja } from './useResumenBandeja';
import estilos from './BandejaPage.module.css';

/**
 * Pantalla de la bandeja de revisión (contenedor). Los filtros y la página
 * viven en la URL: aquí se leen con tolerancia, se normalizan con `replace` y
 * se escriben en forma canónica. Es de solo lectura: solo hace GET y nunca
 * decide ni cierra un caso. El título y el subtítulo los pone el encabezado
 * del shell desde el `handle` de la ruta.
 */
export function BandejaPage() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const canonica = serializar(filtros);
  const resultados = useRef<HTMLDivElement>(null);

  // Una URL no canónica (valor inválido, clave ajena, página 1 explícita) se
  // reescribe sin crear historial. La consulta ya usa los valores leídos.
  const actual = params.toString();
  useEffect(() => {
    if (canonica !== actual) setParams(canonica, { replace: true });
  }, [canonica, actual, setParams]);

  const lista = useBandeja(filtros);
  const resumen = useResumenBandeja();
  const { data } = lista;

  // Página que ya no existe (enlace viejo o datos que se redujeron): se pasa a
  // la última válida sin historial, y mientras tanto no se muestra el vacío.
  const ultima = data ? paginaMaxima(data.total, LIMITE_PAGINA) : 1;
  const fueraDeRango =
    data !== undefined && !lista.isPlaceholderData && filtros.pagina > ultima;
  useEffect(() => {
    if (fueraDeRango) {
      setParams(serializar({ ...filtros, pagina: ultima }), { replace: true });
    }
  }, [fueraDeRango, filtros, ultima, setParams]);

  function alternar(estado: EstadoBandeja) {
    const siguiente = alternarEstado(filtros, estado);
    if (siguiente) setParams(serializar(siguiente), { replace: true });
  }

  function irAPagina(pagina: number) {
    setParams(serializar({ ...filtros, pagina }));
    resultados.current?.focus();
  }

  function restablecer() {
    setParams('', { replace: true });
  }

  const porDefecto = serializar({ ...filtros, pagina: 1 }) === '';
  const esqueleto =
    lista.isPending ||
    fueraDeRango ||
    (lista.isPlaceholderData && data?.datos.length === 0);
  const ocupada = esqueleto || lista.isPlaceholderData;

  return (
    <div className={estilos.pagina}>
      <KpiBandeja
        estado={resumen.isError ? 'error' : resumen.data ? 'listo' : 'cargando'}
        conteos={resumen.data?.conteos}
        montoPorRevisar={resumen.data?.montoPorRevisar}
        onReintentar={() => void resumen.refetch()}
      />
      <section className={estilos.tarjeta}>
        <FiltrosEstado estados={filtros.estados} onAlternar={alternar} />
        <div
          ref={resultados}
          tabIndex={-1}
          aria-busy={ocupada}
          className={estilos.resultados}
        >
          {lista.isError ? (
            <Fallo
              error={lista.error}
              onReintentar={() => void lista.refetch()}
            />
          ) : esqueleto ? (
            <TablaBandeja filas={[]} cargando />
          ) : data && data.total === 0 ? (
            <EstadoVacio conFiltros={!porDefecto} onRestablecer={restablecer} />
          ) : data ? (
            <>
              <TablaBandeja filas={data.datos} />
              <Paginacion
                pagina={data.pagina}
                total={data.total}
                limite={LIMITE_PAGINA}
                onIr={irAPagina}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Fallo({
  error,
  onReintentar,
}: {
  error: unknown;
  onReintentar: () => void;
}) {
  // Una cancelación no es un fallo: `null` cae al texto genérico de conexión.
  const mensaje = mensajeDeError(error, 'general');
  const titulo = mensaje?.titulo ?? ERROR_CONEXION.titulo;
  const detalle = mensaje
    ? detallePorTipo[mensaje.tipo]
    : ERROR_CONEXION.detalle;
  const sinReintento = mensaje?.tipo === 'sin_permiso';
  return (
    <ErrorBandeja
      titulo={titulo}
      detalle={detalle}
      onReintentar={sinReintento ? undefined : onReintentar}
    />
  );
}
