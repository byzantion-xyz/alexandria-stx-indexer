import { registerAs } from "@nestjs/config";

export default registerAs("discord", () => ({
  universalServers: [
    { server_id: "937766102044385311", marketplace_name: ["few-and-far"] },
    { server_id: "894616090762678272", marketplace_name: ["all"]}
  ],
  enableActionsSubscription: process.env.ENABLE_ACTIONS_SUBSCRIPTION === 'true' || false
}));
