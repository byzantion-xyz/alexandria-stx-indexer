import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nearIndexerRunMissingUrl: "https://alexandria-indexer-near-prod-2.onrender.com/indexer/run-missing",
}));
