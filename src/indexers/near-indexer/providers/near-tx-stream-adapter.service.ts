import { Injectable, Logger } from '@nestjs/common';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { PrismaStreamerService } from 'src/prisma/prisma-streamer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Transaction } from '../dto/near-transaction.dto';
import { TxHelperService } from './tx-helper.service';
import * as moment from 'moment';

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly prismaStreamerService: PrismaStreamerService,
    private txHelper: TxHelperService
  ) { }

  async fetchTxs(): Promise<CommonTx[]> {
    const accounts = await this.fetchAccounts();
    const query: string = this.buildQuery(accounts);
    const txs: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(query);

    const result: CommonTx[] = this.transformTxs(txs);
    return result;
  }

  async fetchMissingTxs(): Promise<CommonTx[]> {
    const accounts = await this.fetchAccounts();
    const query: string = this.buildQuery(accounts, true);
    const txs: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(query);

    const result: CommonTx[] = this.transformTxs(txs);
    return result;
  }

  async setTxResult(txHash: string, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
      await this.prismaStreamerService.transaction.update({
        where: { hash: txHash }, data: {
          processed: txResult.processed,
          missing: txResult.missing
        }
      });
    }
  }

  async fetchAccounts(): Promise<string[]> {
    const smartContracts = await this.prismaService.smartContract.findMany();
    const accounts = smartContracts.map(sc => sc.contract_key);

    return accounts;
  }

  buildQuery(accounts: string[], missing = false): string {
    let accounts_in = "";
    for (let i in accounts) {
      accounts_in += `'${accounts[i]}',`;
    }
    accounts_in = accounts_in.slice(0, -1);

    return `select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id
      where block_height >= 65000000 and 
      processed = false AND 
      missing = ${missing} AND
      (( execution_outcome->'outcome'->'status'->'SuccessValue' is not null)
      or (execution_outcome->'outcome'->'status'->'SuccessReceiptId' is not null))
      order by t.block_height limit 3000;`;
  }

  transformTx(tx: Transaction): CommonTx {
    try {
      const args = tx.transaction.actions[0].FunctionCall?.args;
      let parsed_args;
      if (args) {
        parsed_args = this.txHelper.parseBase64Arguments(args);
      }

      const notify = moment(new Date(this.txHelper.nanoToMiliSeconds(tx.block_timestamp))).utc() >
        moment().subtract(2, 'hours').utc() ? true : false;
      // TODO: Generate one transaction per tx.transaction.Action?
      return {
        hash: tx.transaction.hash,
        block_hash: tx.block_hash,
        block_timestamp: tx.block_timestamp,
        block_height: tx.block_height,
        nonce: tx.transaction.nonce,
        signer: tx.transaction.signer_id,
        receiver: tx.transaction.receiver_id,
        function_name: tx.transaction.actions[0].FunctionCall?.method_name,
        args: parsed_args,
        notify
      };
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
    }
  }

  transformTxs(txs: Transaction[]): CommonTx[] {
    let result: CommonTx[] = [];
    
    for (let tx of txs) {
      const transformed_tx = this.transformTx(tx);
      if (transformed_tx) result.push(transformed_tx);
    }

    return result;
  }

}
