import { Injectable, Logger } from "@nestjs/common";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { PrismaStreamerService } from "src/prisma/prisma-streamer.service";
import { PrismaService } from "src/prisma/prisma.service";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import * as moment from "moment";
import { NearTxHelperService } from "./near-tx-helper.service";
import { SmartContract, SmartContractFunction, SmartContractType } from "@prisma/client";
import { Transaction } from "../interfaces/near-transaction.dto";
import { ExecutionStatus, ExecutionStatusBasic } from "near-api-js/lib/providers/provider";

interface SmartContractWithFunctions extends SmartContract {
  smart_contract_functions: SmartContractFunction[]
}

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly prismaStreamerService: PrismaStreamerService,
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService
  ) {}
  
  async fetchTxs(): Promise<CommonTx[]> {
    const accounts = await this.fetchAccounts();
    let accounts_in = "";
    for (let i in accounts) {
      accounts_in += `'${accounts[i]}',`;
    }
    accounts_in = accounts_in.slice(0, -1);
    const query: string = `select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id 
      where block_height >= 68000000 and
      transaction->'actions' @> '[{"FunctionCall": {}}]' AND  
      (transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_approve"}}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_revoke"}}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_buy" }}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "buy" }}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "delete_market_data" }}]') AND
      processed = false AND 
      missing = false AND
      ((execution_outcome->'outcome'->'status'->'SuccessValue' is not null) 
      or (execution_outcome->'outcome'->'status'->'SuccessReceiptId' is not null))
      order by t.block_height ASC 
      limit 1000;
    `;

    const txs: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(
      query
    );

    const result: CommonTx[] = this.transformTxs(txs);
    return result;
  }

  async fetchMissingTxs(): Promise<CommonTx[]> {
    const accounts = await this.fetchAccounts(true);
    let accounts_in = "";
    for (let i in accounts) {
      accounts_in += `'${accounts[i]}',`;
    }
    accounts_in = accounts_in.slice(0, -1);
    const query: string = `select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id 
      where block_height >= 68000000 and 
      receiver_id in (${accounts_in}) AND
      transaction->'actions' @> '[{"FunctionCall": {}}]' AND  
      (transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_approve"}}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_revoke"}}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_buy" }}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "buy" }}]' OR
      transaction->'actions' @> '[{"FunctionCall": { "method_name": "delete_market_data" }}]') AND
      ((execution_outcome->'outcome'->'status'->'SuccessValue' is not null) 
      or (execution_outcome->'outcome'->'status'->'SuccessReceiptId' is not null)) AND
      processed = false AND 
      missing = true
      order by t.block_height ASC limit 3000;   
    `;

    const txs: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(
      query
    );

    const result: CommonTx[] = this.transformTxs(txs);
    return result;
  }

  async setTxResult(txHash: string, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
      await this.prismaStreamerService.transaction.update({
        where: { hash: txHash },
        data: {
          processed: txResult.processed,
          missing: txResult.missing,
        },
      });
    }
  }

  async verifySmartContracts(smartContracts: SmartContractWithFunctions[]): Promise<any> {
    // Create smartContractFunctions for listings and unlists.
    for (let sc of smartContracts) {
      if (
        sc.type === SmartContractType.non_fungible_tokens &&
        (!sc.smart_contract_functions || !sc.smart_contract_functions.length)
      ) {
        await this.prismaService.smartContractFunction.createMany({
          data: [
            {
              smart_contract_id: sc.id,
              args: {
                price: "msg.price",
                token_id: "token_id",
                list_action: "msg.market_type",
                contract_key: "account_id",
              },
              name: "list",
              function_name: "nft_approve",
            },
            {
              smart_contract_id: sc.id,
              args: { token_id: "token_id", contract_key: "account_id" },
              name: "unlist",
              function_name: "nft_revoke",
            },
          ],
        });
      }
    }
  }

  async fetchAccounts(verifySmartContracts: boolean = false): Promise<string[]> {
    const smartContracts: SmartContractWithFunctions[] = await this.prismaService.smartContract.findMany({
      where: { chain: { symbol: 'Near'} },
      include: { smart_contract_functions: true },
    });

    // TODO: Move to the scrapper process for new smart contracts
    if (verifySmartContracts) {
      await this.verifySmartContracts(smartContracts);
    }
    const accounts = smartContracts.map((sc) => sc.contract_key);

    return accounts;
  }

  transformTx(tx: Transaction): CommonTx {
    try {
      const args = tx.transaction.actions[0].FunctionCall?.args;
      let parsed_args;
      if (args) {
        parsed_args = this.nearTxHelper.parseBase64Arguments(args);
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

  determineIfSuccessTx(status: ExecutionStatus | ExecutionStatusBasic): boolean {
    if ((status as ExecutionStatus).SuccessReceiptId || (status as ExecutionStatus).SuccessValue) {
      return true;
    } else {
      return false;
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
