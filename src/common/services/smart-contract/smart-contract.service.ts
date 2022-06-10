import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SmartContractType } from '@prisma/client';

interface createSmartContractFunctionArgs {
  name: string
  function_name: string
  args: object
}

interface createSmartContractArgs {
  contract_key: string 
  name: string
  type: SmartContractType
  asset_name?: string
}

@Injectable()
export class SmartContractService {
  constructor(
    private readonly prisma: PrismaService
  ) { }

  async createSmartContract(chainSymbol: string, params: createSmartContractArgs) {
    await this.prisma.chain.update({
      where: { symbol: chainSymbol },
      data: {
        smart_contracts: {
          create: {
            contract_key: params.contract_key,
            name: params.name,
            type: params.type,
            asset_name: params.asset_name,
          }
        }
      }
    });
  }

  async createSmartContractFunction(contract_key: string, params: createSmartContractFunctionArgs) {
    await this.prisma.smartContract.update({
      where: { contract_key },
      data: {
        smart_contract_functions: {
          create: {
            name: params.name,
            function_name: params.function_name,
            args: params.args
          }
        }
      }
    })
  }

}
