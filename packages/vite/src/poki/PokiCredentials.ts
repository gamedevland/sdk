import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Resolves a per-game secret outside the project or from the CI environment. */
export class PokiCredentials {
  static resolve(gameId: string): string {
    const envToken = process.env.POKI_UPLOAD_TOKEN;
    if (envToken !== undefined) {
      if (!envToken.trim()) throw new Error('[poki] POKI_UPLOAD_TOKEN must not be empty');
      return envToken.trim();
    }
    const file = path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'poki', 'game-upload-tokens', gameId);
    try {
      if (process.platform !== 'win32' && (statSync(file).mode & 0o777) !== 0o600) {
        throw new Error('permissions');
      }
      const token = readFileSync(file, 'utf8').trim();
      if (!token) throw new Error('empty');
      return token;
    } catch {
      throw new Error(`[poki] Set POKI_UPLOAD_TOKEN or create a private (0600) token file: ${file}`);
    }
  }

  static withoutSecrets(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.POKI_UPLOAD_TOKEN;
    delete env.POKI_ACCESS_TOKEN;
    delete env.API_PATH;
    return env;
  }
}
