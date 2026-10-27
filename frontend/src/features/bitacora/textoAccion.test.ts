import { describe, expect, it } from 'vitest';
import { ACCIONES_BITACORA, ETIQUETAS_ACCION_BITACORA } from '@/shared/dominio';
import { textoAccion } from './textoAccion';

describe('textoAccion', () => {
  it.each([
    ['invitar', 'Invitación enviada'],
    ['reenviar_invitacion', 'Invitación reenviada'],
    ['cancelar_invitacion', 'Invitación cancelada'],
    ['cambiar_rol', 'Rol cambiado'],
    ['quitar_rol', 'Rol quitado'],
  ] as const)('%s se muestra como «%s»', (accion, texto) => {
    expect(textoAccion(accion)).toBe(texto);
  });

  it('las demás acciones se muestran con el valor de la API', () => {
    for (const accion of [
      'crear',
      'actualizar',
      'eliminar',
      'cargar',
      'confirmar',
      'rechazar',
      'acceso_denegado',
    ] as const) {
      expect(textoAccion(accion)).toBe(accion);
    }
  });

  it('cada acción tiene un texto distinto y no vacío', () => {
    const textos = ACCIONES_BITACORA.map(textoAccion);
    expect(new Set(textos).size).toBe(ACCIONES_BITACORA.length);
    expect(textos.every((t) => t.length > 0)).toBe(true);
    expect(ETIQUETAS_ACCION_BITACORA.invitar).toBe('Invitación enviada');
  });
});
