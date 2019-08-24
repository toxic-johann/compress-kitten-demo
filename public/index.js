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

async function getImageFiles(number = 10) {
  const originImages = await Promise.all(
    (new Array(number))
    .fill(0)
    .map((value, index) => loadImage(`https://loremflickr.com/1280/960/kitten?random=${index}`))
    );
  const canvases = await Promise.all(originImages.map(image => imageCompression.drawImageInCanvas(image)));
  const files = await Promise.all(canvases.map((canvas, index) => imageCompression.canvasToFile(canvas, 'image/jpeg', `${index}.jpeg`, new Date())));
  return files;
}

async function getImagesFromFiles(files) {
  const dataUrls = await Promise.all(files.map(file => imageCompression.getDataUrlFromFile(file)));
  const images = await Promise.all(dataUrls.map(url => loadImage(url)));
  return images;
}

async function compressFiles(files, useWebWorker = true) {
  console.log(`start compressing ${files.length} image in ${useWebWorker ? 'worker' : 'mainthread'}`);
  const compressedFiles = await Promise.all(files.map(file => imageCompression(file, {
    useWebWorker,
  })));
  console.log(`finish compressing ${files.length} image in ${useWebWorker ? 'worker' : 'mainthread'}`);
  return compressedFiles;
}

async function test() {
  const files = await getImageFiles(20);

  var suite = new Benchmark.Suite;

  // add tests
  suite
  .add('compress 1 images in mainthread', {
    defer: true,
    fn(deferred) {
      const promise = compressFiles([files[0]], false);
      promise.then(() => {
        deferred.resolve();
      });
    }
  })
  .add('compress 20 images in worker', {
    defer: true,
    fn(deferred) {
      const promise = compressFiles([files[0]], true);
      promise.then(() => {
        deferred.resolve();
      });
    }
  })
  .add('compress 20 images in mainthread', {
    defer: true,
    fn(deferred) {
      const promise = compressFiles(files, false);
      promise.then(() => {
        deferred.resolve();
      });
    }
  })
  .add('compress 20 images in worker', {
    defer: true,
    fn(deferred) {
      const promise = compressFiles(files, true);
      promise.then(() => {
        deferred.resolve();
      });
    }
  })
  // add listeners
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  // run async
  .run({ 'async': true });
}

async function cycle() {
  const files = await getImageFiles(1);
  const compressedFiles = await compressFiles(files, true);
  const images = await getImagesFromFiles(compressFiles);
  images.forEach(image => document.body.append(image));
}

cycle();

// test();



