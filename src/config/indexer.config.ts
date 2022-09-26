import { registerAs } from "@nestjs/config";

export default registerAs("indexer", () => ({
  chainSymbol: process.env.CHAIN_SYMBOL || "Near",
  txResultExpiration: 60000,
  enableStreamerSubscription: process.env.ENABLE_STREAMER_SUBSCRIPTION === 'true' || false,
  runPendingTransactions: process.env.RUN_PENDING_TRANSACTIONS === 'true' || false,
  byzOldMarketplaceContractKeys: [
    "SP1BX0P4MZ5A3A5JCH0E10YNS170QFR2VQ6TT4NRH.byzantion-market-v6",
    "SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.byzantion-market-v5",
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
    Near: [
      {
        function_name: "nft_transfer_event",
        name: "nft_transfer_event",
        args: {
          "seller": "old_owner_id",
          "buyer": "new_owner_id",
          "token_ids": "token_ids",
          "authorized_id": "authorized_id"
        }
      },
      {
        function_name: 'nft_mint_event',
        name: 'nft_mint_event',
        args: {
          "owner": "owner_id",
          "token_ids": "token_ids"
        }
      },
      {
        function_name: "nft_burn_event",
        name: 'nft_burn_event',
        args: {
          "token_ids": "token_ids",
          "owner": "owner_id"
        }
      }, 
      {
        function_name: 'nft_approve',
        name: 'list',
        args: {
          price: "msg.price",
          token_id: "token_id",
          list_action: "msg.market_type",
          contract_key: "account_id",
          token_price: "msg.sale_conditions.near",
          buyer: "msg.buyer_id"
        },
      },
      {
        function_name: 'nft_revoke',
        name: 'unlist',
        args: { 
          token_id: "token_id", 
          contract_key: "account_id" 
        },
      },
      {
        function_name: 'nft_transfer_call',
        name: 'stake',
        args: { 
          token_id: "token_id", 
          contract_key: "receiver_id", 
          action: "msg" 
        }
      }
    ]
  },
  blockRanges: {
    Stacks: {
      start_block_height: 1,
      start_block_height_tip: 1,
      end_block_height: 77228,
      block_range: 1000,
    },
    Near: {
      start_block_height: 42000000,
      start_block_height_tip: 42000000,
      end_block_height: 74935500,
      block_range: 100000,
    },
  },
}));
