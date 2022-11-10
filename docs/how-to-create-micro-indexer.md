# How To: Create a micro-indexer for Alexandria STX Indexer

This guide decribes how to create and add a new micro-indexer into the Alexandria STX Indexer code.

## 1. Create Micro-Indexer Service

Open the project in your editor and generate the new micro-indexer service class/file. Let's say we want a micro-indexer called StakeIndexer. We create it using this NestJS CLI command as follows (please note the use of camel case for the name):

```
nest g service src/indexers/stacks-indexer/providers/stakeIndexer
```

## 2. Implement IndexerService interface

Open the file created above and add the text `implements IndexerService` after the class name, as follows:

```
export class StakeIndexerService implements IndexerService {
  ...
}
```

Next, apply the methods required by the IndexerService interface. This will look something like:

```
async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    return;
 };

async createAction(params: CreateActionTO): Promise<Action> {
  return;
};
```

Then code the logic in the functions created above. Refer to the already existing micro-indexer classes for examples on how this is done.

## 3. Inject the new micro-indexer service class into the module

Open the file called `stacks-indexer.module.ts` and add the new micro-indexer class name to the `microIndexers` array (as well the appropriate import at the top of the file).

```
const microIndexers = [
  ListIndexerService,
  UnlistIndexerService,
  BuyIndexerService,
  BidIndexerService,
  UnlistBidIndexerService,
  AcceptBidIndexerService,
  TxUpgradeHelperService,
  // NFT events
  NftTransferEventIndexerService,
  NftBurnEventIndexerService,
  NftMintEventIndexerService,
  // Add new micro-indexer here
];
```

Your new micro-indexer should be ready to test out inside the Alexandria STX Indexer.
