import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nearIndexerRunMissingUrl: "https://alexandria-indexer-near-prod-2.onrender.com/indexer/run-missing",
  stacksScrapeUrl: "https://byz-stacks-scraper-prod.onrender.com/run-scrape",
  runFixNearOwnership:  process.env.RUN_FIX_NEAR_OWNERSHIP === 'true' || false,
}));
