const video = document.querySelector<HTMLVideoElement>('video');

const stream = await navigator.mediaDevices.getUserMedia({ video: true });
video.srcObject = stream;
video.play();
