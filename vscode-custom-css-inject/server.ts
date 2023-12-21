import WebSocket, { WebSocketServer } from 'ws';
import { readFile, watch, writeFile } from 'fs/promises';
import { parseHTML } from 'linkedom';

const path = `/Applications/Visual Studio Code.app/Contents/Resources/app/out/vs/code/electron-sandbox/workbench/workbench.html`;

const customCSSId = 'wes-custom-css';

async function injectCSS() {
  const css = await readFile('./custom.css', 'utf-8');
  const workbench = await readFile(path, 'utf-8');
  const { document } = parseHTML(workbench);
  const existingStyleElement = document.querySelector(`style#${customCSSId}`);

  if (existingStyleElement) {
    console.log(`Updating existing style element`);
    existingStyleElement.innerHTML = css;
  } else {
    console.log(`Creating new style element`);
    const style = document.createElement('style');
    style.id = customCSSId;
    style.innerHTML = css;
    document.body.insertAdjacentElement('afterend', style);
  }

  // See if we need to update the JS as well
  const js = await readFile('./client.js', 'utf-8');
  const existingScriptElement = document.querySelector(`script#${customCSSId}`);
  if (!existingScriptElement) {
    console.log(`Creating new script element`);
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = customCSSId;
    script.innerHTML = js;
    document.body.insertAdjacentElement('afterend', script);
  }
  // Otherwise update the existing one
  else {
    console.log(`Updating existing script element`);
    existingScriptElement.innerHTML = js;
  }

  await writeFile(path, document.toString());
}

await injectCSS();

const wss = new WebSocketServer({ port: 5786 });
let ws: WebSocket;
wss.on('connection', (websocket: WebSocket) => {
  ws = websocket;
  console.log('New client connected');
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

async function watchFile() {
  // Watch for changes to the CSS file and update VS Code
  const ac = new AbortController();
  const { signal } = ac;
  // setTimeout(() => ac.abort(), 10000);
  const watcher = watch('./custom.css', { signal });
  for await (const event of watcher) {
    if (!ws) {
      console.log(`No client connected`);
      continue;
    }
    console.log(`${event.eventType}: ${event.filename} was modified!`);
    console.log(event);
    const css = await readFile('./custom.css', 'utf-8');
    ws.send(
      JSON.stringify({
        type: 'css',
        id: customCSSId,
        css,
      })
    );
    // await injectCSS();
  }
}

watchFile();
