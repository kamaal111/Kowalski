import z from 'zod';

function SingleArrayItemOptionalSchema<Item extends z.ZodType>(item: Item) {
  return z.array(item).min(1).nullish();
}

export type ForexItemExchangeRateECBResponse = z.infer<typeof ForexItemExchangeRateECBResponseSchema>;

const XMLTextNodeSchema = z.union([z.string(), z.object({ _: z.string() })]);

export const ForexItemExchangeRateECBResponseSchema = z.object({
  'cb:value': SingleArrayItemOptionalSchema(XMLTextNodeSchema),
  'cb:baseCurrency': SingleArrayItemOptionalSchema(XMLTextNodeSchema),
  'cb:targetCurrency': SingleArrayItemOptionalSchema(XMLTextNodeSchema),
});

export type ForexItemECPResponse = z.infer<typeof ForexItemECPResponseSchema>;

const ForexItemECPResponseSchema = z.object({
  'dc:date': SingleArrayItemOptionalSchema(z.string()),
  'cb:statistics': SingleArrayItemOptionalSchema(
    z.object({ 'cb:exchangeRate': SingleArrayItemOptionalSchema(ForexItemExchangeRateECBResponseSchema) }),
  ),
});

export const ForexECPResponseSchema = z.object({
  'rdf:RDF': z.object({ item: z.array(ForexItemECPResponseSchema).nullish() }).nullish(),
});
