import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { SmartContract, SmartContractFunction } from '@prisma/client';

@Injectable()
export class BuyTransactionService {
  private readonly logger = new Logger(BuyTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async process(
    tx: Transaction, 
    smart_contract: SmartContract, 
    smart_contract_function: SmartContractFunction
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);

    try {
      const args = JSON.parse(tx.transaction.actions[0].FunctionCall.args);
    } catch (err) {
      this.logger.error('Error parsing transaction arguments');
      throw err;
    }

    const nftMeta = await this.prismaService.nftMeta.findFirst({
      where: {
        smart_contract_id: smart_contract.id,
        token_id: smart_contract_function.args['token_id']
      }
    });

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
  }

}
