import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService } from '../helpers/tx-helper/tx-helper.service';
import moment from 'moment';

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

    // TODO: Arguments will be parsed in the streamer directly.
    let args = this.txHelper.parseBase64Arguments(tx);
   
    const token_id = args[scf.args['token_id']];
    const contract_key = args[scf.args['contract_key']];

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    // TODO: Use handle to check when meta is newly updated
    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
      await this.txHelper.unlistMeta(nftMeta.id, tx.transaction.nonce, block.block_height);

      try {
        const action = await this.prismaService.action.create({
          data: {
            smart_contract_id: sc.id,
            nft_meta_id: nftMeta.id,
            collection_id: nftMeta.collection_id,
            action: 'buy',
            market_name: sc.name,
            list_price: nftMeta.nft_state.list_price,
            seller: nftMeta.nft_state.list_seller,
            buyer: tx.transaction.signer_id,
            block_height: block.block_height,
            tx_index: tx.transaction.nonce,
            block_time: moment().toDate(), // TODO: Add block timestamp
            tx_id: tx.transaction.hash
          }
        });

        this.logger.log(`New Action Buy: ${action.id}`);
      } catch (err) {
        this.logger.warn(err);
      }

      txResult.processed = true;        
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
    } else {
      this.logger.log(`NftMeta not found by`, { contract_key, token_id });
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

}
