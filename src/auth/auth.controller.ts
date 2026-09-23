import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/LoginDto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post('login')
    @HttpCode(200)
    async login(@Body() dto: LoginDto) {
        await this.authService.validarCredenciales(dto.email, dto.password);
        return { ok: true };
    }
}

