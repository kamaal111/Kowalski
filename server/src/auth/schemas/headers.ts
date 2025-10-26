import z from 'zod';

export const AuthenticationHeaders = z.object({
  authorization: z.string().openapi({
    description: 'Bearer token for authentication',
    example: 'Bearer f21wcpz7Aokmlh2MB632MZpTgfruPc62',
  }),
});

export const TokenHeaders = z.object({
  'set-auth-token': z.string().openapi({
    description: 'Authentication token set in response header',
    example: 'f21wcpz7Aokmlh2MB632MZpTgfruPc62',
  }),
  'set-auth-token-expiry': z.string().openapi({
    description: 'Token expiry time in seconds (as a string representing digits)',
    example: '604800',
  }),
});
