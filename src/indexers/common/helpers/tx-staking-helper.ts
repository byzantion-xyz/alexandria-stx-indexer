import { Injectable, Logger } from "@nestjs/common";
import { NftState } from "src/database/universal/entities/NftState";
import { CommonTx } from "../interfaces/common-tx.interface";

@Injectable()
export class TxStakingHelper {
  private readonly logger = new Logger(TxStakingHelper.name);

  constructor() {}

  isNewStakingBlock(tx: CommonTx, nft_state: NftState) {
    return (
      !nft_state ||
      !nft_state.staked_block_height ||
      tx.block_height > nft_state.staked_block_height ||
      (tx.block_height === nft_state.staked_block_height && tx.index && tx.index > nft_state.staked_tx_index)
    );
  }
}
