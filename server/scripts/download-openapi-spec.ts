import fs from 'node:fs/promises';

import * as z from 'zod';
import { asserts } from '@kamaalio/kamaal';

import { ensureSpecGenerationEnv } from '../src/api/spec-generation-env';

const ArgsSchema = z.tuple([
  z
    .string()
    .nonempty()
    .refine(path => path.endsWith('.yaml'), 'Output file must have .yaml extension'),
]);

async function downloadOpenAPISpec(outputFile: string) {
  ensureSpecGenerationEnv();
  const { generateOpenAPISpecYaml } = await import('../src/app');

  console.log('🔄 Generating OpenAPI spec from the server app...');
  const rawData = await generateOpenAPISpecYaml();
  await fs.writeFile(outputFile, rawData, 'utf8');
  console.log(`✅ OpenAPI spec successfully generated at: ${outputFile}`);
}

let outputFile: string;
try {
  [outputFile] = ArgsSchema.parse(process.argv.slice(2));
} catch (error) {
  console.log('🐸🐸🐸 error', error);
  asserts.invariant(error instanceof z.ZodError);

  console.error('❌ Invalid arguments:');
  error.issues.forEach(issue => {
    const argName = issue.path.length > 0 ? `Argument ${Number(issue.path[0]) + 1}` : 'Arguments';
    console.error(`   ${argName}: ${issue.message}`);
  });
  console.error('Usage: tsx scripts/download-openapi-spec.ts <outputFile>');
  process.exit(1);
}

await downloadOpenAPISpec(outputFile);
