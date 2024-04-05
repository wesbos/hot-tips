import { effect, signal } from '@preact/signals';

const recordButton = document.getElementById('record');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const video = document.querySelector<HTMLVideoElement>('video.webcam');
const review = document.querySelector<HTMLVideoElement>('video.review');
const webcamSelect = document.querySelector<HTMLSelectElement>('select#webcams');
const microphoneSelect = document.querySelector<HTMLSelectElement>('select#microphones');
const output = document.querySelector<HTMLDivElement>('.output');

// State
const count = signal(0);
const inputs = signal<MediaDeviceInfo[]>([]);

async function populateVideo(deviceId?: string) {
  if (!video) {
    return console.log('No video element found');
  }
  console.log('Populating video');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      // Conditionally set the deviceId with a spread
      ...(deviceId && { deviceId: { exact: deviceId } }),
      // frameRate: 30,
      // 4k
      // width: 3840,
      // height: 2160,
    },
    audio: true,
  });
  console.log(stream.getVideoTracks().at(0)?.getSettings());
  video.srcObject = stream;
  await video.play();
  console.log(`Playing at ${video.videoWidth}x${video.videoHeight}`);
}

async function populateInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  // devices.forEach((device) => console.log(device.kind, device.label, device.getCapabilities()));
  inputs.value = devices;
}

function InputSelect() {
  webcamSelect.innerHTML = inputs.value
    .filter((input) => input.kind === 'videoinput')
    .map((input) => /* html */ `<option value="${input.deviceId}">${input.label}</option>`);

  console.log('Inputs', inputs.value);
  microphoneSelect.innerHTML = inputs.value
    .filter((input) => input.kind === 'audioinput')
    .map((input) => /* html */ `<option value="${input.deviceId}">${input.label}</option>`);
}

effect(InputSelect);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMimeType() {
  const types = ['video/webm', 'video/mp4'];
  const supported = types.find((type) => MediaRecorder.isTypeSupported(type));
  if (!supported) {
    throw new Error('No supported mime type found');
  }
  console.log(`Supported type: ${supported}`);
  return supported;
}

const mimeType = getMimeType();

async function startRecording() {
  if (!video || !review) {
    return console.log('No video elements found');
  }
  const recorder = new MediaRecorder(video?.srcObject, {
    audioBitsPerSecond: 512000,
    videoBitsPerSecond: 7000000,
    mimeType,
  });

  const data: Blob[] = [];

  recorder.ondataavailable = (event) => {
    console.log('Data available', event);
    data.push(event.data);
  };

  recorder.onstop = (event) => {
    console.log('Recording stopped', event);
    const recordedBlob = new Blob(data, { type: mimeType });
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.${mimeType.split('/')[1]}`;
    a.textContent = a.download;
    output.appendChild(a);
  };

  recorder.onstart = (event) => {
    console.log('Recording started', event);
  };

  recorder.start();

  stopButton?.addEventListener(
    'click',
    () => {
      console.log('Stopping recording...');
      recorder.stop();
    },
    { once: true }
  );
}

startButton?.addEventListener('click', populateVideo);
recordButton?.addEventListener('click', startRecording);
populateVideo();
// firs time populate inputs
video?.addEventListener('loadedmetadata', populateInputs, { once: true });

webcamSelect?.addEventListener('input', (event) => {
  const target = event.target as HTMLSelectElement;
  const deviceId = target.value;
  console.log('Selecting webcam', deviceId);
  populateVideo(deviceId);
});
