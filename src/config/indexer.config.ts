import { registerAs } from "@nestjs/config";

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Near",
  genericFunctions: {
    Stacks: [
      {
        function_name: "transfer",
        name: "transfer",
        args: {
          token_id: 'token-id',
          seller: 'seller',
          buyer: 'buyer',
        },
      },
    ],
    Near: [],
  },
}));
