import { Module } from '@nestjs/common';
import { OwnershipController } from './ownership.controller';
import { NearOwnershipService } from './providers/near-ownership.service';

@Module({
  imports: [],
  providers: [NearOwnershipService],
  controllers: [OwnershipController],
  exports: [NearOwnershipService]
})
export class OwnershipModule {}
