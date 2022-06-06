import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService } from '../helpers/tx-helper/tx-helper.service';

@Injectable()
export class BuyTransactionService {
  private readonly logger = new Logger(BuyTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService
  ) {}

  async process(
    tx: Transaction, 
    block: Block,
    sc: SmartContract, 
    scf: SmartContractFunction
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    let args;
    try {
      // TODO: Arguments will be parsed in the streamer directly.
      args = JSON.parse(tx.transaction.actions[0].FunctionCall.args);
    } catch (err) {
      this.logger.error('Error parsing transaction arguments');
      throw err;
    }

    const token_id = args[scf.args['token_id']];
    const price = args[scf.args['price']];
    const smart_contract_id = args[scf.args['nft_contract_id']];

    // TODO: Use findUnique
    const nftMeta = await this.prismaService.nftMeta.findFirst({
      where: {
        smart_contract_id: sc.id,
        token_id: scf.args['token_id']
      },
      include: {
        nft_state: true
      }
    });
    
    // TODO: Use handle to check when meta is newly updated
    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
    
      
      txResult.processed = true;        
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
    } else {
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

}
