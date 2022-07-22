import { registerAs } from "@nestjs/config";

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Near",
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
}));
