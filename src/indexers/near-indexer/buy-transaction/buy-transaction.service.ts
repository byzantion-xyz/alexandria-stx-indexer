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

    let args;
    try {
      // TODO: Arguments will be parsed in the streamer directly.
      args = JSON.parse(tx.transaction.actions[0].FunctionCall.args);
    } catch (err) {
      this.logger.error('Error parsing transaction arguments');
      throw err;
    }

    const token_id = args[scf.args['token_id']];
    const smart_contract_id = args[scf.args['nft_contract_id']];

    // TODO: Use findUnique
    const nftMeta = await this.prismaService.nftMeta.findFirst({
      where: { 
        smart_contract_id: smart_contract_id, 
        token_id: token_id
      },
      include: { nft_state: true }
    });
  
    // TODO: Use handle to check when meta is newly updated
    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
      await this.prismaService.nftMeta.update({
        where: { id: nftMeta.id },
        data: {
          nft_state: {
            update: {
              listed: false,
              list_price: null,
              list_seller: null,
              list_contract_id: null,
              list_tx_index: tx.transaction.nonce,
              list_block_height: block.block_height
            }
          }
        }
      });

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
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

}
