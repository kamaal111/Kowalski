import fs from 'node:fs/promises';

import * as z from 'zod';
import { asserts } from '@kamaalio/kamaal';
import yaml from 'js-yaml';

const OpenAPIInfoSchema = z.object({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

const OpenAPISpecSchema = z
  .object({
    openapi: z.string(),
    info: OpenAPIInfoSchema,
    paths: z.record(z.string(), z.record(z.string(), z.unknown())),
    components: z.object({ schemas: z.record(z.string(), z.object().loose()) }).loose(),
  })
  .loose();

const ArgsSchema = z.tuple([
  z
    .string()
    .nonempty()
    .refine(path => path.endsWith('.yaml'), 'Output file must have .yaml extension'),
  z.url(),
]);

type OpenAPISpec = z.infer<typeof OpenAPISpecSchema>;

async function downloadOpenAPISpec(serverUrl: string, outputFile: string): Promise<OpenAPISpec> {
  const specUrl = `${serverUrl}/spec.json`;
  console.log(`🔄 Downloading OpenAPI spec from: ${specUrl}`);

  let response: Response;
  try {
    response = await fetch(specUrl);
  } catch (error) {
    asserts.invariant(error instanceof Error);
    console.error(`❌ Failed to download OpenAPI spec:`, error.message);
    if ('code' in error && error.code === 'ECONNREFUSED') {
      console.error(`💡 Make sure the server is running on ${serverUrl}`);
      console.error(`   You can start it with: npm run dev`);
    }

    process.exit(1);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawData: unknown = await response.json();
  const spec = await OpenAPISpecSchema.parseAsync(rawData);
  const transformedSpec = transformNullableToUnion(spec);
  const formattedSpec = yaml.dump(transformedSpec, { indent: 2 });
  await fs.writeFile(outputFile, formattedSpec, 'utf8');

  console.log(`✅ OpenAPI spec successfully downloaded to: ${outputFile}`);
  console.log(`📊 Spec info: ${spec.info?.title} v${spec.info?.version}`);
  if (spec.info?.description) {
    console.log(`📝 Description: ${spec.info.description}`);
  }
  const pathValues = Object.values(spec.paths);
  const endpointCount = pathValues.reduce((count, pathMethods) => {
    const methods = Object.keys(pathMethods);
    return count + methods.length;
  }, 0);

  console.log(`🛣️  Found ${endpointCount} endpoints across ${pathValues.length} paths`);

  return spec;
}

function transformNullableToUnion(obj: unknown): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(transformNullableToUnion);
  if (typeof obj !== 'object') return obj;
  return transformDefiniteObjectNullableToUnion(obj);
}

function transformDefiniteObjectNullableToUnion(obj: object): object {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const entryIsInvalidNullable =
      key === 'type' && typeof value === 'string' && 'nullable' in obj && obj.nullable === true;
    if (entryIsInvalidNullable) return { ...acc, type: [null, value] };

    const keyIsNullable = key === 'nullable';
    const shouldFilterOut = keyIsNullable;
    if (shouldFilterOut) return acc;

    return { ...acc, [key]: transformNullableToUnion(value) };
  }, {});
}

try {
  const [outputFile, serverUrl] = await ArgsSchema.parseAsync(process.argv.slice(2));
  await downloadOpenAPISpec(serverUrl, outputFile);
} catch (error) {
  asserts.invariant(error instanceof z.ZodError);

  console.error('❌ Invalid arguments:');
  error.issues.forEach(issue => {
    const argName = issue.path.length > 0 ? `Argument ${Number(issue.path[0]) + 1}` : 'Arguments';
    console.error(`   ${argName}: ${issue.message}`);
  });
  console.error('Usage: tsx scripts/download-openapi-spec.ts <outputFile> <serverUrl>');
  process.exit(1);
}
