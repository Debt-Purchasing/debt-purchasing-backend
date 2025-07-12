import dotenv from "dotenv";
import { Config } from "../types";

// Load environment variables from .env file
dotenv.config();

/**
 * Get environment variable with optional default value
 * Throws error if required variable is missing
 */
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not found`);
  }
  return value;
};

/**
 * Get environment variable as number with default value
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;

  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(
      `Environment variable ${key} must be a valid number, got: ${value}`
    );
  }
  return num;
};

/**
 * Get environment variable as boolean with default value
 */
const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;

  const lowerValue = value.toLowerCase();
  if (lowerValue === "true") return true;
  if (lowerValue === "false") return false;

  throw new Error(
    `Environment variable ${key} must be 'true' or 'false', got: ${value}`
  );
};

/**
 * Get environment variable as array (comma-separated) with default value
 */
const getEnvArray = (key: string, defaultValue: string[] = []): string[] => {
  const value = process.env[key];
  if (!value) return defaultValue;

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * Validate MongoDB URI format
 */
const validateMongoURI = (uri: string): void => {
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("MongoDB URI must start with mongodb:// or mongodb+srv://");
  }
};

/**
 * Validate subgraph API URL format
 */
const validateSubgraphURL = (url: string): void => {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid subgraph API URL: ${url}`);
  }
};

// Build configuration object
export const config: Config = {
  // Server Configuration
  port: getEnvNumber("PORT", 3002),
  nodeEnv: getEnvVar("NODE_ENV", "development"),

  // MongoDB Configuration
  mongodb: {
    uri: (() => {
      const uri = getEnvVar(
        "MONGODB_URI",
        "mongodb://localhost:27017/debt_purchasing"
      );
      validateMongoURI(uri);
      return uri;
    })(),
    dbName: getEnvVar("MONGODB_DB_NAME", "debt_purchasing"),
  },

  // Subgraph Configuration
  subgraph: {
    apiUrl: (() => {
      const url = getEnvVar("SUBGRAPH_API_URL");
      validateSubgraphURL(url);
      return url;
    })(),
    apiKey: getEnvVar("SUBGRAPH_API_KEY", "dev_dummy_key"),
    backupUrls: (() => {
      const backupUrl1 = getEnvVar("SUBGRAPH_BACKUP_URL_1", "");
      const backupUrl2 = getEnvVar("SUBGRAPH_BACKUP_URL_2", "");
      const backupUrls = [backupUrl1, backupUrl2].filter(Boolean);

      // Validate backup URLs
      backupUrls.forEach((url) => {
        if (url) validateSubgraphURL(url);
      });

      return backupUrls;
    })(),
  },

  // Cache Configuration
  cache: {
    intervalSeconds: getEnvNumber("CACHE_INTERVAL_SECONDS", 30),
    enabled: getEnvBoolean("CACHE_ENABLED", true),
  },

  // API Configuration
  api: {
    rateLimitWindowMs: getEnvNumber("API_RATE_LIMIT_WINDOW_MS", 900000), // 15 minutes
    rateLimitMaxRequests: getEnvNumber("API_RATE_LIMIT_MAX_REQUESTS", 100),
  },

  // CORS Configuration
  cors: {
    origins: getEnvArray("CORS_ORIGINS", ["http://localhost:3000"]),
  },
};

// Log configuration on startup (excluding sensitive data)
if (config.nodeEnv === "development") {
  console.log("🔧 Configuration loaded:");
  console.log(`   Port: ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Database: ${config.mongodb.dbName}`);
  console.log(`   Cache enabled: ${config.cache.enabled}`);
  console.log(`   Cache interval: ${config.cache.intervalSeconds}s`);
  console.log(`   CORS origins: ${config.cors.origins.join(", ")}`);
  console.log(`   Subgraph URL: ${config.subgraph.apiUrl}`);
}

export default config;
