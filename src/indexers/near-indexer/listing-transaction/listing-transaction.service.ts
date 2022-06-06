import { Logger, Injectable } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import moment from 'moment';
import { SmartContract, SmartContractFunction, ActionName } from '@prisma/client';
import { MetadataScanner } from '@nestjs/core';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';

@Injectable()
export class ListingTransactionService {
  private readonly logger = new Logger(ListingTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async process(
    tx: Transaction,
    block: Block,
    sc: SmartContract,
    scf: SmartContractFunction
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    let args;
    // TODO: Arguments will come parsed once near-streamer is updated
    try {
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
      where: { smart_contract_id: sc.id, token_id }
    });

    if (nftMeta) {
       // TODO: Use unified service to update NftMeta and handle NftState changes
      await this.prismaService.nftMeta.update({
        where: { id: nftMeta.id },
        data: {
          smart_contract_id: sc.id,
          nft_state: {
            update: {
              listed: true,
              list_price: price,
              list_contract_id: smart_contract_id,
              list_tx_index: tx.transaction.nonce,
              list_seller: tx.transaction.signer_id,
              list_block_height: block.block_height
            }
          }
        }
      });

      try {
        // TODO: Use unified service to update actions and handle errors
        const price = args[scf.args['price']];
        const smart_contract_id = args[scf.args['nft_contract_id']];

        const action = await this.prismaService.action.create({
          data: {
            action: ActionName.list,
            list_price: price,
            block_height: block.block_height,
            tx_index: tx.transaction.nonce,
            block_time: moment().toDate(), // TODO: Use block timestamp
            tx_id: tx.transaction.hash,
            nft_meta_id: nftMeta.id,
            smart_contract_id: smart_contract_id,
          }
        });

        this.logger.log(`New action list: ${action.id} `);
      } catch (err) {
        this.logger.warn(err);
      }

      await this.sendNotifications();
      txResult.processed = true;
    } else {
      // TODO: Call Missing Collection handle once built
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

  async sendNotifications() {
    this.logger.debug('Skipping notifications until implemented ...');
  }

}
