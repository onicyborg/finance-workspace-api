import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),

  JWT_EXPIRES_IN: Joi.alternatives()
    .try(
      Joi.number(),
      Joi.string().pattern(/^\d+[smhd]$/), // contoh: 1d, 7h, 30m
    )
    .required(),

  JWT_REFRESH_EXPIRES_IN: Joi.alternatives()
    .try(
      Joi.number(),
      Joi.string().pattern(/^\d+[smhd]$/), // contoh: 7d
    )
    .default('7d')
    .optional(),

  BCRYPT_SALT_ROUNDS: Joi.number().min(8).max(15).default(10),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  SMTP_FROM: Joi.string().required(),

  R2_ACCOUNT_ID: Joi.string().required(),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_BUCKET_NAME: Joi.string().required(),
});
