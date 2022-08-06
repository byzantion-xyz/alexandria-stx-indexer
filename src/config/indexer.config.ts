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
          token_id: 'id',
          seller: 'sender',
          buyer: 'recipient',
        },
      },
    ],
    Near: [],
  },
}));
