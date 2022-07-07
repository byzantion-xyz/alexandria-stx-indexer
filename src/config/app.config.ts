import { registerAs } from "@nestjs/config";

export default registerAs('app', () => ({
  configureDiscordServerApiKey: process.env.CONFIGURE_DISCORD_SERVER_API_KEY,
  chainSymbol: process.env.CHAIN_SYMBOL
}));