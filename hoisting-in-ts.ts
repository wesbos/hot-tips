const webcam = document.querySelector<HTMLVideoElement>('.webcam');

webcam.videoHeight;

if(!webcam) throw new Error('No webcam found');

webcam.videoHeight;

// function declaration - hoisted
function one(webcam: HTMLVideoElement) {
  console.log(webcam.videoHeight);
  two(webcam);
}

// function expression - not hoisted
function two(webcam: HTMLVideoElement) {
  console.log(webcam.videoWidth);
}

// Arrow function expressions - not hoisted
const three = (webcam: HTMLVideoElement) => {
  console.log(webcam.videoWidth);
}

function go() {
  if(!webcam) throw new Error('No webcam found');
  one(webcam);
}



export {}
