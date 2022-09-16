import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NftState } from "src/database/universal/entities/NftState";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { Repository } from "typeorm";
import { CommonTx } from "../interfaces/common-tx.interface";

@Injectable()
export class TxStakingHelperService {
  private readonly logger = new Logger(TxStakingHelperService.name);

  constructor(
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  isNewStakingBlock(tx: CommonTx, nft_state: NftState) {
    return (
      !nft_state ||
      !nft_state.staked_block_height ||
      tx.block_height > nft_state.staked_block_height ||
      (tx.block_height === nft_state.staked_block_height && tx.index && tx.index > nft_state.staked_tx_index)
    );
  }
}
