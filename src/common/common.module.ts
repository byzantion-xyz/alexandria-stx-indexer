import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

import { SmartContractService } from './services/smart-contract/smart-contract.service';

@Global()
@Module({
  providers: [
    SmartContractService,
    PrismaService
  ],
  exports: [
    SmartContractService, 
    PrismaService
  ]
})
export class CommonModule { }