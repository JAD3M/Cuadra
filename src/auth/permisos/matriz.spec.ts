import { ROLES } from '../../common/entities/tipos';
import {
  MATRIZ_PERMISOS,
  PERMISOS,
  PERMISOS_DUENO,
  PERMISOS_PROPIOS,
  rolesConPermiso,
} from './matriz';

describe('matriz de permisos (FR-53)', () => {
  it('auditor es un rol de empresa', () => {
    expect(ROLES).toEqual(['admin', 'contador', 'revisor', 'auditor']);
  });

  it('cada permiso tiene fila en la matriz y la matriz no tiene filas de más', () => {
    expect(Object.keys(MATRIZ_PERMISOS).sort()).toEqual([...PERMISOS].sort());
  });

  it('todo rol de una fila existe en ROLES', () => {
    for (const permiso of PERMISOS) {
      for (const rol of MATRIZ_PERMISOS[permiso]) {
        expect(ROLES).toContain(rol);
      }
    }
  });

  it('secciones: bandeja y bitácora las ve el auditor; cargas y tolerancia no', () => {
    expect(rolesConPermiso('bandeja.ver')).toEqual([
      'admin',
      'contador',
      'revisor',
      'auditor',
    ]);
    expect(rolesConPermiso('bitacora.ver')).toEqual([
      'admin',
      'contador',
      'revisor',
      'auditor',
    ]);
    expect(rolesConPermiso('cargas.ver')).toEqual(['admin', 'contador']);
    expect(rolesConPermiso('tolerancia.ver')).toEqual(['admin', 'contador']);
    expect(rolesConPermiso('usuarios.ver')).toEqual(['admin']);
  });

  it('acciones: el auditor nunca tiene una acción que cambie algo', () => {
    const lecturas = ['bandeja.ver', 'bitacora.ver'];
    for (const permiso of PERMISOS) {
      if (lecturas.includes(permiso)) continue;
      expect(rolesConPermiso(permiso)).not.toContain('auditor');
    }
  });

  it('acciones de FR-53 por rol', () => {
    expect(rolesConPermiso('cargas.cargar')).toEqual(['admin', 'contador']);
    expect(rolesConPermiso('conciliaciones.resolver')).toEqual([
      'admin',
      'contador',
      'revisor',
    ]);
    expect(rolesConPermiso('movimientos.descartar')).toEqual([
      'admin',
      'contador',
      'revisor',
    ]);
    expect(rolesConPermiso('conciliaciones.comentar')).toEqual([
      'admin',
      'contador',
      'revisor',
    ]);
    expect(rolesConPermiso('muestra.verificar')).toEqual(['admin', 'revisor']);
    expect(rolesConPermiso('tolerancia.editar')).toEqual(['admin']);
    expect(rolesConPermiso('usuarios.gestionar')).toEqual(['admin']);
  });

  it('las acciones «solo lo que hizo» llevan la marca propio', () => {
    expect([...PERMISOS_PROPIOS].sort()).toEqual([
      'conciliaciones.reabrir',
      'movimientos.deshacer_descarte',
    ]);
    expect(rolesConPermiso('movimientos.deshacer_descarte')).toEqual([
      'admin',
      'contador',
      'revisor',
    ]);
    expect(rolesConPermiso('conciliaciones.reabrir')).toEqual([
      'admin',
      'contador',
      'revisor',
    ]);
  });

  it('las filas futuras ya existen en la matriz', () => {
    for (const p of [
      'muestra.verificar',
      'conciliaciones.reabrir',
      'movimientos.descartar',
      'movimientos.deshacer_descarte',
      'conciliaciones.comentar',
    ]) {
      expect(PERMISOS).toContain(p);
    }
  });

  it('el dueño no es rol de empresa: sus permisos no tienen roles', () => {
    expect([...PERMISOS_DUENO]).toEqual(['plataforma.administrar']);
    for (const p of PERMISOS_DUENO) expect(rolesConPermiso(p)).toEqual([]);
  });
});
