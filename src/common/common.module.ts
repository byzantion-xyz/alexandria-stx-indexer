import { Global, Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

import { SmartContractService } from "./services/smart-contract/smart-contract.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SmartContract } from "src/entities/SmartContract";
import { SmartContractFunction } from "src/entities/SmartContractFunction";

@Global()
@Module({
  providers: [SmartContractService, PrismaService],
  exports: [SmartContractService, PrismaService],
  imports: [TypeOrmModule.forFeature([SmartContract, SmartContractFunction])],
})
export class CommonModule {}
