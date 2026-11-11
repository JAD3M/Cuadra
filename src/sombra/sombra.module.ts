import { Module } from '@nestjs/common';
import { SombraService } from './sombra.service';

@Module({ providers: [SombraService], exports: [SombraService] })
export class SombraModule {}
