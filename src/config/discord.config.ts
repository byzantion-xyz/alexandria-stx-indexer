import { registerAs } from "@nestjs/config";

export default registerAs("discord", () => ({
  universal_servers: [{ server_id: "937766102044385311", marketplace_name: "few-and-far" }],
}));
