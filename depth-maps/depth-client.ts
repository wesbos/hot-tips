import { DepthEstimationPipeline, DepthEstimationPipelineOutput, RawImage, pipeline, env } from '@xenova/transformers';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  WebGLRenderer,
} from 'three';


env.allowLocalModels = false;
env.useBrowserCache = false;
const DEFAULT_SCALE = 0.75;
const fileUpload = document.getElementById('upload');
const imageContainer = document.getElementById('container');
const depthEl = document.querySelector<HTMLInputElement>('#depth');
const mapDisplayEl = document.querySelector<HTMLImageElement>('.map');

const webcamCanvas = document.querySelector<HTMLCanvasElement>('canvas.webcam');
const webcamVideo = document.querySelector<HTMLVideoElement>('video.webcam');
const webcamButton = document.querySelector<HTMLButtonElement>('.getWebcam');

async function populateCamera() {
  if (!webcamVideo || !webcamCanvas) return;
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  webcamVideo.srcObject = stream;
  await webcamVideo.play();
  console.log('webcamVideo', webcamVideo);
  webcamCanvas.width = webcamVideo.videoWidth;
  webcamCanvas.height = webcamVideo.videoHeight;
  draw();
}
function draw() {
  if (!webcamVideo || !webcamCanvas) return;
  const ctx = webcamCanvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
  requestAnimationFrame(draw);
}

async function detectFromWebcam() {
  if (!webcamVideo || !webcamCanvas) return;
  const ctx = webcamCanvas.getContext('2d');
  if (!ctx) return;
  // const dataURL = webcamCanvas.toDataURL();
  webcamCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    console.log(url);
    predict(url);
  });
}

webcamButton?.addEventListener('click', detectFromWebcam);
populateCamera();

console.log('Loading model...');
// Transformers.js
const depthEstimator = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf');

console.log('Loaded model');

fileUpload?.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const fileReader = new FileReader();
  fileReader.addEventListener('load', (fileReaderEvent) => {
    if (!fileReaderEvent.target?.result) return;
    predict(fileReaderEvent.target.result as string);
  });
  fileReader.readAsDataURL(file);
});

let onSliderChange: typeof HTMLInputElement.prototype.onchange;


console.debug(`[vite] connecting`);
async function predict(imageURL: string) {
  document.body.classList.add('loading');
  if (!imageContainer || !depthEl) return;
  const image = await RawImage.fromURL(imageURL);
  const scene = setupScene(imageURL, image.width, image.height);
  if (!scene) return;
  const { canvas, setDisplacementMap } = scene;
  imageContainer.append(canvas);
  // const smallerImage = await image.resize(512, 512);
  console.time('depthEstimator');

  console.log('Loading...', document.body.classList);
  // This is a blocking call, better to throw in a web worker
  const { depth } = (await depthEstimator(image)) as DepthEstimationPipelineOutput;
  console.timeEnd('depthEstimator');
  // This is a depth Tensor
  console.dir(depth);
  setDisplacementMap(depth.toCanvas() as OffscreenCanvas);
  document.body.classList.remove('loading');
  const url = URL.createObjectURL((await depth.toBlob()) as Blob);
  mapDisplayEl.src = url;

  depthEl.addEventListener('input', (l) => {
    onSliderChange(parseFloat(l.target.value));
  });
  depthEl.defaultValue = DEFAULT_SCALE.toString();
}

let mapMesh: MeshStandardMaterial;

const number_of_images = 229;
const screenshots = Array.from({ length: number_of_images }, (_, i) => `./video-screens/SS/screenshot${String(i + 1).padStart(3, '0')}.png`);
const depth = Array.from({ length: number_of_images }, (_, i) => `./video-screens/SS/depth${String(i + 1).padStart(3, '0')}.png`);

function loadTextures() {
  const maps = screenshots.map(file => {
    const map = new TextureLoader().load(file);
    return map;
  })
  return maps;
}

const photoTextures = loadTextures();
const depthTextures = depth.map(file => {
  const img = new Image();
  img.src = file;
  return new CanvasTexture(img);
});

function setupScene(s: string, imageWidth: number, imageHeight: number) {
  if (!imageContainer) return;
  imageContainer.innerHTML = '';
  const canvasEl = document.createElement('canvas');
  canvasEl.classList.add('viewer');
  const { offsetWidth: canvasWidth, offsetHeight: canvasHeight } = imageContainer;
  canvasEl.width = canvasWidth;
  canvasEl.height = canvasHeight;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, imageWidth / imageHeight, 0.01, 10);
  camera.position.z = 2;
  scene.add(camera);
  const p = new WebGLRenderer({ canvas: canvasEl, antialias: true });
  p.setSize(imageWidth, imageHeight);
  p.setPixelRatio(window.devicePixelRatio);
  const light = new AmbientLight(16777215, 2);
  scene.add(light);
  const map = new TextureLoader().load(s);
  // const map = new TextureLoader().load('./video-screens/SS/screenshot001.png');
  map.colorSpace = SRGBColorSpace;
  const i = new MeshStandardMaterial({ map, side: DoubleSide });
  mapMesh = i;
  i.displacementScale = DEFAULT_SCALE;
  // Wire Mesh

  let index = 0;
  const next = () => {
    console.log('Updating map', index, photoTextures.length);
    index++;
    if (index >= photoTextures.length) index = 0;
    // Update Image
    i.map = photoTextures[index];
    i.displacementMap = depthTextures[index];
    i.needsUpdate = true;
    requestAnimationFrame(next);
  };
  // Uncomment for video update. I didnt put the video thumbs in the repo because they are huge
  // next();

  const setDisplacementMap = (canvas: OffscreenCanvas) => {
    console.log(`setDisplacementMap`, canvas);
    i.displacementMap = new CanvasTexture(canvas);
    i.needsUpdate = true;
  };
  onSliderChange = (scale) => {
    i.displacementScale = scale;
    i.needsUpdate = true;
  };
  const [u, m] = imageWidth > imageHeight ? [1, imageHeight / imageWidth] : [imageWidth / imageHeight, 1];
  const geometry = new PlaneGeometry(u, m, imageWidth, imageHeight);
  const mesh = new Mesh(geometry, i);
  scene.add(mesh);

  const controls = new OrbitControls(camera, p.domElement);
  controls.enableDamping = true;
  p.setAnimationLoop(() => {
    p.render(scene, camera);
    controls.update();
  });
  window.addEventListener('resize', () => {
    camera.aspect = imageContainer.offsetWidth / imageContainer.offsetHeight;
    camera.updateProjectionMatrix();
    p.setSize(imageContainer.offsetWidth, imageContainer.offsetHeight);
  });
  return { canvas: p.domElement, setDisplacementMap };
}

export {};
