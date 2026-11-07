import { parseArgs } from 'node:util';

import { PokiArchive } from '../poki/PokiArchive';
import { PokiProject } from '../poki/PokiProject';
import { PokiUpload } from '../poki/PokiUpload';
import { ProjectCreator } from '../project/ProjectCreator';

/** Public command-line interface; no dependency on a particular game layout. */
export class GamedevlandCli {
  static async run(argv: string[], cwd: string): Promise<void> {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
      help: { type: 'boolean', short: 'h' }, root: { type: 'string' },
      name: { type: 'string' }, notes: { type: 'string' },
      'no-install': { type: 'boolean', default: false },
    } });
    if (values.help || positionals.length === 0) {
      process.stdout.write('Usage: gamedevland create <directory> [--name <name>] [--no-install]\n       gamedevland poki <pack|upload> [--root <project>] [--name <version>] [--notes <text>]\ncreate generates a blank project and installs dependencies.\npack validates/packages an existing build; upload runs configured checks and a fresh build before uploading.\n');
      return;
    }
    if (positionals[0] === 'create' && positionals.length === 2 && positionals[1]) {
      await ProjectCreator.create({ cwd, directory: positionals[1], install: !values['no-install'],
        ...(values.name === undefined ? {} : { name: values.name }) });
      return;
    }
    if (positionals.length !== 2 || positionals[0] !== 'poki' || !['pack', 'upload'].includes(positionals[1] ?? '')) {
      throw new Error('[gamedevland] Expected create <directory>, poki pack or poki upload; use --help');
    }
    const project = PokiProject.load(values.root ?? cwd);
    if (positionals[1] === 'pack') {
      const archive = await PokiArchive.pack(project, process.env.POKI_UPLOAD_TOKEN);
      process.stdout.write(`[poki] ${project.archive}: ${archive.files} files, ${(archive.bytes / 1048576).toFixed(2)} MiB\n`);
    } else {
      await PokiUpload.run(project, { ...(values.name === undefined ? {} : { name: values.name }),
        ...(values.notes === undefined ? {} : { notes: values.notes }) });
    }
  }
}
