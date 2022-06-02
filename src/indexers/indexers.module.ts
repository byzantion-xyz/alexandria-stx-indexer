import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PrismaService as PrismaMongoService } from 'src/prisma.mongo.service';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { NearIndexerService } from './near-indexer/near-indexer.service';

@Module({
  controllers: [NearIndexerController],
  providers: [
    NearIndexerService,
    PrismaService,
    PrismaMongoService
  ]
})
export class IndexersModule {}
