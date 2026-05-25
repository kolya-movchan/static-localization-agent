import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, "../../data/jobs.db"),

  gemini: {
    apiKey: required("GEMINI_API_KEY"),
    primaryModel: process.env.GEMINI_PRIMARY_MODEL ?? "gemini-2.0-flash-exp",
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-1.5-flash",
    agentModel: process.env.GEMINI_AGENT_MODEL ?? "gemini-1.5-flash",
  },

  gdrive: {
    serviceAccountPath: path.resolve(
      __dirname,
      "../..",
      required("GOOGLE_SERVICE_ACCOUNT_PATH"),
    ),
  },

  worker: {
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "3000", 10),
    rateLimitMs: parseInt(process.env.RATE_LIMIT_MS ?? "5000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? "2", 10),
  },
};
