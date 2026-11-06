import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { claveContexto } from './acciones';
import { useSessionContext } from './useSessionContext';

/**
 * ¿El dueño de la plataforma desactivó la separación de funciones de la
 * empresa de la sesión? Solo con el contexto listo y `false` explícito: cargando
 * o no disponible no hay aviso (el servidor aplica la regla por su cuenta).
 *
 * El contexto no caduca solo (`staleTime` infinito, para que volver de un
 * cambio de empresa no parpadee). Pero el dueño puede cambiar la separación con
 * la sesión ya abierta, así que cada pantalla que muestra el aviso lo vuelve a
 * leer al abrirse. Sin parpadeo: mientras se relee se conserva lo que ya había.
 */
export function useSeparacionDesactivada(): boolean {
  const sesion = useSessionContext();
  const consultas = useQueryClient();
  const epoca = sesion.status === 'ready' ? sesion.epoca : null;

  useEffect(() => {
    if (epoca === null) return;
    void consultas.refetchQueries({ queryKey: claveContexto(epoca) });
  }, [consultas, epoca]);

  return (
    sesion.status === 'ready' &&
    sesion.contexto.empresa.separacionFunciones === false
  );
}
