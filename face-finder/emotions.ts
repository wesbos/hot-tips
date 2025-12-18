import { RawImage, pipeline } from '@xenova/transformers';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { readdir } from 'fs/promises';

const classifier = await pipeline('image-classification', 'Xenova/facial_emotions_image_detection');

const app = new Hono();

app.use('/ss/*', serveStatic({ root: './' }));

function emojiForEmotion(emotion: string) {
  switch (emotion) {
    case 'angry':
      return '😠';
    case 'disgust':
      return '🤢';
    case 'fear':
      return '😱';
    case 'happy':
      return '😄';
    case 'neutral':
      return '😐';
    case 'sad':
      return '😢';
    case 'surprise':
      return '😮';
    default:
      return '🤷‍♀️';
  }
}

app.get('/', async (c) => {
  console.time('classify');
  console.timeLog('classify', 'Loading list of images to classify');
  // 1. List all the images from the ss folder
  const imagePaths = (await readdir('./ss/wests')).filter((file) => file.endsWith('.jpg')).map((file) => `./ss/wests/${file}`);
  // 2. Read all the images
  console.timeLog('classify', 'Loading list of images to classify');
  const images = await Promise.all(imagePaths.map((path) => RawImage.read(path)));
  // 3. Classify all the images
  const output = await classifier(images);
  // 4. Fold the results into a single object
  const results = output.map((result, i) => ({ ...result, path: imagePaths[i] })).sort((a, b) => b.score - a.score) as {
    label: string;
    score: number;
    path: string;
  }[];
  console.log(results);
  return c.html(/* html */ `
    <div class="results">
      ${results
        .slice(0, 200) // Only show the top 200 results
        .map(
          (result) => `<div class="result">
          <img src="${result.path}" />
          <p>${emojiForEmotion(result.label)} ${result.label} — ${Math.round(result.score * 100)}%</p>
      </div>`
        )
        .join('')}
    </div>
    <style>${css}</style>
  `);
});

app.get('/preview', async (c) => {
  // 1. List all the images from the ss folder
  const imagePaths = (await readdir('./ss/wests')).filter((file) => file.endsWith('.jpg')).map((file) => `./ss/wests/${file}`);
  return c.html(/* html */ `
    <div class="results">
      ${imagePaths
        .map((image) => `<div class="result"><img src="${image}" title="${image}" /></div>`)
        .join('')}
    </div>
    <style>${css}</style>
  `);
});

const css = /* css */ `
  html {
    font-family: 'Geist';
    background: black;
    color: white;
  }
  .results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 5px;
  }
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  img {
    max-width: 100%;
  }
  p {
    margin: 0;
  }
`;

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`); // Listening on http://localhost:3000
});
