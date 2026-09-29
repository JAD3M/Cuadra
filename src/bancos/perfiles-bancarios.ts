import { Injectable } from '@nestjs/common';
import { join } from 'path';
import type { PerfilBancario } from './perfil';

/** Donde viven los perfiles; nest-cli.json los copia a dist como assets. */
export const DIRECTORIO_PERFILES = join(__dirname, 'perfiles');

/** El perfil de CU-09, que se usa si el POST no dice otro. */
export const PERFIL_POR_DEFECTO = 'cuadra';

/**
 * Los perfiles de banco (CU-10), cargados y validados una vez al arrancar.
 * Se construye con una fábrica en BancosModule: si un JSON es inválido, la
 * api no levanta.
 */
@Injectable()
export class PerfilesBancarios {
  private readonly porId: ReadonlyMap<string, PerfilBancario>;

  constructor(perfiles: readonly PerfilBancario[]) {
    this.porId = new Map(perfiles.map((perfil) => [perfil.id, perfil]));
    if (!this.porId.has(PERFIL_POR_DEFECTO)) {
      throw new Error(
        `Falta el perfil "${PERFIL_POR_DEFECTO}", que es el de por defecto`,
      );
    }
  }

  obtener(id: string): PerfilBancario | undefined {
    return this.porId.get(id);
  }

  listar(): Array<{ id: string; nombre: string }> {
    return [...this.porId.values()].map(({ id, nombre }) => ({ id, nombre }));
  }
}
