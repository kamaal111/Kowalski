import * as z from 'zod';

export type ServerMode = (typeof SERVER_MODES)[keyof typeof SERVER_MODES];

export const SERVER_MODES = {
  SERVER: 'SERVER',
  DAILY: 'DAILY',
} as const;

const EnvSchema = z
  .object({
    PORT: z.coerce.number().gte(1000).lt(10_000).default(8080),
    DEBUG: z.coerce.boolean().default(false),
    DATABASE_URL: z.string(),
    MODE: z.enum(Object.values(SERVER_MODES)).default(SERVER_MODES.SERVER),
    GCP_PROJECT_ID: z.string().nullish(),

    // Auth
    BETTER_AUTH_SECRET: z.string().nonempty(),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SESSION_UPDATE_AGE_DAYS: z.coerce.number().gte(1).optional().default(1),
    BETTER_AUTH_SESSION_EXPIRY_DAYS: z.coerce.number().gte(1).optional().default(30),
  })
  .superRefine((data, ctx) => {
    if (data.MODE === SERVER_MODES.DAILY && !data.GCP_PROJECT_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['GCP_PROJECT_ID'],
        message: 'GCP_PROJECT_ID is required when MODE is DAILY',
      });
    }
  });

const env = EnvSchema.parse(process.env);

export default env;
