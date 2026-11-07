import { fileURLToPath } from 'node:url';
import { GameViteConfig } from '@gamedevland/vite';

export default ({ mode }: { mode: string }) => ({
  ...GameViteConfig.create({ mode, repoRoot: fileURLToPath(new URL('.', import.meta.url)) }),
  server: { open: false },
});
