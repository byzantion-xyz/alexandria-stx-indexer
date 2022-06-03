import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';

import { IndexersModule } from './indexers/indexers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['config.env', '.env'], isGlobal: true }),
    IndexersModule
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService
  ],
})
export class AppModule {}
