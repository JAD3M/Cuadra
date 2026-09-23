import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordHasher } from './password';
import { User } from '../database/entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, OnModuleInit} from '@nestjs/common'
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService implements OnModuleInit {
    constructor (
        @InjectRepository(User) private readonly userRepository: Repository<User>, 
        private readonly passwordHasher: PasswordHasher) {}
    hashFalso!: string
    async onModuleInit() {
        this.hashFalso =  await this.passwordHasher.hashear(randomBytes(32).toString('hex'));
    }
    async validarCredenciales(email: string, password: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: {email}
        });
        const comp = !user ? this.hashFalso : user.passwordHash
        const passwordValida = await this.passwordHasher.verificar(password, comp)
        if(!user || !user.activo || !passwordValida) {
            throw new UnauthorizedException('Invalid credentials')
        }
        return user;
    }
}