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
});

export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
  CORS_ORIGINS?: string;
};
