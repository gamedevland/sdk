import { spawn } from 'node:child_process';

import { PokiCredentials } from './PokiCredentials';

/** Runs npm tasks and captures CLI output without shell-interpolated arguments. */
export class PokiProcess {
  static async script(root: string, name: string): Promise<void> {
    const npmEntry = process.env.npm_execpath;
    const command = npmEntry ? process.execPath : 'npm';
    const args = npmEntry ? [npmEntry, 'run', name] : ['run', name];
    await PokiProcess.capture(command, args, root, PokiCredentials.withoutSecrets(), true);
  }

  static capture(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv, inherit = false, secret?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], { cwd, env, stdio: inherit ? 'inherit' : 'pipe',
        shell: process.platform === 'win32' && command === 'npm' });
      let output = '';
      const timer = inherit ? undefined : setTimeout(() => child.kill('SIGKILL'), 180000);
      const capture = (data: Buffer): void => { output += data.toString('utf8'); };
      child.stdout?.on('data', capture);
      child.stderr?.on('data', capture);
      child.once('error', () => { if (timer) clearTimeout(timer); reject(new Error('[poki] Could not start required tool')); });
      child.once('close', code => {
        if (timer) clearTimeout(timer);
        const safe = secret ? output.replaceAll(secret, '[REDACTED]') : output;
        if (!inherit) process.stdout.write(safe);
        if (code !== 0) reject(new Error(`[poki] Tool exited with status ${code ?? 'signal'}`));
        else resolve(safe);
      });
    });
  }
}
