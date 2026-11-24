import { useState } from 'react';
import type { ResultadoMuestra } from '@/shared/api/contratos';
import { puede } from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Aviso } from './components/Aviso';
import { Avance } from './components/Avance';
import { DetalleCaso } from './components/DetalleCaso';
import { Esqueleto } from './components/Esqueleto';
import { ListaCasos } from './components/ListaCasos';
import { clasificarErrorMarca } from './errores';
import { etiquetaMes } from './formato';
import { casoInicial, numeroDe, vecino, type FiltroCasos } from './lista';
import estilos from './MuestraContenedor.module.css';
import {
  AVISO_SIN_REVISOR,
  AVISO_SOLO_CONSULTA,
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  MES,
  REINTENTAR,
  sinMuestra,
} from './textos';
import { useMuestra } from './useMuestra';
import { useVerificarMuestra } from './useVerificarMuestra';

/**
 * Contenedor de la pantalla de la muestra (historia 9.4): junta la sesión, la
 * lectura, la mutación y el estado de la pantalla (mes, filtro, caso elegido).
 * Sin `muestra.ver` no pide nada y dice que no hay permiso: el menú ya lo
 * oculta y el servidor responde 403, esto cubre la ruta directa. Los
 * componentes solo reciben props; marcar pasa siempre por la API.
 */
export function MuestraContenedor() {
  const sesion = useSessionContext();
  const contexto = sesion.status === 'ready' ? sesion.contexto : null;
  const permitido =
    contexto !== null && puede(contexto.capacidades, 'muestra.ver');
  const permisoVerificar =
    contexto !== null && puede(contexto.capacidades, 'muestra.verificar');

  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroCasos>('todos');
  const [elegida, setElegida] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<string | null>(null);
  // Caso con el que se abrió cada mes: se fija una vez para que, al marcarlo,
  // la pantalla no salte al siguiente pendiente.
  const [inicial, setInicial] = useState<{
    mes: string | null;
    id: string | null;
  } | null>(null);

  const muestra = useMuestra(mesElegido, permitido);
  const verificar = useVerificarMuestra();

  if (!permitido) return <AlertaError {...ERROR_SIN_PERMISO} />;

  if (muestra.isError) {
    return (
      <AlertaError
        {...ERROR_CONEXION}
        accion={
          <Button variante="secundario" onClick={() => void muestra.refetch()}>
            {REINTENTAR}
          </Button>
        }
      />
    );
  }
  const datos = muestra.data;
  if (datos === undefined) return <Esqueleto />;

  const mes = mesElegido ?? datos.mes;
  const mesTexto = mes === null ? 'este mes' : etiquetaMes(mes);
  const casos = datos.casos;
  if (inicial === null || inicial.mes !== datos.mes) {
    setInicial({ mes: datos.mes, id: casoInicial(casos) });
  }
  const existe = (id: string | null) =>
    id !== null && casos.some((c) => c.decisionId === id);
  const idActual = existe(elegida)
    ? elegida
    : existe(inicial?.id ?? null)
      ? (inicial?.id ?? null)
      : casoInicial(casos);
  const caso = casos.find((c) => c.decisionId === idActual);
  const n = idActual === null ? null : numeroDe(casos, idActual);

  function elegir(decisionId: string) {
    verificar.reset();
    setCambiando(null);
    setElegida(decisionId);
  }

  function marcar(resultado: ResultadoMuestra) {
    if (caso === undefined) return;
    verificar.marcar({ decisionId: caso.decisionId, resultado }, () =>
      setCambiando(null),
    );
  }

  const error = verificar.isError
    ? clasificarErrorMarca(verificar.error)
    : null;
  const sinRevisorAviso = datos.sinRevisor && datos.puedeVerificar;
  const sinMuestraDelMes = datos.mes === null || casos.length === 0;

  return (
    <div className={estilos.pantalla}>
      {datos.meses.length > 0 ? (
        <div className={estilos.mes}>
          <label htmlFor="muestra-mes" className={estilos.rotulo}>
            {MES}
          </label>
          <select
            id="muestra-mes"
            className={estilos.campo}
            value={mes ?? ''}
            onChange={(e) => {
              verificar.reset();
              setCambiando(null);
              setElegida(null);
              setFiltro('todos');
              setMesElegido(e.target.value);
            }}
          >
            {datos.meses.map((m) => (
              <option key={m} value={m}>
                {etiquetaMes(m)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sinRevisorAviso ? (
        <Aviso
          tono="info"
          titulo={AVISO_SIN_REVISOR.titulo}
          detalles={[AVISO_SIN_REVISOR.detalle]}
        />
      ) : null}
      {!permisoVerificar ? (
        <Aviso
          tono="info"
          titulo={AVISO_SOLO_CONSULTA.titulo}
          detalles={[AVISO_SOLO_CONSULTA.detalle]}
        />
      ) : null}

      {sinMuestraDelMes || caso === undefined || n === null ? (
        <Aviso
          tono="info"
          titulo={sinMuestra(mesTexto).titulo}
          detalles={[sinMuestra(mesTexto).detalle]}
        />
      ) : (
        <>
          <Avance avance={datos.avance} mes={mesTexto} />
          <div className={estilos.dos}>
            <ListaCasos
              casos={casos}
              filtro={filtro}
              conteos={{
                todos: datos.avance.total,
                pendientes: datos.avance.pendientes,
                desacuerdo: datos.avance.desacuerdos,
              }}
              seleccionada={caso.decisionId}
              onFiltro={setFiltro}
              onElegir={elegir}
            />
            <DetalleCaso
              caso={caso}
              n={n}
              total={datos.avance.total}
              hayAnterior={vecino(casos, caso.decisionId, filtro, -1) !== null}
              haySiguiente={vecino(casos, caso.decisionId, filtro, 1) !== null}
              permisoVerificar={permisoVerificar}
              confirmadaPorMi={caso.confirmadaPorMi}
              cambiando={cambiando === caso.decisionId}
              enVuelo={verificar.isPending}
              error={error}
              onAnterior={() => {
                const id = vecino(casos, caso.decisionId, filtro, -1);
                if (id !== null) elegir(id);
              }}
              onSiguiente={() => {
                const id = vecino(casos, caso.decisionId, filtro, 1);
                if (id !== null) elegir(id);
              }}
              onMarcar={marcar}
              onCambiar={() => setCambiando(caso.decisionId)}
            />
          </div>
        </>
      )}
    </div>
  );
}
