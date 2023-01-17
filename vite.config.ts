import { defineConfig } from 'vite';
import { directoryPlugin } from 'vite-plugin-list-directory-contents';
/* eslint-disable */
// import { directoryPlugin } from '../../../Sites/vite-plugin-list-directory-contents/plugin';
import { exec } from 'node:child_process';

import fg from 'fast-glob';
import { stat } from 'node:fs/promises';

async function run(cmd: string, waitForText?: string) {
  return new Promise<void>((resolve) => {
    const process = exec(cmd);
    process.stdout
      ?.on('data', (data: string) => {
        if (waitForText && data.includes(waitForText)) {
          resolve();
        }
      })
      .on('close', resolve);
  });
}

type FileWithStats = {
  file: string;
  stats: Awaited<ReturnType<typeof stat>>;
}

async function getLastModifiedFile(fileGlob: string) {
  const files: string[] = await fg([fileGlob, '!**/node_modules/**']);
  const stats = await Promise.all(files.map((file) => stat(file)));
  const filesWithStats: FileWithStats[] = files.map((file, index) => ({ file, stats: stats[index] })).sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  return filesWithStats.at(0);
}

process.env.BROWSER = 'Firefox Developer Edition';

export default defineConfig(async () => {

  const [lastFile] = await Promise.all([
    getLastModifiedFile('**/*.html'),
    run('caddy stop').then(() => run('caddy start', 'Caddy is running')),
  ]);

  return {
    server: {
      port: 7777,
      host: 'localhost',
      open: `https://tips.localhost/${lastFile?.file}`,
    },
    plugins: [
      directoryPlugin({
        baseDir: __dirname,
      }),
    ],
  };
});
