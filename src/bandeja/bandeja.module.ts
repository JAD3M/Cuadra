import { Module } from '@nestjs/common';
import { BandejaController } from './bandeja.controller';
import { BandejaService } from './bandeja.service';

@Module({
  controllers: [BandejaController],
  providers: [BandejaService],
})
export class BandejaModule {}
