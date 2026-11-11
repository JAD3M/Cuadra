// src/database/entidades.ts
// Lista explícita de entidades que registra TypeORM. Sin globs: un patrón
// como 'src/**/*.entity.ts' no resuelve igual en ts-node que en dist/.
import { Bitacora } from '../bitacora/bitacora.entity';
import { Carga } from '../cargas/carga.entity';
import { CargaArchivo } from '../cargas/carga-archivo.entity';
import { Invitacion } from '../auth/invitacion.entity';
import { TokenRecuperacion } from '../auth/token-recuperacion.entity';
import { Sesion } from '../auth/sesion.entity';
import { Cfdi } from '../cfdi/cfdi.entity';
import { Company } from '../companies/company.entity';
import { Decision } from '../conciliacion/decision.entity';
import { DecisionComentario } from '../conciliacion/decision-comentario.entity';
import { EvidenciaSombra } from '../sombra/evidencia-sombra.entity';
import { DecisionLinea } from '../conciliacion/decision-linea.entity';
import { Movimiento } from '../bancos/movimiento.entity';
import { MovimientoPendiente } from '../bancos/movimiento-pendiente.entity';
import { BancoVistaPrevia } from '../plataforma/banco-vista-previa.entity';
import { BitacoraPlataforma } from '../plataforma/bitacora-plataforma.entity';
import { PlataformaUsuario } from '../plataforma/plataforma-usuario.entity';
import { SugerenciaIa } from '../sugerencias/sugerencia-ia.entity';
import { User } from '../users/user.entity';
import { UserCompanyRole } from '../companies/user-company-role.entity';

export const ENTIDADES = [
  Company,
  User,
  UserCompanyRole,
  Carga,
  CargaArchivo,
  Cfdi,
  Movimiento,
  MovimientoPendiente,
  Decision,
  DecisionLinea,
  DecisionComentario,
  EvidenciaSombra,
  Bitacora,
  SugerenciaIa,
  Sesion,
  Invitacion,
  TokenRecuperacion,
  PlataformaUsuario,
  BitacoraPlataforma,
  BancoVistaPrevia,
];
