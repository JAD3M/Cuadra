import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError, mensajeDeError } from '@/shared/api';
import { puede } from '@/shared/dominio';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import type {
  RazonOmisionLote,
  RazonOmisionReapertura,
} from '@/shared/dominio/tipos';
import { useSeparacionDesactivada, useSessionContext } from '@/shared/sesion';
import { AvisoSinSeparacion } from '@/shared/ui/AvisoSinSeparacion';
import { Button } from '@/shared/ui/Button';
import { Paginacion } from '@/shared/ui/Paginacion';
import { paginaMaxima } from '@/shared/ui/paginas';
import { BarraLote } from './components/BarraLote';
import { EstadoVacio } from './components/EstadoVacio';
import { ErrorBandeja } from './components/ErrorBandeja';
import { FiltrosEstado } from './components/FiltrosEstado';
import { KpiBandeja } from './components/KpiBandeja';
import { ReabrirLote } from './components/ReabrirLote';
import { ResultadoLote } from './components/ResultadoLote';
import { ResultadoReapertura } from './components/ResultadoReapertura';
import { TablaBandeja } from './components/TablaBandeja';
import { LIMITE_PAGINA } from './constantes';
import { etiquetaCfdi } from './etiquetaCfdi';
import { alternarEstado, leerFiltros, serializar } from './filtrosUrl';
import { marcables, marcadasIniciales, propuestaDeLote } from './lote';
import {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  LOTE,
  REABRIR_LOTE,
  SIN_DATO,
  detallePorTipo,
} from './textos';
import { useBandeja } from './useBandeja';
import { useConfirmarLote } from './useConfirmarLote';
import { useReabrirLote } from './useReabrirLote';
import { useResumenBandeja } from './useResumenBandeja';
import estilos from './BandejaPage.module.css';

/** Lo que se muestra de un lote ya enviado (mockups 2 y 7). */
interface ResultadoGuardado {
  /** Id del lote para reabrirlo (5.8); `null` si nada se confirmó. */
  loteId: string | null;
  confirmadas: number;
  /**
   * Lo que la persona vio de cada propuesta confirmada, para nombrar las que
   * una reapertura omita (la respuesta solo trae ids).
   */
  nombres: ReadonlyMap<string, { descripcion: string; referencia: string }>;
  omitidas: Array<{
    id: string;
    descripcion: string;
    referencia: string;
    razon: RazonOmisionLote;
  }>;
}

/** Lo que se muestra de una reapertura que respondió (mockups 2 y 7). */
interface ReaperturaGuardada {
  reabiertas: number;
  omitidas: Array<{
    id: string;
    descripcion: string;
    referencia: string;
    razon: RazonOmisionReapertura;
  }>;
}

