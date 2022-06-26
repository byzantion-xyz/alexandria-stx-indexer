import { Injectable } from '@nestjs/common';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { PrismaStreamerService } from 'src/prisma/prisma-streamer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Transaction } from '../dto/near-transaction.dto';

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {

  constructor(
    private readonly prismaService: PrismaService,
    private readonly prismaStreamerService: PrismaStreamerService,
  ) {}

  async fetchTxs(): Promise<Transaction[]> {
    const accounts = await this.fetchAccounts();
    const query: string = this.buildQuery(accounts);
    const result: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(query);

    return result;
  }

  async fetchMissingTxs(): Promise<Transaction[]> {
    const accounts = await this.fetchAccounts();
    const query: string = this.buildQuery(accounts, true);
    const result: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(query);

    return result;
  }

  async setTxResult(txHash: string, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
      await this.prismaStreamerService.transaction.update({ where: { hash: txHash }, data: { 
        processed: txResult.processed,
        missing: txResult.missing
      }});
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
      receiver_id in (${accounts_in}) AND 
      processed = false AND 
      missing = ${missing} AND
      (( execution_outcome->'outcome'->'status'->'SuccessValue' is not null)
      or (execution_outcome->'outcome'->'status'->'SuccessReceiptId' is not null))
      order by t.block_height limit 3000;`;
  }

}
