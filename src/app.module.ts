import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service'

import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['config.env', '.env'], isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('NEAR_STREAMER_DATABASE_URL'),
        useNewUrlParser: true
      }),
      connectionName: 'near-streamer',
      inject: [ConfigService]
    })
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
