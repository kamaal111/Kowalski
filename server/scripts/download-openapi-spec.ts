import fs from 'node:fs/promises';

import * as z from 'zod';
import { asserts } from '@kamaalio/kamaal';

const ArgsSchema = z.tuple([
  z
    .string()
    .nonempty()
    .refine(path => path.endsWith('.yaml'), 'Output file must have .yaml extension'),
  z.url(),
]);

async function downloadOpenAPISpec(serverUrl: string, outputFile: string) {
  const specUrl = `${serverUrl}/spec.yaml`;
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

  const rawData = await response.text();
  await fs.writeFile(outputFile, rawData, 'utf8');
  console.log(`✅ OpenAPI spec successfully downloaded to: ${outputFile}`);
}

let outputFile: string;
let serverUrl: string;
try {
  [outputFile, serverUrl] = ArgsSchema.parse(process.argv.slice(2));
} catch (error) {
  console.log('🐸🐸🐸 error', error);
  asserts.invariant(error instanceof z.ZodError);

  console.error('❌ Invalid arguments:');
  error.issues.forEach(issue => {
    const argName = issue.path.length > 0 ? `Argument ${Number(issue.path[0]) + 1}` : 'Arguments';
    console.error(`   ${argName}: ${issue.message}`);
  });
  console.error('Usage: tsx scripts/download-openapi-spec.ts <outputFile> <serverUrl>');
  process.exit(1);
}

await downloadOpenAPISpec(serverUrl, outputFile);
