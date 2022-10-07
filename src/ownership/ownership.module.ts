import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { OwnershipController } from './ownership.controller';
import { NearOwnershipService } from './providers/near-ownership.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NftMeta])
  ],
  providers: [NearOwnershipService],
  controllers: [OwnershipController],
  exports: [NearOwnershipService]
})
export class OwnershipModule {}
