import { effect, signal } from '@preact/signals';

const recordButton = document.getElementById('record');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const video = document.querySelector<HTMLVideoElement>('video.webcam');
const webcamSelect = document.querySelector<HTMLSelectElement>('select#webcams');
const microphoneSelect = document.querySelector<HTMLSelectElement>('select#microphones');
const output = document.querySelector<HTMLDivElement>('.output');
const statusElement = document.getElementById('status');
const resolutionElement = document.getElementById('resolution');

// State
const count = signal(0);
const inputs = signal<MediaDeviceInfo[]>([]);
const hasPermission = signal(false);
const isRecording = signal(false);
const recordingState = signal<'idle' | 'accessing' | 'ready' | 'recording' | 'stopped'>('idle');
const currentResolution = signal<string>('Not available');

async function populateVideo(deviceId?: string) {
  if (!video) {
    return console.log('No video element found');
  }

  recordingState.value = 'accessing';
  console.log('Populating video');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // Conditionally set the deviceId with a spread
        ...(deviceId && { deviceId: { exact: deviceId } }),
        // frameRate: 30,
        // 4k
        // width: 3840,
        // height: 2160,
        width: { ideal: 4096 },
        height: { ideal: 2160 }
        // width: { ideal: 1920 },
        // height: { ideal: 1080 },

      },
      audio: true,
    });
    console.log('Stream', stream);
    console.log(stream.getVideoTracks().at(0)?.getSettings());

    // Attach event listener BEFORE setting srcObject
    video.addEventListener('loadedmetadata', () => {
      console.log('Loaded metadata');
      const resolution = `${video.videoWidth}x${video.videoHeight}`;
      console.log(`Playing at ${resolution}`);
      currentResolution.value = resolution;
    }, { once: true });

    video.srcObject = stream;
    await video.play();

    hasPermission.value = true;
    recordingState.value = 'ready';
  } catch (error) {
    console.error('Error accessing camera:', error);
    recordingState.value = 'idle';
    currentResolution.value = 'Not available';
  }
}

async function populateInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  // devices.forEach((device) => console.log(device.kind, device.label, device.getCapabilities()));
  inputs.value = devices;
}

function InputSelect() {
  if (webcamSelect) {
    webcamSelect.innerHTML = inputs.value
      .filter((input) => input.kind === 'videoinput')
      .map((input) => /* html */ `<option value="${input.deviceId}">${input.label}</option>`)
      .join('');
  }

  console.log('Inputs', inputs.value);
  if (microphoneSelect) {
    microphoneSelect.innerHTML = inputs.value
      .filter((input) => input.kind === 'audioinput')
      .map((input) => /* html */ `<option value="${input.deviceId}">${input.label}</option>`)
      .join('');
  }
}

effect(InputSelect);

// Resolution display management
function updateResolutionDisplay() {
  if (resolutionElement) {
    resolutionElement.textContent = `Resolution: ${currentResolution.value}`;
  }
}

effect(updateResolutionDisplay);

// UI State Management
function updateButtonVisibility() {
  const state = recordingState.value;

  // Button visibility
  if (startButton) {
    startButton.style.display = state === 'idle' ? 'block' : 'none';
  }

  if (recordButton) {
    recordButton.style.display = state === 'ready' ? 'block' : 'none';
  }

  if (stopButton) {
    stopButton.style.display = state === 'recording' ? 'block' : 'none';
  }

  // Device selectors visibility
  if (webcamSelect) {
    webcamSelect.style.display = (state === 'ready' || state === 'stopped') ? 'block' : 'none';
  }
  if (microphoneSelect) {
    microphoneSelect.style.display = (state === 'ready' || state === 'stopped') ? 'block' : 'none';
  }

  // Status updates
  if (statusElement) {
    // Remove all status classes
    statusElement.className = 'status';

    switch (state) {
      case 'idle':
        statusElement.textContent = 'Click "Give Access" to start';
        break;
      case 'accessing':
        statusElement.textContent = 'Requesting camera access...';
        statusElement.classList.add('accessing');
        break;
      case 'ready':
        statusElement.textContent = 'Ready to record!';
        statusElement.classList.add('ready');
        break;
      case 'recording':
        statusElement.textContent = 'Recording in progress...';
        statusElement.classList.add('recording');
        break;
      case 'stopped':
        statusElement.textContent = 'Recording saved!';
        statusElement.classList.add('stopped');
        break;
    }
  }
}

effect(updateButtonVisibility);

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
  if (!video) {
    return console.log('No video element found');
  }

  recordingState.value = 'recording';
  isRecording.value = true;

  if (!video.srcObject) {
    console.error('No video stream available');
    return;
  }

  const recorder = new MediaRecorder(video.srcObject as MediaStream, {
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
    recordingState.value = 'stopped';
    isRecording.value = false;

    const recordedBlob = new Blob(data, { type: mimeType });
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.${mimeType.split('/')[1]}`;
    a.textContent = a.download;
    if (output) {
      output.appendChild(a);
    }

    // Reset to ready state for another recording
    setTimeout(() => {
      recordingState.value = 'ready';
    }, 1000);
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

startButton?.addEventListener('click', () => populateVideo());
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
