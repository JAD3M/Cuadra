import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { ApiError, api, reintentarConsulta } from '@/shared/api';
import { respuestaSesionPlataforma } from '@/shared/api/contratos/plataforma';
import { ESTADO_INICIAL_PLATAFORMA, reducirPlataforma } from './estado';
import { SesionPlataformaEstadoProvider } from './SesionPlataformaEstadoProvider';
import type { AccionesPlataforma } from './tipos';

/** Prefijo de las claves de consulta de plataforma: se descartan al terminar. */
export const CLAVE_PLATAFORMA = 'plataforma';

/**
 * Sesión del dueño de Cuadra. Independiente de la de empresa: no toca sus
 * endpoints (`/auth/...`), no usa su máquina de estados y no registra hooks en
 * el cliente de la API, así que un 401 de plataforma nunca termina una sesión
 * de empresa. Todas sus llamadas van con `terminaSesion: false`: quien llama
 * resuelve su 401.
 *
 * Al montar pregunta a `GET /plataforma/auth/me` si la cookie `httpOnly` aún
 * vale. 401 (sin sesión) y 403 (cookie de empresa) son anónimo, sin aviso.
 */
export function SesionPlataformaProvider({
  children,
}: {
  children: ReactNode;
}) {
  const consultas = useQueryClient();
  const [estado, enviar] = useReducer(
    reducirPlataforma,
    ESTADO_INICIAL_PLATAFORMA,
  );

  useEffect(() => {
    let cancelada = false;
    async function restaurar() {
      // Mismos reintentos que las consultas: un fallo de red o un 5xx
      // pasajero no debe mandar a quien recargó otra vez al acceso.
      for (let intentos = 1; ; intentos += 1) {
        try {
          const { usuario } = await api.fetch('/plataforma/auth/me', {
            schema: respuestaSesionPlataforma,
            terminaSesion: false,
          });
          if (!cancelada) enviar({ tipo: 'RESTAURADA', usuario });
          return;
        } catch (causa) {
          if (cancelada) return;
          const sinSesion =
            causa instanceof ApiError &&
            (causa.statusCode === 401 || causa.statusCode === 403);
          if (sinSesion || !reintentarConsulta(intentos - 1, causa)) {
            enviar({ tipo: 'SIN_SESION' });
            return;
          }
        }
      }
    }
    void restaurar();
    return () => {
      cancelada = true;
    };
  }, []);

  const acciones = useMemo<AccionesPlataforma>(() => {
    const descartarConsultas = () =>
      consultas.removeQueries({ queryKey: [CLAVE_PLATAFORMA] });
    return {
      async iniciarSesion({ email, password }) {
        // El servidor pone la cookie en la respuesta; el cuerpo no trae token.
        const { usuario } = await api.fetch('/plataforma/auth/login', {
          method: 'POST',
          body: { email, password },
          schema: respuestaSesionPlataforma,
          terminaSesion: false,
        });
        enviar({ tipo: 'LOGIN_OK', usuario });
      },
      async cerrarSesion() {
        // Si el cierre no llega la persona igual sale: la cookie vence sola.
        await api
          .fetch('/plataforma/auth/logout', {
            method: 'POST',
            terminaSesion: false,
          })
          .catch(() => undefined);
        descartarConsultas();
        enviar({ tipo: 'TERMINAR', motivo: 'sesion_cerrada' });
      },
      terminar() {
        descartarConsultas();
        enviar({ tipo: 'TERMINAR', motivo: 'sesion_terminada' });
      },
      consumirFin() {
        enviar({ tipo: 'CONSUMIR' });
      },
    };
  }, [consultas]);

  return (
    <SesionPlataformaEstadoProvider estado={estado} acciones={acciones}>
      {children}
    </SesionPlataformaEstadoProvider>
  );
}
