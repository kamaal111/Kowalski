export type BodyType = (typeof BODY_TYPES)[keyof typeof BODY_TYPES];

export const BODY_TYPES = { JSON: 'json' } as const;

export const MIME_TYPES = { APPLICATION_JSON: 'application/json' } as const;
