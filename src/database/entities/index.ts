// src/database/entities/index.ts
export * from './tipos';
export * from './base.entity';
export * from './company.entity';
export * from './user.entity';
export * from './user-company-role.entity';
export * from './carga.entity';
export * from './cfdi.entity';
export * from './movimiento.entity';
export * from './conciliacion.entity';
export * from './bitacora.entity';

import { Bitacora } from './bitacora.entity';
import { Carga } from './carga.entity';
import { Cfdi } from './cfdi.entity';
import { Company } from './company.entity';
import { Conciliacion } from './conciliacion.entity';
import { Movimiento } from './movimiento.entity';
import { User } from './user.entity';
import { UserCompanyRole } from './user-company-role.entity';

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
