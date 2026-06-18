import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const declarationPath = resolve('dist/sdk.d.ts');
const declaration = await readFile(declarationPath, 'utf8');

const gsapImport = "import type { gsap } from 'gsap';";

if (!declaration.includes(gsapImport) && declaration.includes('gsap.')) {
  const lines = declaration.split('\n');
  const insertIndex = lines.findLastIndex((line) => line.startsWith('import ')) + 1;
  lines.splice(insertIndex, 0, gsapImport);
  await writeFile(declarationPath, `${lines.join('\n').trimEnd()}\n`);
}
