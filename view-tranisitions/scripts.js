const vid = document.querySelector(`video.preview`);
// const canvas = document.querySelector(`canvas`);
// const canvasSquare = document.querySelector(`canvas.square`);
// const ctx = canvas.getContext(`2d`);

const videos = document.querySelectorAll(`video.output`);
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
});
// vid.srcObject = stream;
videos.forEach((video) => {
  video.srcObject = stream;
  video.play();
});

vid.play();

// function paintToCanvas() {
//   const width = vid.videoWidth;
//   const height = vid.videoHeight;
//   canvas.width = width;
//   canvas.height = height;

//   ctx.drawImage(vid, 0, 0, width, height);
//   // canvas.toBlob((blob) => {
//   //   const url = URL.createObjectURL(blob);
//   //   console.log(url);
//   // });
//   // const url = canvas.toDataURL();
//   // document.querySelectorAll(`.output`).forEach((el) => {
//   //   el.src = url;
//   // });
//   // console.log(url);
//   document.documentElement.style.setProperty(`--background`, `url(${url})`);
//   // const imageData = ctx.getImageData(0, 0, width, height);

//   //   const squareSize = Math.floor(width / 4);

//   //   for (let y = 0; y < 4; y++) {
//   //     for (let x = 0; x < 4; x++) {
//   //       canvasSquare.width = squareSize;
//   //       canvasSquare.height = squareSize;
//   //       const ctxSquare = canvasSquare.getContext(`2d`);
//   //       ctxSquare.putImageData(ctx.getImageData(x * squareSize, y * squareSize, squareSize, squareSize), 0, 0);
//   //       const url = canvasSquare.toDataURL();
//   //       // squares.push();
//   //     }
//   //   }
//   //   // Done
// }

// setInterval(paintToCanvas, 16);
