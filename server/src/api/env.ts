import * as z from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().gte(1000).lt(10_000).default(8080),
  DEBUG: z.coerce.boolean().default(false),
  DATABASE_URL: z.string(),
});

const env = EnvSchema.parse(process.env);

export default env;
