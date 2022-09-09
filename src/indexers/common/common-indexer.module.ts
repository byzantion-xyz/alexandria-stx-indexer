import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TxHelperService } from './helpers/tx-helper.service';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { NftState } from 'src/database/universal/entities/NftState';
import { Action } from 'near-api-js/lib/transaction';
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
import { TxStakingHelperService } from './helpers/tx-staking-helper.service';
import { TxBidHelperService } from './helpers/tx-bid-helper.service';

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
    TxStakingHelperService,
    TxBidHelperService,
  ],
  exports: [
    TypeOrmModule,
    TxHelperService,
    TxStakingHelperService,
    TxBidHelperService
  ]
})
export class CommonIndexerModule {}
