﻿import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression, Timeout } from "@nestjs/schedule";
import { IndexerEventType } from "src/indexers/common/helpers/indexer-enums";
import { IndexerOptions } from "src/indexers/common/interfaces/indexer-options";
import { IndexerOrchestratorService } from "src/indexers/indexer-orchestrator.service";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private indexerOrchestrator: IndexerOrchestratorService, private configService: ConfigService) {}

  @Timeout(10000)
  async handlePendingTxs() {
    if (process.env.NODE_ENV === "production") {
      const blockConfig = this.configService.get("indexer.blockRanges")[this.configService.get("indexer.chainSymbol")];
      const initial_block = blockConfig.start_block_height_tip;
      const end_block = blockConfig.end_block_height;
      const block_range = blockConfig.block_range;
      const options: IndexerOptions = { includeMissings: false };

      for (let b = initial_block; b < end_block; b = b + block_range) {
        options.start_block_height = b;
        options.end_block_height = b + block_range;

        await this.indexerOrchestrator.runIndexer(options);
      }
    } else {
      this.logger.debug("Not in production environment. Skipping near indexer pending txs trigger.");
    }
  }

  @Timeout(2000)
  handleIndexerSubscription() {
    this.indexerOrchestrator.subscribeToEvents();
  }
}