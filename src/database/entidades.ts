// src/database/entidades.ts
// Lista explícita de entidades que registra TypeORM. Sin globs: un patrón
// como 'src/**/*.entity.ts' no resuelve igual en ts-node que en dist/.
import { Bitacora } from '../bitacora/bitacora.entity';
import { Carga } from '../cargas/carga.entity';
import { Cfdi } from '../cfdi/cfdi.entity';
import { Company } from '../companies/company.entity';
import { Conciliacion } from '../conciliacion/conciliacion.entity';
import { Movimiento } from '../bancos/movimiento.entity';
import { User } from '../users/user.entity';
import { UserCompanyRole } from '../companies/user-company-role.entity';

export const ENTIDADES = [
  Company,
  User,
  UserCompanyRole,
  Carga,
  Cfdi,
  Movimiento,
  Conciliacion,
  Bitacora,
];
