import { defineConfig } from 'vite';
import { directoryPlugin } from 'vite-plugin-list-directory-contents';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

async function run(cmd: string, waitForText?: string) {
  return new Promise<void>(function(resolve) {
    const process = exec(cmd);
    process.stdout.on('data', function(data) {
      if (waitForText && data.includes(waitForText)) {
        resolve();
      }
    }).on('close', resolve);
  });
}

process.env.BROWSER = 'Firefox Developer Edition';

export default defineConfig(async () => {
  await run('caddy stop');
  await run('caddy start', 'Caddy is running');
  return {
    server: {
      port: 7777,
      host: 'localhost',
      open: 'https://tips.localhost'
    },
    plugins: [
      directoryPlugin({ baseDir: __dirname })
    ],
  }

});
