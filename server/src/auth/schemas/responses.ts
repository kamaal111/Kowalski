import * as z from 'zod';

export const AuthResponseSchema = z
  .object({
    token: z.string().nonempty().openapi({
      description: 'Authentication token for the signed-in user',
      example: 'f21wcpz7Aokmlh2MB632MZpTgfruPc62',
    }),
  })
  .openapi('AuthResponse', {
    title: 'Authentication Response',
    description: 'Successful authentication response containing authentication token',
    example: { token: 'f21wcpz7Aokmlh2MB632MZpTgfruPc62' },
  });

export const SignOutResponseSchema = z
  .object({})
  .loose()
  .openapi('SignOutResponse', { title: 'Sign Out Response', description: 'Successful signout response' });

export const ErrorResponseSchema = z
  .object({
    message: z.string().openapi({ description: 'Error message' }),
    code: z.string().optional().openapi({ description: 'Error code' }),
  })
  .openapi('ErrorResponse', {
    title: 'Error Response',
    description: 'Error response containing error message and optional error code',
  });
