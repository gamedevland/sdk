#!/usr/bin/env node
import { GamedevlandCli } from './GamedevlandCli';

class GamedevlandCliEntry {
  static async main(): Promise<void> {
    try { await GamedevlandCli.run(process.argv.slice(2), process.cwd()); }
    catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : '[gamedevland] Command failed'}\n`);
      process.exitCode = 1;
    }
  }
}

void GamedevlandCliEntry.main();
