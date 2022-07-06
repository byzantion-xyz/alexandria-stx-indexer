import { Global, Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";
import { SmartContract } from "src/entities/SmartContract";
import { SmartContractFunction } from "src/entities/SmartContractFunction";

@Global()
@Module({
  providers: [],
  exports: [],
  imports: [TypeOrmModule.forFeature([SmartContract, SmartContractFunction])],
})
export class CommonModule {}
