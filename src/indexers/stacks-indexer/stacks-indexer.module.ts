import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonIndexerModule } from '../common/common-indexer.module';
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxStreamAdapterService } from './providers/stacks-tx-stream-adapter.service';
import { StacksTxHelperService } from './providers/stacks-tx-helper.service';

import { ListIndexerService } from './providers/list-indexer.service';
import { UnlistIndexerService } from './providers/unlist-indexer.service';
import { BuyIndexerService } from './providers/buy-indexer.service';
import { StakeIndexerService } from './providers/stake-indexer.service';
import { UnstakeIndexerService } from './providers/unstake-indexer.service';
import { ChangePriceIndexerService } from './providers/change-price-indexer.service';
import { BidIndexerService } from './providers/bid-indexer.service';
import { UnlistBidIndexerService } from './providers/unlist-bid-indexer.service';
import { AcceptBidIndexerService } from './providers/accept-bid-indexer.service';
import { CollectionOrderBookBidIndexerService } from './providers/collection-order-book-bid-indexer.service';
import { CollectionOrderBookAcceptBidIndexerService } from './providers/collection-order-book-accept-bid-indexer.service';
import { CollectionRemoveOrderBookBidIndexerService } from './providers/collection-remove-order-book-bid-indexer.service';
import { CollectionMultiOrderBookBidIndexerService } from './providers/collection-multi-order-book-bid-indexer.service';
import { IdBidIndexerService } from './providers/id-bid-indexer.service';
import { MultiIdBidIndexerService } from './providers/multi-id-bid-indexer.service';
import { IdAcceptBidIndexerService } from './providers/id-accept-bid-indexer.service';
import { IdRemoveBidIndexerService } from './providers/id-remove-bid-indexer.service';
import { SoloIdBidIndexerService } from './providers/solo-id-bid-indexer.service';
import { SoloIdUnlistBidIndexerService } from './providers/solo-id-unlist-bid-indexer.service';
import { SoloIdAcceptBidIndexerService } from './providers/solo-id-accept-bid-indexer.service';
import { CollectionBidIndexerService } from './providers/collection-bid-indexer.service';
import { CollectionUnlistBidIndexerService } from './providers/collection-unlist-bid-indexer.service';
import { CollectionAcceptBidIndexerService } from './providers/collection-accept-bid-indexer.service';
import { RelistIndexerService } from './providers/relist-indexer.service';
import { RenameIndexerService } from './providers/rename-indexer.service';
import { UpgradeIndexerService } from './providers/upgrade-indexer.service';
import { TxUpgradeHelperService } from './helpers/tx-upgrade-helper.service';
import { UpgradeMegaIndexerService } from './providers/upgrade-mega-indexer.service';
import { BuyWrapperIndexerService } from './providers/buy-wrapper-indexer.service';
import { AdminSoloIdUnlistBidIndexerService } from './providers/admin-solo-id-unlist-bid-indexer.service';
import { NftTransferEventIndexerService } from './providers/nft-transfer-event-indexer.service';
import { NftBurnEventIndexerService } from './providers/nft-burn-event-indexer.service';
import { NftMintEventIndexerService } from './providers/nft-mint-event-indexer.service';
import { SetSuitMappingIndexerService } from './providers/set-suit-mapping-indexer.service';

const microIndexers = [
  ListIndexerService,
  UnlistIndexerService,
  BuyIndexerService,
  StakeIndexerService,
  UnstakeIndexerService,
  ChangePriceIndexerService,
  BidIndexerService,
  UnlistBidIndexerService,
  AcceptBidIndexerService,
  CollectionOrderBookBidIndexerService,
  CollectionOrderBookAcceptBidIndexerService,
  CollectionRemoveOrderBookBidIndexerService,
  CollectionMultiOrderBookBidIndexerService,
  IdBidIndexerService,
  MultiIdBidIndexerService,
  IdAcceptBidIndexerService,
  IdRemoveBidIndexerService,
  SoloIdBidIndexerService,
  SoloIdUnlistBidIndexerService,
  SoloIdAcceptBidIndexerService,
  CollectionBidIndexerService,
  CollectionUnlistBidIndexerService,
  CollectionAcceptBidIndexerService,
  RelistIndexerService,
  RenameIndexerService,
  UpgradeIndexerService,
  TxUpgradeHelperService,
  UpgradeMegaIndexerService,
  BuyWrapperIndexerService,
  AdminSoloIdUnlistBidIndexerService,
  // NFT events
  NftTransferEventIndexerService,
  NftBurnEventIndexerService,
  NftMintEventIndexerService,
  // Megapont
  SetSuitMappingIndexerService
];

@Module({
  imports: [
    CommonIndexerModule,
    TypeOrmModule.forFeature([StacksTransaction, Block], "CHAIN-STREAM"),
  ],
  providers: [
    StacksTxHelperService,
    { provide: 'TxStreamAdapter', useClass: StacksTxStreamAdapterService },
    ...microIndexers,
    { 
      provide: 'MicroIndexers', 
      useFactory: (...microIndexers) => microIndexers,
      inject: [...microIndexers]
    }
  ],
  exports: [
    StacksTxHelperService,
    TypeOrmModule,
    { provide: 'TxStreamAdapter', useClass: StacksTxStreamAdapterService },
    { provide: 'MicroIndexers', useExisting: 'MicroIndexers'}
  ]
})
export class StacksIndexerModule {}