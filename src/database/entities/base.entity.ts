// src/database/entities/base.entity.ts
import { CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Las PK son UUIDv7 generadas por Postgres 18 con `uuidv7()`: ordenables
 * por tiempo, así que sirven de cursor y no fragmentan los índices como
 * haría un UUIDv4.
 */
export abstract class EntidadBase {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
