/* eslint-disable */

type Locals = Record<string, any>;
type RenderCallback = (err: Error | null, rendered?: string) => void;

import { build, InlineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import  { runInNewContext } from 'vm';

export async function svelteViewEngine(filePath: string, locals: Locals, callback: RenderCallback) {
  const config: InlineConfig = {
    build: {
      ssr: filePath,
      rollupOptions: {
        output: { format: 'iife' }
      }
    },
    plugins: [svelte()]
  };
  // @ts-ignore shh
  const { output } = await build(config);
  const { code } = output.at(0);
  const { settings, ...props } = locals;
  const html = runInNewContext(code).$$render({}, props, {}, {});
  return callback(null, html);
}
