import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service'

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: 'config.env', isGlobal: true })
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService,
    PrismaService
  ],
})
export class AppModule {}
