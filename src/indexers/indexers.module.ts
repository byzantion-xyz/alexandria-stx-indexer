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
import { Transaction } from "src/database/near-stream/entities/Transaction";
import { Receipt } from "src/database/near-stream/entities/Receipt";

@Module({
  imports: [
    DiscordBotModule,
    ScrapersModule,
    TypeOrmModule.forFeature([NftMeta, NftState, Action, SmartContract, SmartContractFunction]),
    TypeOrmModule.forFeature([Transaction, Receipt], "NEAR-STREAM"),
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
  ],
  exports: [IndexerOrchestratorService],
})
export class IndexersModule {}
