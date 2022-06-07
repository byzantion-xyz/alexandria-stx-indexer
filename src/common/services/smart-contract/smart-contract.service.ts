import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

class createSmartContractFunctionArgs {
  name: string
  function_name: string
  args: object
}

@Injectable()
export class SmartContractService {
  constructor(
    private readonly prisma: PrismaService
  ) { }

  async createSmartContract() {

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
