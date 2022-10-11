import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { ScrapersModule } from 'src/scrapers/scrapers.module';
import { OwnershipController } from './ownership.controller';
import { NearOwnershipService } from './providers/near-ownership.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NftMeta, SmartContract]),
    ScrapersModule
  ],
  providers: [NearOwnershipService],
  controllers: [OwnershipController],
  exports: [NearOwnershipService]
})
export class OwnershipModule {}
