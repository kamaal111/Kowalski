import z from 'zod';

export const ApiCommonDatetimeSchema = z.iso.datetime({ offset: true });
