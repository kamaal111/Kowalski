import z from 'zod';

function SingleArrayItemOptionalShape<ItemShape extends z.ZodType>(item: ItemShape) {
  return z.array(item).min(1).nullish();
}

export type ForexItemExchangeRateECBResponse = z.infer<typeof ForexItemExchangeRateECBResponseSchema>;

export const ForexItemExchangeRateECBResponseSchema = z.object({
  'cb:value': SingleArrayItemOptionalShape(z.object({ _: z.string() })),
  'cb:baseCurrency': SingleArrayItemOptionalShape(z.object({ _: z.string() })),
  'cb:targetCurrency': SingleArrayItemOptionalShape(z.string()),
});

export type ForexItemECPResponse = z.infer<typeof ForexItemECPResponseSchema>;

const ForexItemECPResponseSchema = z.object({
  'dc:date': SingleArrayItemOptionalShape(z.string()),
  'cb:statistics': SingleArrayItemOptionalShape(
    z.object({ 'cb:exchangeRate': SingleArrayItemOptionalShape(ForexItemExchangeRateECBResponseSchema) }),
  ),
});

export const ForexECPResponseSchema = z.object({
  'rdf:RDF': z.object({ item: z.array(ForexItemECPResponseSchema).nullish() }).nullish(),
});
