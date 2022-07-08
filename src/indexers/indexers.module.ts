
import { Module } from "@nestjs/common";
import { NearIndexerController } from "./near-indexer/near-indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { BuyIndexerService } from "./common/providers/buy-indexer.service";
import { ListIndexerService } from "./common/providers/list-indexer.service";
import { TxHelperService } from "./common/helpers/tx-helper.service";
import { UnlistIndexerService } from "./common/providers/unlist-indexer.service";
import { DiscordBotModule } from "src/discord-bot/discord-bot.module";
import { ScrapersModule } from "src/scrapers/scrapers.module";
import { NearTxStreamAdapterService } from "./near-indexer/providers/near-tx-stream-adapter.service";
import { NearTxHelperService } from "./near-indexer/providers/near-tx-helper.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftState } from "src/database/universal/entities/NftState";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Transaction as NearTransaction } from "src/database/near-stream/entities/Transaction";
import { Receipt } from "src/database/near-stream/entities/Receipt";
import { StacksTxStreamAdapterService } from './stacks-indexer/providers/stacks-tx-stream-adapter.service';
import { Chain } from "src/database/universal/entities/Chain";
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxHelperService } from './stacks-indexer/providers/stacks-tx-helper.service';


@Module({
  imports: [
    DiscordBotModule,
    ScrapersModule,
    TypeOrmModule.forFeature([NftMeta, NftState, Action, SmartContract, SmartContractFunction, Chain]),
    TypeOrmModule.forFeature([NearTransaction, Receipt], "NEAR-STREAM"),
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
  ],
  controllers: [NearIndexerController],
  providers: [
    IndexerOrchestratorService,
    BuyIndexerService,
    ListIndexerService,
    TxHelperService,
    UnlistIndexerService,
    NearTxStreamAdapterService,
    NearTxHelperService,
    StacksTxStreamAdapterService,
    StacksTxHelperService,
  ],
  exports: [IndexerOrchestratorService],
})
export class IndexersModule {}
