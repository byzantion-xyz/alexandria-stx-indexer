import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexersModule } from './indexers/indexers.module';
import { CommonModule } from './common/common.module';
import { ScrapersModule } from './scrapers/scrapers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['config.env', '.env'], isGlobal: true }),
    ScrapersModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('NEAR_STREAMER_DATABASE_URL'),
        useNewUrlParser: true
      }),
      connectionName: 'near-streamer',
      inject: [ConfigService]
    }),
    IndexersModule,
    CommonModule
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService
  ]
})
export class AppModule {}
