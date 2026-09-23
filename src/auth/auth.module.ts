import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { PasswordHasher } from './password'; 

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher],
  imports: [TypeOrmModule.forFeature([User])],
})
export class AuthModule {}
