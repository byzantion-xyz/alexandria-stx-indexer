import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { SmartContract, SmartContractFunction } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';

@Injectable()
export class BuyTransactionService {
  private readonly logger = new Logger(BuyTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async process(
    tx: Transaction, 
    block: Block,
    smart_contract: SmartContract, 
    smart_contract_function: SmartContractFunction
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    try {
      // TODO: Arguments will be parsed in the streamer directly.
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

    if (nftMeta) {
        
    } else {

    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

}
