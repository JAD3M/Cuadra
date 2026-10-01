import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  sistemaPrefiereOscuro,
} from './almacenamiento';
import { ContextoTema } from './contextoTema';
import { resolverTema } from './resolverTema';
import { CLAVE_TEMA, CONSULTA_OSCURO, type Preferencia } from './tipos';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferenciaEstado] = useState<Preferencia>(() =>
    leerPreferencia(),
  );
  // Solo se escucha al sistema mientras la preferencia es `system`. La lectura
  // es en vivo, así que al volver a `system` el valor ya está al día.
  const suscribirSistema = useCallback(
    (alCambiar: () => void) => {
      if (preferencia !== 'system') return () => {};
      if (typeof window.matchMedia !== 'function') return () => {};
      const consulta = window.matchMedia(CONSULTA_OSCURO);
      consulta.addEventListener('change', alCambiar);
      return () => consulta.removeEventListener('change', alCambiar);
    },
    [preferencia],
  );
  const sistemaOscuro = useSyncExternalStore(
    suscribirSistema,
    () => sistemaPrefiereOscuro(),
    () => true,
  );

  const resuelto = resolverTema(preferencia, sistemaOscuro);

  // Antes de pintar, para que un cambio no deje un cuadro con el tema viejo.
  useLayoutEffect(() => {
    aplicarTema(resuelto);
  }, [resuelto]);

  // Otra pestaña cambió la elección: se lee de nuevo del almacenamiento.
  useEffect(() => {
    const alAlmacenar = (evento: StorageEvent) => {
      if (evento.key !== null && evento.key !== CLAVE_TEMA) return;
      setPreferenciaEstado(leerPreferencia());
    };
    window.addEventListener('storage', alAlmacenar);
    return () => window.removeEventListener('storage', alAlmacenar);
  }, []);

  const setPreferencia = useCallback((nueva: Preferencia) => {
    guardarPreferencia(nueva);
    setPreferenciaEstado(nueva);
  }, []);

  const valor = useMemo(
    () => ({ preferencia, resuelto, setPreferencia }),
    [preferencia, resuelto, setPreferencia],
  );

  return <ContextoTema value={valor}>{children}</ContextoTema>;
}
