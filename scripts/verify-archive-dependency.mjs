import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { unzipSync, strFromU8 } from 'fflate';

// Exercise the actual CLI archive dependency with the security override applied.
const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@poki/cli/package.json'));
const archiver = cliRequire('archiver');
const directory = await mkdtemp(resolve(tmpdir(), 'sdk-archive-check-'));
try {
  await mkdir(resolve(directory, 'nested'));
  await writeFile(resolve(directory, 'nested/file.txt'), 'archive regression');
  await writeFile(resolve(directory, 'nested/ignored.txt'), 'excluded');
  const destination = resolve(directory, 'verified.zip');
  await new Promise((resolveDone, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver('zip');
    output.on('close', resolveDone);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);
    archive.pipe(output);
    archive.glob('nested/**/*.txt', { cwd: directory, ignore: ['**/ignored.txt'] });
    void archive.finalize().catch(reject);
  });
  const contents = unzipSync(await readFile(destination));
  assert.deepEqual(Object.keys(contents), ['nested/file.txt']);
  assert.equal(strFromU8(contents['nested/file.txt']), 'archive regression');
  console.log('PASS actual Poki archive dependency: glob traversal, exclusions and ZIP contents.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
