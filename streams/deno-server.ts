/* eslint-disable*/
import { serve } from 'https://deno.land/std/http/mod.ts';
import { StreamResponse } from 'https://deno.land/x/stream_response@v0.1.0-pre.4/index.ts';

async function handle(req: Request) {

  return new StreamResponse(streamText(), {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
serve(handle, { port: 8888 });

async function* streamText() {
  console.log('Request Started!');
  let count = 0;
  while (count++ < 10) {
    const text = `Streamy chunk ${count}<br>`;
    console.log('Sending:', text);
    yield text;
    await sleep(500);
  }
  console.log('Request Finished');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
