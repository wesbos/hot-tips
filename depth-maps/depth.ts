import { RawImage, pipeline } from '@xenova/transformers';

// Create depth-estimation pipeline
const depthEstimator = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf');

// Get all files from the SS folder
import fs from 'fs';
import path from 'path';
const folder = './video-screens/SS';
const files = fs.readdirSync(folder).filter(file => file.startsWith('screenshot') && file.endsWith('.png')).map((file: string) => path.join(folder, file));
console.log(files);


function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ffmpeg -i wes-small.mp4 -vf "fps=5" SS/screenshot%03d.png
for(const file of files) {
  console.log('Processing', file);
  const image = await RawImage.fromURL(file);
  const number = file.split('/').pop().split('.').shift()?.replace('screenshot', '');
  const output = await depthEstimator(image);
  console.log(output);
  output.depth.save(`./video-screens/SS/depth${number}.png`);
  // output[0].save(`./video-screens/SS/depth${number}.png`);
  // output.save(`./video-screens/SS/depth${number}.png`);
}

// Predict depth map for the given image
// const url = 'jen.png';
// console.time('depth');

// console.timeEnd('depth');

// output.depth.save(`depth-${Date.now()}.png`);