/**
 * Pantalla de la bandeja de revisión (contenedor). Los filtros y la página
 * viven en la URL: aquí se leen con tolerancia, se normalizan con `replace` y
 * se escriben en forma canónica. Lee con GET y, en el modo lote (5.3), pide al
 * servidor confirmar lo que la persona marcó: la pantalla nunca decide ni cierra
 * un caso, y cambiar de página o de filtro cancela el lote. El título y el subtítulo los pone el encabezado
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

  // Confirmación en lote (5.3). `marcadas === null` es el modo normal.
  const sesion = useSessionContext();
  const puedeConfirmar =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'conciliaciones.resolver');
  const sinSeparacion = useSeparacionDesactivada();
  const confirmarLote = useConfirmarLote();
  const [marcadas, setMarcadas] = useState<ReadonlySet<string> | null>(null);
  // Lo que venía marcado al abrir el lote: sin esto no se sabe qué desmarcó la persona (6.2).
  const [inicialesDelLote, setInicialesDelLote] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  const [falloLote, setFalloLote] = useState<unknown>(null);
  const hayFalloLote = falloLote !== null;
  // Reabrir el lote recién confirmado (5.8).
  const puedeReabrir =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'conciliaciones.reabrir');
  const reabrirLote = useReabrirLote();
  const [reapertura, setReapertura] = useState<ReaperturaGuardada | null>(null);
  const [falloReapertura, setFalloReapertura] = useState<unknown>(null);
  const hayFalloReapertura = falloReapertura !== null;
  const permitidas = new Set(marcables(data?.datos ?? []));
  // Filas con casilla en esta página, también las bloqueadas (mockups 2 y 7).
  const conCasilla = (data?.datos ?? []).filter(
    (fila) => propuestaDeLote(fila) !== null,
  ).length;
  const marcadasVisibles =
    marcadas === null
      ? 0
      : [...marcadas].filter((id) => permitidas.has(id)).length;

  /** Sale del lote y descarta lo marcado, el resultado y el aviso de error. */
  function salirDelLote() {
    setMarcadas(null);
    setInicialesDelLote(new Set());
    setResultado(null);
    setFalloLote(null);
    setReapertura(null);
    setFalloReapertura(null);
  }

  function abrirLote() {
    if (!data) return;
    setResultado(null);
    setFalloLote(null);
    setReapertura(null);
    setFalloReapertura(null);
    const iniciales = marcadasIniciales(data.datos);
    setInicialesDelLote(iniciales);
    setMarcadas(iniciales);
  }

  function alternarMarca(id: string) {
    setMarcadas((actual) => {
      if (actual === null) return actual;
      const siguiente = new Set(actual);
      if (!siguiente.delete(id)) siguiente.add(id);
      return siguiente;
    });
  }

  function confirmar() {
    if (!data || marcadas === null) return;
    // Lo que se manda es lo marcado, visible y que esta persona puede confirmar.
    const ids = [...marcadas].filter((id) => permitidas.has(id));
    // Venían marcadas, siguen a la vista y la persona las quitó: solo evidencia.
    const desmarcadas = [...inicialesDelLote].filter(
      (id) => permitidas.has(id) && !marcadas.has(id),
    );
    const visibles = new Map<
      string,
      { descripcion: string; referencia: string }
    >();
    for (const fila of data.datos) {
      const id = propuestaDeLote(fila);
      if (id !== null) {
        visibles.set(id, {
          descripcion: fila.descripcion,
          referencia: etiquetaCfdi(fila.mejorPropuesta?.cfdi ?? null),
        });
      }
    }
    setFalloLote(null);
    confirmarLote.confirmar(
      ids,
      {
        onExito: (respuesta) => {
          setResultado({
            loteId: respuesta.loteId,
            confirmadas: respuesta.confirmadas.length,
            nombres: new Map(
              respuesta.confirmadas.map((id) => [
                id,
                visibles.get(id) ?? {
                  descripcion: SIN_DATO,
                  referencia: SIN_DATO,
                },
              ]),
            ),
            omitidas: respuesta.omitidas.map((o) => ({
              id: o.id,
              razon: o.razon,
              descripcion: visibles.get(o.id)?.descripcion ?? SIN_DATO,
              referencia: visibles.get(o.id)?.referencia ?? SIN_DATO,
            })),
          });
          setMarcadas(null);
        },
        onFallo: (error) => setFalloLote(error ?? true),
      },
      desmarcadas,
    );
  }

  function reabrir(motivo: string) {
    if (!resultado || resultado.loteId === null) return;
    const { nombres } = resultado;
    setFalloReapertura(null);
    reabrirLote.reabrir(resultado.loteId, motivo, {
      onExito: (respuesta) => {
        setReapertura({
          reabiertas: respuesta.reabiertas.length,
          omitidas: respuesta.omitidas.map((o) => ({
            id: o.id,
            razon: o.razon,
            descripcion: nombres.get(o.id)?.descripcion ?? SIN_DATO,
            referencia: nombres.get(o.id)?.referencia ?? SIN_DATO,
          })),
        });
        setResultado(null);
      },
      onFallo: (error) => setFalloReapertura(error ?? true),
    });
  }

  function recargar() {
    salirDelLote();
    void lista.refetch();
    void resumen.refetch();
  }

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
    if (siguiente) {
      salirDelLote();
      setParams(serializar(siguiente), { replace: true });
    }
  }

  function irAPagina(pagina: number) {
    salirDelLote();
    setParams(serializar({ ...filtros, pagina }));
    resultados.current?.focus();
  }

  function restablecer() {
    salirDelLote();
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
      {sinSeparacion ? <AvisoSinSeparacion /> : null}
      <KpiBandeja
        estado={resumen.isError ? 'error' : resumen.data ? 'listo' : 'cargando'}
        conteos={resumen.data?.conteos}
        montoPorRevisar={resumen.data?.montoPorRevisar}
        requiereRevision={resumen.data?.requiereRevision}
        onReintentar={() => void resumen.refetch()}
      />
      <section className={estilos.tarjeta}>
        <FiltrosEstado
          estados={filtros.estados}
          onAlternar={alternar}
          accion={
            puedeConfirmar &&
            marcadas === null &&
            data &&
            data.datos.length > 0 ? (
              <Button variante="secundario" onClick={abrirLote}>
                {LOTE.abrir}
              </Button>
            ) : undefined
          }
        />
        {marcadas !== null && data ? (
          <BarraLote
            marcadas={marcadasVisibles}
            total={conCasilla}
            enviando={confirmarLote.enviando}
            onConfirmar={confirmar}
            onCancelar={salirDelLote}
          />
        ) : null}
        {resultado ? (
          <ResultadoLote
            confirmadas={resultado.confirmadas}
            omitidas={resultado.omitidas}
            accion={
              puedeReabrir &&
              resultado.loteId !== null &&
              resultado.confirmadas > 0 &&
              !hayFalloReapertura ? (
                <ReabrirLote
                  enviando={reabrirLote.enviando}
                  onReabrir={reabrir}
                />
              ) : undefined
            }
          />
        ) : null}
        {reapertura ? (
          <ResultadoReapertura
            reabiertas={reapertura.reabiertas}
            omitidas={reapertura.omitidas}
          />
        ) : null}
        {hayFalloReapertura ? (
          <FalloReapertura error={falloReapertura} onRecargar={recargar} />
        ) : null}
        {hayFalloLote ? (
          <FalloLote error={falloLote} onRecargar={recargar} />
        ) : null}
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
              <TablaBandeja
                filas={data.datos}
                lote={
                  marcadas === null
                    ? undefined
                    : {
                        marcadas,
                        enviando: confirmarLote.enviando,
                        onAlternar: alternarMarca,
                      }
                }
              />
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

/**
 * El lote falló. Sin permiso es un rechazo limpio (no se aplicó nada). Cualquier
 * otro fallo es dudoso —un corte puede llegar después de que el servidor
 * escribió—, así que no se afirma que no se aplicó nada: se pide recargar.
 */
function FalloLote({
  error,
  onRecargar,
}: {
  error: unknown;
  onRecargar: () => void;
}) {
  if (mensajeDeError(error, 'general')?.tipo === 'sin_permiso') {
    return (
      <ErrorBandeja
        titulo={ERROR_SIN_PERMISO.titulo}
        detalle={ERROR_SIN_PERMISO.detalle}
      />
    );
  }
  return (
    <ErrorBandeja
      titulo={LOTE.errorTitulo}
      detalle={LOTE.errorDetalle}
      textoAccion={LOTE.recargar}
      onReintentar={onRecargar}
    />
  );
}

/**
 * La reapertura falló. 403: no es de esta persona, no se tocó nada. 409 y 404:
 * el lote cambió o ya no existe, y el servidor no reabrió nada (todo o nada).
 * Cualquier otro fallo es dudoso, como en el lote: se pide recargar.
 */
function FalloReapertura({
  error,
  onRecargar,
}: {
  error: unknown;
  onRecargar: () => void;
}) {
  const estado = error instanceof ApiError ? error.statusCode : null;
  if (estado === 403) {
    return (
      <ErrorBandeja
        titulo={REABRIR_LOTE.falloTitulo}
        detalle={REABRIR_LOTE.soloAutorOAdmin}
      />
    );
  }
  if (estado === 409 || estado === 404) {
    return (
      <ErrorBandeja
        titulo={REABRIR_LOTE.falloTitulo}
        detalle={REABRIR_LOTE.falloDetalle}
        textoAccion={LOTE.recargar}
        onReintentar={onRecargar}
      />
    );
  }
  return (
    <ErrorBandeja
      titulo={LOTE.errorTitulo}
      detalle={LOTE.errorDetalle}
      textoAccion={LOTE.recargar}
      onReintentar={onRecargar}
    />
  );
}
