import { pipeline } from '@xenova/transformers';

const classifier = await pipeline('image-classification', 'Xenova/facial_emotions_image_detection');

const video = document.querySelector<HTMLVideoElement>('video');
const canvas = document.querySelector<HTMLCanvasElement>('canvas');
const results = document.querySelector<HTMLDivElement>('.results');

async function populateVideo() {
  console.log(`Populating video`);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      height: {
        ideal: 250,
      },
    },
  });
  video.srcObject = stream;
  await video.play();
  // Size canvas to video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  // Start classification loop
  classify();
}

async function classify() {
  const start = performance.now();
  // Paint video to canvas
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  // convert image to base64 string
  const data = canvas.toDataURL('image/jpeg', 1);
  // Classify canvas
  console.log(`Classifying image`);
  const [result] = await classifier(data);

  // Calculate FPS
  const end = performance.now();
  const fps = end - start;
  // Update UI
  document.querySelector<HTMLDivElement>('.fps').innerText = `${result.label} - ${fps} ms`;
  // Inject div into results
  const div = document.createElement('div');
  div.innerHTML = `<img src="${data}" /><p>${result.label} - ${Math.round(result.score * 100)}%</p>`;
  results.prepend(div);
  requestAnimationFrame(classify);
}

populateVideo();
