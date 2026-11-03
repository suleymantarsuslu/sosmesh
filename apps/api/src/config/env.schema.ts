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
  TRUST_PROXY: Joi.string().allow('').optional(),
  AI_ENABLED: Joi.string().valid('true', 'false').default('false'),
  MODEL_API_KEY: Joi.string().allow('').optional(),
  META_BASE_URL: Joi.string().uri().default('https://api.meta.ai/v1'),
  META_MODEL: Joi.string().default('muse-spark-1.3'),
  META_TIMEOUT_MS: Joi.number().integer().min(1000).default(60000),
  META_REASONING_EFFORT: Joi.string().valid('minimal', 'low', 'medium', 'high').default('low'),
  META_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(2),
  META_MAX_TOKENS: Joi.number().integer().min(256).default(4096),
  META_CIRCUIT_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(3),
  META_CIRCUIT_COOLDOWN_MS: Joi.number().integer().min(1000).default(30000),
  AI_TENANT_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(30),
  AI_TENANT_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  AI_DAILY_BUDGET_USD: Joi.number().min(0).default(30),
  AI_TOTAL_BUDGET_USD: Joi.number().min(0).default(150),
  AI_ESTIMATED_COST_USD: Joi.number().min(0).default(0.002),
  META_ASR_MODEL: Joi.string().default('muse-voice-transcribe-1.0'),
  META_SAM_MODEL: Joi.string().default('sam-3.1'),
  MEDIA_STORAGE_DIR: Joi.string().default('/tmp/sosmesh-media'),
  MEDIA_ONLINE_MAX_IMAGE_BYTES: Joi.number().integer().min(1).default(15_728_640),
  MEDIA_ONLINE_MAX_AUDIO_BYTES: Joi.number().integer().min(1).default(52_428_800),
  MEDIA_ONLINE_MAX_AUDIO_SEC: Joi.number().integer().min(1).default(600),
  SOSMESH_SERVER_SOS_PRIVATE_KEY: Joi.string().base64().optional(),
  SOSMESH_SERVER_SOS_KEY_ID: Joi.string().optional(),
  AI_RECOMMENDATION_RATIONALE_ENABLED: Joi.string().valid('true', 'false').default('false'),
  RETENTION_JOB_ENABLED: Joi.string().valid('true', 'false').default('false'),
  RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS: Joi.string().allow('').optional(),
  OTEL_EXPORTER_OTLP_ENABLED: Joi.string().valid('true', 'false').default('false'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:4318/v1/traces'),
  OTEL_CONSOLE_EXPORT: Joi.string().valid('true', 'false').default('false'),
  METRICS_SCRAPE_AUTH: Joi.string().min(16).required(),
  SOSMESH_DISASTER_READ_ONLY_MODE: Joi.string()
    .valid('true', 'false')
    .default('false'),
  SOSMESH_BACKUP_ENCRYPTION_KEY_SECRET_NAME: Joi.string().default(
    'sosmesh-backup-aes256'
  ),
});

export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
  CORS_ORIGINS?: string;
};
