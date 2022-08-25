import { registerAs } from "@nestjs/config";

export default registerAs("discord", () => ({
  token: "OTQ1Njk0ODExMTI4NzU0MjA2.YhT47Q.YjzYBqiAa5SlSjJu5Tj6NjTIN68",
  universal_servers: [{ server_id: "937766102044385311", marketplace_name: "few-and-far" }],
}));
