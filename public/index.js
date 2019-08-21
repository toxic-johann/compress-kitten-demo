import imageCompression from './lib/browser-image-compression/index.js';

const startButton = document.getElementById('start');

startButton.addEventListener('click', () => {
  const kittenNumber = parseInt(document.getElementById('kittenNumber').value || 10);
  console.log();
});

let isRunning = false;

function loadImage (src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.crossOrigin = 'abc';
    img.src = src;
  });
}

const timeMap = {};
window.timeMap = timeMap;

async function main(number = 10, useWebWorker = true) {
  const originImages = await Promise.all(
    (new Array(number))
    .fill(0)
    .map((value, index) => loadImage(`https://loremflickr.com/1280/960/kitten?random=${index}`))
    );
  const canvases = await Promise.all(originImages.map(image => imageCompression.drawImageInCanvas(image)));
  console.log(canvases);
  const files = await Promise.all(canvases.map((canvas, index) => imageCompression.canvasToFile(canvas, 'image/jpeg', `${index}.jpeg`, new Date())));
  const s1 = Date.now();
  const compressedFiles = await Promise.all(files.map(file => imageCompression(file, {
    useWebWorker,
  })));
  const t1 = Date.now() - s1;
  timeMap[useWebWorker] = t1;
  const dataUrls = await Promise.all(compressedFiles.map(file => imageCompression.getDataUrlFromFile(file)));
  const images = await Promise.all(dataUrls.map(url => loadImage(url)));
}
main(1, true);
main(20, true);
main(20, false);