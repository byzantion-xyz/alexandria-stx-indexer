import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nearIndexerRunMissingUrl: "https://byz-universal-api-new.onrender.com/indexer/run-missing",
}));
