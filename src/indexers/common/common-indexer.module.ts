import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TxHelperService } from './helpers/tx-helper.service';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { NftState } from 'src/database/universal/entities/NftState';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { CollectionAttribute } from 'src/database/universal/entities/CollectionAttribute';
import { Chain } from 'src/database/universal/entities/Chain';
import { Commission } from 'src/database/universal/entities/Commission';
import { Collection } from 'src/database/universal/entities/Collection';
import { BidState } from 'src/database/universal/entities/BidState';
import { NftMetaAttribute } from 'src/database/universal/entities/NftMetaAttribute';
import { MegapontAttribute } from 'src/database/universal/entities/MegapontAttribute';
import { NftStateList } from 'src/database/universal/entities/NftStateList';
import { TxStakingHelper } from './helpers/tx-staking-helper';
import { TxBidHelperService } from './helpers/tx-bid-helper.service';
import { TxActionService } from './providers/tx-action.service';
import { SmartContractService } from './helpers/smart-contract.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftMeta,
      NftState,
      Action,
      SmartContract,
      SmartContractFunction,
      CollectionAttribute,
      Chain,
      Commission,
      Collection,
      BidState,
      NftMetaAttribute,
      MegapontAttribute,
      NftStateList
    ]),
  ],
  controllers: [],
  providers: [
    TxHelperService,
    TxStakingHelper,
    TxBidHelperService,
    TxActionService,
    SmartContractService,
  ],
  exports: [
    TypeOrmModule,
    TxHelperService,
    TxStakingHelper,
    TxBidHelperService,
    TxActionService,
    SmartContractService
  ]
})
export class CommonIndexerModule {}
