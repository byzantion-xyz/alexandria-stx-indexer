import { registerAs } from "@nestjs/config";

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Stacks",
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
      end_block_height: 80000,
      block_range: 10000,
    },
  },
}));
