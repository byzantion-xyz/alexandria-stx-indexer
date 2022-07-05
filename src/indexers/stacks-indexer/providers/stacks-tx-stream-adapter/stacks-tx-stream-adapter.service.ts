import { Injectable } from '@nestjs/common';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';

@Injectable()
export class StacksTxStreamAdapterService implements TxStreamAdapter {
  fetchTxs(): Promise<CommonTx[]> {
    throw new Error('Method not implemented.');
  }
  fetchMissingTxs(): Promise<CommonTx[]> {
    throw new Error('Method not implemented.');
  }
  setTxResult(txHash: string, txResult: TxProcessResult): void {
    throw new Error('Method not implemented.');
  }
}
