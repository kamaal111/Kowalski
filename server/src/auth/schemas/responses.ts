import * as z from 'zod';

export const AuthResponseSchema = z.object({}).loose();

export const SignOutResponseSchema = z.object({}).loose();

export const ErrorResponseSchema = z.object({
  message: z.string().openapi({ description: 'Error message' }),
  code: z.string().optional().openapi({ description: 'Error code' }),
});
