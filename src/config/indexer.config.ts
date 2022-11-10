import { registerAs } from "@nestjs/config";

const NFT_EVENT_ARGS = {
  event_index: "event_index",
};

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Stacks",
  txResultExpiration: 120000,
  enableStreamerSubscription: process.env.ENABLE_STREAMER_SUBSCRIPTION === "true" || false,
  runPendingTransactions: process.env.RUN_PENDING_TRANSACTIONS === "true" || false,
  byzOldMarketplaceContractKeys: [
    "SP1BX0P4MZ5A3A5JCH0E10YNS170QFR2VQ6TT4NRH.byzantion-market-v6",
    "SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.byzantion-market-v5",
  ],
  genericFunctions: {
    Stacks: [
      {
        function_name: "nft_transfer_event",
        name: "nft_transfer_event",
        args: NFT_EVENT_ARGS,
      },
      {
        function_name: "nft_mint_event",
        name: "nft_mint_event",
        args: NFT_EVENT_ARGS,
      },
      {
        function_name: "nft_burn_event",
        name: "nft_burn_event",
        args: NFT_EVENT_ARGS,
      },
    ],
  },
  blockRanges: {
    Stacks: {
      start_block_height: 1,
      start_block_height_tip: 1,
      end_block_height: 85000,
      block_range: 1000,
    },
  },
}));
