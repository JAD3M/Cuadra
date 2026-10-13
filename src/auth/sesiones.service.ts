import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { MoreThan, Repository } from 'typeorm';
import { Sesion, type TipoSesion } from './sesion.entity';

/** Nombre de la cookie que lleva el token de sesión (AD-6). */
export const COOKIE_SESION = 'cuadra_sesion';

/** 8 horas sin actividad vencen la sesión; la actividad la renueva (AD-6). */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

/**
 * httpOnly: ningún script la lee. Secure siempre: `localhost` la acepta sobre
 * HTTP. Lax y no Strict: Strict rompería la primera carga al abrir un enlace
 * del correo (AD-6).
 */
export const OPCIONES_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: DURACION_SESION_MS,
};

/**
 * Fija la cookie de sesión en la respuesta. Reemplaza la que ya hubiera
 * puesto el guard (renovación) por la nueva (login, rotación): dos
 * `Set-Cookie` con el mismo nombre dejarían la elección al navegador.
 */
export function fijarCookieSesion(respuesta: Response, token: string): void {
  const previas = respuesta.getHeader('Set-Cookie');
  if (previas !== undefined) {
    const otras = [previas]
      .flat()
      .map(String)
      .filter((c) => !c.startsWith(`${COOKIE_SESION}=`));
    respuesta.removeHeader('Set-Cookie');
    if (otras.length) respuesta.setHeader('Set-Cookie', otras);
  }
  respuesta.cookie(COOKIE_SESION, token, OPCIONES_COOKIE);
}

/** SHA-256 en hex: lo único del token que se guarda en la base. */
export function huellaDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 bytes aleatorios en base64url: cabe en una cookie sin codificar. */
function nuevoToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Sesión opaca en la base (AD-6). El token solo existe en la cookie; aquí
 * viaja una vez, al crearlo o rotarlo, y nunca vuelve a salir de la base.
 * `sesiones` es identidad (clase 2, sin RLS): se lee fuera de la
 * transacción de empresa.
 */
@Injectable()
export class SesionesService {
  constructor(
    @InjectRepository(Sesion) private readonly repositorio: Repository<Sesion>,
  ) {}

  /** `company_id` nulo hasta que la persona elige empresa. */
  async crear(
    userId: string,
    tipo: TipoSesion,
    companyId: string | null = null,
  ): Promise<{ token: string; sesion: Sesion }> {
    const token = nuevoToken();
    const ahora = new Date();
    const sesion = await this.repositorio.save(
      this.repositorio.create({
        userId,
        tipo,
        companyId,
        tokenHash: huellaDeToken(token),
        ultimaActividad: ahora,
        expiraEn: new Date(ahora.getTime() + DURACION_SESION_MS),
      }),
    );
    return { token, sesion };
  }

  /** Solo sesiones vigentes: una vencida es como si no existiera. */
  async buscarPorToken(token: string): Promise<Sesion | null> {
    return await this.repositorio.findOne({
      where: {
        tokenHash: huellaDeToken(token),
        expiraEn: MoreThan(new Date()),
      },
    });
  }

  /**
   * Actividad = renovación: `ultima_actividad` a ahora y el vencimiento a
   * ahora + 8 h. Falso si la fila ya no está o ya venció (cerrar sesión
   * concurrente, o vencida entre la lectura y aquí): no se resucita.
   */
  async renovar(id: string): Promise<boolean> {
    const ahora = new Date();
    const res = await this.repositorio.update(
      { id, expiraEn: MoreThan(ahora) },
      {
        ultimaActividad: ahora,
        expiraEn: new Date(ahora.getTime() + DURACION_SESION_MS),
      },
    );
    return (res.affected ?? 0) > 0;
  }

  /**
   * Elegir empresa: la misma fila gana `company_id` y el token rota, así el
   * anterior (el de antes de elegir) deja de servir. Devuelve el token nuevo,
   * o null si la sesión ya no existe.
   */
  async elegirEmpresa(id: string, companyId: string): Promise<string | null> {
    const token = nuevoToken();
    const ahora = new Date();
    const res = await this.repositorio.update(
      { id, expiraEn: MoreThan(ahora) },
      {
        companyId,
        tokenHash: huellaDeToken(token),
        ultimaActividad: ahora,
        expiraEn: new Date(ahora.getTime() + DURACION_SESION_MS),
      },
    );
    return (res.affected ?? 0) > 0 ? token : null;
  }

  /** Cerrar sesión borra la fila: el mismo token responde 401 de inmediato. */
  async cerrar(token: string): Promise<void> {
    await this.repositorio.delete({ tokenHash: huellaDeToken(token) });
  }
}
