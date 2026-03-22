import * as z from 'zod';

import { ApiCommonDatetimeShape } from '@/schemas/common.js';

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
  .openapi('SignOutResponse', { title: 'Sign Out Response', description: 'Successful signout response' });

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const SessionResponseSchema = z
  .object({
    session: z.object({
      expires_at: ApiCommonDatetimeShape.openapi({
        description: 'Session expiration timestamp',
        example: '2025-10-12T12:08:28.382Z',
      }),
      created_at: ApiCommonDatetimeShape.openapi({
        description: 'Session creation timestamp',
        example: '2025-10-05T12:08:28.382Z',
      }),
      updated_at: ApiCommonDatetimeShape.openapi({
        description: 'Session last update timestamp',
        example: '2025-10-05T12:08:28.382Z',
      }),
    }),
    user: z.object({
      id: z.string().openapi({
        description: 'Unique identifier for the user',
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
      name: z.string().openapi({
        description: 'User full name',
        example: 'John Doe',
      }),
      email: z.email().openapi({
        description: 'User email address',
        example: 'john@apple.com',
      }),
      email_verified: z.boolean().openapi({
        description: 'Whether the user email has been verified',
        example: false,
      }),
      created_at: ApiCommonDatetimeShape.openapi({
        description: 'User account creation timestamp',
        example: '2025-10-05T12:08:28.374Z',
      }),
    }),
  })
  .openapi('SessionResponse', {
    title: 'Session Response',
    description: 'Session response containing session and user information',
    example: {
      session: {
        expires_at: '2025-10-12T12:08:28.382Z',
        created_at: '2025-10-05T12:08:28.382Z',
        updated_at: '2025-10-05T12:08:28.382Z',
      },
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@apple.com',
        email_verified: false,
        created_at: '2025-10-05T12:08:28.374Z',
      },
    },
  });
