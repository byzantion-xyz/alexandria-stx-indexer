import { registerAs } from "@nestjs/config";

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Near",
  byzOldMarketplaceContractKeys: [
    'SP1BX0P4MZ5A3A5JCH0E10YNS170QFR2VQ6TT4NRH.byzantion-market-v6',
    'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.byzantion-market-v5'
  ],
  genericFunctions: {
    Stacks: [
      {
        function_name: "transfer",
        name: "transfer",
        args: {
          token_id: 0,
          seller: 1,
          buyer: 2,
        },
      },
    ],
    Near: [],
  },
  blockRanges: {
    Stacks: {
      start_block_height: 1,
      start_block_height_tip: 1,
      end_block_height:  80000,
      block_range: 10000
    },
    Near: {
      start_block_height: 42000000,
      start_block_height_tip: 63000000,
      end_block_height: 75000000,
      block_range: 100000
    }
  }
}));
