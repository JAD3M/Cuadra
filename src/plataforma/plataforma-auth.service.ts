import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import { SesionesService } from '../auth/sesiones.service';
import { normalizarEmail } from '../users/email';
import { PlataformaUsuario } from './plataforma-usuario.entity';

export interface ResultadoLoginPlataforma {
  /** Solo para la cookie: nunca va al cuerpo. */
  token: string;
  usuario: { id: string; correo: string };
}

/**
 * Login del dueño de Cuadra (AD-5). Mismo contrato que el de empresa: un solo
 * 401 genérico y un hash de relleno para que el tiempo no delate si el correo
 * existe.
 */
@Injectable()
export class PlataformaAuthService implements OnModuleInit {
  private hashFalso!: string;

  constructor(
    @InjectRepository(PlataformaUsuario)
    private readonly usuarios: Repository<PlataformaUsuario>,
    private readonly hasher: PasswordHasher,
    private readonly sesiones: SesionesService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hashFalso = await this.hasher.hashear(randomBytes(32).toString('hex'));
  }

  async login(
    correo: string,
    password: string,
  ): Promise<ResultadoLoginPlataforma> {
    const usuario = await this.usuarios.findOne({
      where: { correo: normalizarEmail(correo) },
    });
    const valida = await this.hasher.verificar(
      password,
      usuario ? usuario.passwordHash : this.hashFalso,
    );
    if (!usuario || !usuario.activo || !valida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const { token } = await this.sesiones.crearPlataforma(usuario.id);
    return { token, usuario: { id: usuario.id, correo: usuario.correo } };
  }
}
