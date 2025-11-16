import * as z from 'zod';

export const ErrorResponseSchema = z
  .object({
    message: z.string().openapi({ description: 'Error message' }),
    code: z.string().optional().openapi({ description: 'Error code' }),
  })
  .openapi('ErrorResponse', {
    title: 'Error Response',
    description: 'Error response containing error message and optional error code',
  });
