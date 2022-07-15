import { Global, Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey } from "src/database/universal/entities/ApiKey";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";

@Global()
@Module({
  providers: [],
  exports: [],
  imports: [TypeOrmModule.forFeature([SmartContract, SmartContractFunction, ApiKey])],
})
export class CommonModule {}
