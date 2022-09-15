import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  byzApiKey: "NHD82TD.b260a12f29b9faf6561763457fe37927",
  nearIndexerRunMissingUrl: "https://byz-universal-api-new.onrender.com/indexer/run-missing",
}));
