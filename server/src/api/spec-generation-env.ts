export const SPEC_GENERATION_ENV_DEFAULTS = {
  DATABASE_URL: 'postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski',
  BETTER_AUTH_SECRET: 'openapi-spec-generation-secret-2026',
  BETTER_AUTH_URL: 'http://localhost:8080',
} as const;

export function ensureSpecGenerationEnv(env: NodeJS.ProcessEnv = process.env) {
  Object.entries(SPEC_GENERATION_ENV_DEFAULTS).forEach(([key, value]) => {
    env[key] ??= value;
  });
}
