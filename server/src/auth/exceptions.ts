import { AuthError, AuthHttpError } from '@kamaalio/kamaal-auth-hono';

export class TokenIssuanceFailed extends AuthHttpError {
  constructor(requestId?: string) {
    super(
      new AuthError({
        status: 500,
        code: 'TOKEN_ISSUANCE_FAILED',
        message: 'Unable to issue an authentication token. Please try again later.',
        requestId,
      }),
    );
  }
}
