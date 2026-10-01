import type { SessionState } from './types';

/**
 * Datos provisionales de la sesión. No vienen de la API: CU-21 los reemplaza
 * por el contexto real. Tienen la forma exacta de `ContextoSesion`.
 */
export const ESTADO_SESION_PLACEHOLDER: SessionState = {
  status: 'ready',
  contexto: {
    usuario: {
      id: '3f2b8a6e-6c1d-4a39-9d5e-0c1f7a1b2c3d',
      nombre: 'Jorge Tapia',
      email: 'jorge.tapia@despacho.mx',
    },
    empresa: {
      id: '7a1c9e52-0b34-4d6f-8e21-5c9d3b7a4f10',
      razonSocial: 'Ferretería del Bajío SA de CV',
      rfc: 'FDB190215QK4',
    },
    roles: ['admin', 'contador'],
  },
};
