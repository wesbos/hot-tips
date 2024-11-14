/* eslint-disable */
// import { pipeline } from '@xenova/transformers';

// // Create image classification pipeline
// const classifier = await pipeline('image-classification', 'Xenova/convnext-xlarge-384-22k-1k');

// // Classify an image
// console.log('Downloading image');
// const url = 'https://pbs.twimg.com/profile_images/877525007185858562/7G9vGTca_400x400.jpg';
// const output = await classifier(url, {
//   topk: 10,
// });
// console.log(output);

// import { readFile, writeFile } from 'fs/promises';
// import { FFmpeg } from '@ffmpeg.wasm/main';

// const ffmpeg = await FFmpeg.create({ core: '@ffmpeg.wasm/core-mt' });

// console.log('reading file');
// ffmpeg.fs.writeFile('wes.mp4', await readFile('./wes.mp4'));
// console.log('Running ffmpeg');
// await ffmpeg.run('-ss', '03:22', '-i', 'wes.mp4', `-frames:v`, `1`, `-q:v`, `2`, `ss-wes.jpg`);

// await writeFile('./ss-wes.jpg', ffmpeg.fs.readFile('ss-wes.jpg'));
// console.log('Done!');
//  ffmpeg -ss 00:01:22 -i wes.mp4 -frames:v 1 -q:v 2 output.jpg
//  ffmpeg -i wes.mp4 -vf fps=1/60 screenshot_%03d.png

// ffmpeg -ss 00:01:22 -i wes.mp4 -frames:v 1 -vf "scale=1000:-1" -q:v 2 output.jpg

import Ffmpeg from 'fluent-ffmpeg';
import pMap from 'p-map';
// 1. get the length of the video

async function getDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(file, (err: Error, data: { format: { duration: number } }) => {
      if (err) {
        reject(err);
      }
      const { duration } = data.format;
      resolve(Math.floor(duration));
    });
  });
}

const FILENAME = '674.mp4';

const duration = await getDuration(FILENAME);
const SCREENSHOT_COUNT = 500;
const SCREENSHOT_INTERVAL = Math.floor(duration / SCREENSHOT_COUNT);
// console.log({ SCREENSHOT_INTERVAL });
const timestamps = Array.from({ length: SCREENSHOT_COUNT }).map((_, i) => i * SCREENSHOT_INTERVAL);
// console.log(timestamps);

async function takeScreenshot({ file, timestamp }: { file: string; timestamp: number }) {
  return new Promise((resolve, reject) => {
    Ffmpeg()
      .input(FILENAME)
      .setStartTime(timestamp)
      .frames(1)
      .outputOptions('-vf', 'scale=350:-1')
      .outputOptions('-q:v', '2')
      .output(file)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

console.time('6 at once');
const results = await pMap(
  timestamps,
  async (timestamp) => {
    console.log(`Taking screenshot at ${timestamp}`);
    return takeScreenshot({
      file: `ss/output-${timestamp}.jpg`,
      timestamp,
    });
  },
  { concurrency: 6 }
  );
console.timeEnd('6 at once');
