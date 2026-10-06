import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  detalleCarga,
  respuestaListaCargas,
  type DetalleCarga,
  type RespuestaCarga,
  type RespuestaListaCargas,
} from '@/shared/api/contratos';
import { esActiva, type TipoCarga } from '@/shared/dominio';
import { clavesBandeja } from '@/features/bandeja/claves';
import { clavesCargas, useEpoca } from './claves';
import { useConfigPolling } from './ContextoPolling';
import { calcularIntervalo, hayActivas, terminoAlgunaCarga } from './polling';
import { useEpocaVigente } from './useEpocaVigente';
import { useEstadoVentana, useVigilarVentana } from './useVentanaPolling';

/** La carga recién subida, tal como la respondió el POST. */
export interface PanelSubida {
  id: string;
  tipo: TipoCarga;
  yaExistia: boolean;
  inicial: RespuestaCarga;
  /** Época en la que se subió: un panel de otra época no se consulta ni se muestra. */
  epoca: number;
}

/**
 * Las dos lecturas con polling de la pantalla: la lista (`GET /cargas`) y, si
 * hay una carga recién subida todavía activa, su detalle (`GET /cargas/:id`).
 * Comparten una sola ventana, un solo tope y un solo "Actualizar".
 *
 * Sin `refetchIntervalInBackground`: con la pestaña oculta no se pide solo.
 * Sin `placeholderData`: nunca se muestra el dato de otra época.
 */
export function usePollingCargas(panel: PanelSubida | null) {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const { intervaloMs, topeMs } = useConfigPolling();
  const epocaActual = useEpocaVigente(epoca);

  const ventana = useEstadoVentana();

  const lista = useQuery({
    queryKey: clavesCargas.lista(epoca),
    queryFn: async ({ signal }) => {
      const previa = cliente.getQueryData<RespuestaListaCargas>(
        clavesCargas.lista(epoca),
      );
      const nueva = await api.fetch('/cargas', {
        schema: respuestaListaCargas,
        signal,
      });
      // M17: al terminar una carga el motor pudo producir propuestas.
      if (
        epoca !== null &&
        epoca === epocaActual.current &&
        terminoAlgunaCarga(previa?.datos, nueva.datos)
      ) {
        void cliente.invalidateQueries({
          queryKey: clavesBandeja.todas(epoca),
        });
      }
      return nueva;
    },
    enabled: epoca !== null,
    refetchInterval: (consulta) =>
      calcularIntervalo(
        consulta.state.data?.datos,
        ventana.capada,
        intervaloMs,
      ),
  });

  // Solo una carga activa se consulta: un `yaExistia` terminado ya trae sus
  // resultados en el cuerpo del POST.
  const panelVigente = panel !== null && panel.epoca === epoca ? panel : null;
  const panelConsultable =
    panelVigente !== null && esActiva(panelVigente.inicial.estado);

  const consultaPanel = useQuery({
    queryKey: clavesCargas.detalle(epoca, panelVigente?.id ?? ''),
    queryFn: async ({ signal }): Promise<DetalleCarga> => {
      // Solo se ejecuta con `panelVigente` (ver `enabled`).
      const { id, inicial } = panelVigente ?? { id: '', inicial: null };
      const previa = cliente.getQueryData<DetalleCarga>(
        clavesCargas.detalle(epoca, id),
      );
      const nueva = await api.fetch(`/cargas/${encodeURIComponent(id)}`, {
        schema: detalleCarga,
        signal,
      });
      const estabaActiva = esActiva(
        (previa ?? inicial)?.estado ?? nueva.estado,
      );
      if (
        epoca !== null &&
        epoca === epocaActual.current &&
        estabaActiva &&
        !esActiva(nueva.estado)
      ) {
        // La tabla coincide en una petición en vez de esperar al siguiente
        // sondeo, y la bandeja se entera de lo que el motor produjo.
        void cliente.invalidateQueries({ queryKey: clavesCargas.lista(epoca) });
        void cliente.invalidateQueries({
          queryKey: clavesBandeja.todas(epoca),
        });
      }
      return nueva;
    },
    enabled: epoca !== null && panelConsultable,
    refetchInterval: (consulta) =>
      calcularIntervalo(
        [consulta.state.data ?? panelVigente?.inicial ?? { estado: 'fallida' }],
        ventana.capada,
        intervaloMs,
      ),
  });

  const panelDatos: DetalleCarga | RespuestaCarga | null =
    panelVigente === null ? null : (consultaPanel.data ?? panelVigente.inicial);
  const panelActivo = panelDatos !== null && esActiva(panelDatos.estado);
  const activo = hayActivas(lista.data?.datos) || panelActivo;

  useVigilarVentana(ventana, activo, topeMs);

  const { iniciar } = ventana;
  const { refetch: recargarLista } = lista;
  const { refetch: recargarPanel } = consultaPanel;
  /** "Actualizar": abre una ventana nueva y vuelve a pedir lo que se muestra. */
  const actualizar = () => {
    iniciar();
    void recargarLista();
    if (panelConsultable) void recargarPanel();
  };

  return {
    lista,
    consultaPanel,
    /** Lo que muestra el panel: el detalle más reciente o, si no, el POST. */
    panelDatos,
    ventana: ventana.ventana,
    capada: ventana.capada,
    /** Hay algo que el servidor sigue procesando (la lista o el panel). */
    activo,
    iniciarVentana: iniciar,
    actualizar,
  };
}
