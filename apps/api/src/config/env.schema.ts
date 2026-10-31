import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  CORS_ORIGINS: Joi.string().optional(),
  INGEST_RECEIPT_SIGNING_PRIVATE_KEY: Joi.string().base64().min(32).required(),
  INGEST_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(120),
  INGEST_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  AI_ENABLED: Joi.string().valid('true', 'false').default('true'),
  MODEL_API_KEY: Joi.string().allow('').optional(),
  META_BASE_URL: Joi.string().uri().default('https://api.meta.ai/v1'),
  META_MODEL: Joi.string().default('muse-spark-1.3'),
  META_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  META_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(2),
  META_MAX_TOKENS: Joi.number().integer().min(256).default(4096),
  META_CIRCUIT_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(3),
  META_CIRCUIT_COOLDOWN_MS: Joi.number().integer().min(1000).default(30000),
  AI_TENANT_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(30),
  AI_TENANT_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  AI_DAILY_COST_CAP_USD: Joi.number().min(0).default(5),
  AI_ESTIMATED_COST_USD: Joi.number().min(0).default(0.002),
});

export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
  CORS_ORIGINS?: string;
};
