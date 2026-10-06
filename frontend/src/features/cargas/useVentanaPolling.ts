import { useCallback, useEffect, useState } from 'react';

// Ventana de polling: el periodo en que se sigue pidiendo solo, con un tope
// (5 min). Empieza al pasar de "nada activo" a "algo activo", al subir una
// carga y al pulsar "Actualizar". El tope es un único temporizador por
// ventana, anclado a su inicio (no al último cambio), y cuenta también el
// tiempo con la pestaña oculta.
//
// Se divide en dos mitades por el orden de los hooks: las consultas necesitan
// `capada` (para decidir su intervalo) y la vigilancia necesita `activo` (que
// sale de las consultas). `usePollingCargas` llama primero al estado, luego a
// las consultas y al final a la vigilancia.

export interface EstadoVentana {
  /** Id de la ventana vigente: sube con cada ventana nueva. */
  ventana: number;
  /** El tope de la ventana vigente ya venció. */
  capada: boolean;
  /** Abre una ventana nueva (borra el tope vencido). */
  iniciar: () => void;
  /** Uso interno de `useVigilarVentana`. */
  marcarCapada: (ventana: number) => void;
}

export function useEstadoVentana(): EstadoVentana {
  const [ventana, setVentana] = useState(0);
  // Id de la ventana cuyo tope venció: derivar `capada` por igualdad evita
  // tener que reiniciar nada al abrir otra ventana.
  const [capadaEn, setCapadaEn] = useState<number | null>(null);
  const iniciar = useCallback(() => {
    setVentana((v) => v + 1);
  }, []);
  return {
    ventana,
    capada: capadaEn === ventana,
    iniciar,
    marcarCapada: setCapadaEn,
  };
}

/** Abre la ventana cuando `activo` sube y arma el tope mientras corre. */
export function useVigilarVentana(
  estado: EstadoVentana,
  activo: boolean,
  topeMs: number,
): void {
  const { ventana, capada, iniciar, marcarCapada } = estado;
  const [activoPrevio, setActivoPrevio] = useState(false);
  if (activo !== activoPrevio) {
    setActivoPrevio(activo);
    if (activo) iniciar();
  }

  useEffect(() => {
    if (!activo || capada) return;
    const id = setTimeout(() => {
      marcarCapada(ventana);
    }, topeMs);
    return () => {
      clearTimeout(id);
    };
  }, [activo, capada, ventana, topeMs, marcarCapada]);
}
