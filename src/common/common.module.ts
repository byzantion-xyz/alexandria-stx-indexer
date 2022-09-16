import { Global, Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { CommonUtilService } from "./helpers/common-util/common-util.service";

@Global()
@Module({
  providers: [CommonUtilService],
  exports: [CommonUtilService],
  imports: [TypeOrmModule.forFeature([SmartContract, SmartContractFunction])],
})
export class CommonModule {}
