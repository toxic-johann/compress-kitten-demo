import imageCompression from './lib/browser-image-compression/index.js';
import pako from './web_modules/pako-es.js';

const startButton = document.getElementById('start');

startButton.addEventListener('click', test);

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

async function getOriginImages(number) {
  const originImages = await Promise.all(
    (new Array(number))
    .fill(0)
    .map((value, index) => loadImage(`https://loremflickr.com/1280/960/kitten?random=${index}`))
    );
  return originImages;
}

async function getImageFiles(number = 10) {
  const originImages = await getOriginImages(number);
  const canvases = await Promise.all(originImages.map(image => imageCompression.drawImageInCanvas(image)));
  const files = await Promise.all(canvases.map((canvas, index) => imageCompression.canvasToFile(canvas, 'image/jpeg', `${index}.jpeg`, new Date())));
  return files;
}

function getImageArrayBuffersFromFiles(files) {
  return Promise.all(files.map(file => new Response(file).arrayBuffer()));
}

async function getImagesFromFiles(files) {
  const dataUrls = await Promise.all(files.map(file => imageCompression.getDataUrlFromFile(file)));
  const images = await Promise.all(dataUrls.map(url => loadImage(url)));
  return images;
}

async function compressFilesWithBrowserImageCompression(files, useWebWorker = true) {
  console.log(`start compressing ${files.length} image in ${useWebWorker ? 'worker' : 'mainthread'}`);
  const compressedFiles = await Promise.all(files.map(file => imageCompression(file, {
    useWebWorker,
  })));
  console.log(`finish compressing ${files.length} image in ${useWebWorker ? 'worker' : 'mainthread'}`);
  return compressedFiles;
}

class PakoWorker {
  constructor(number = 1) {
    const workers = (new Array(number)).fill('./pako-worker.js').map(url => new Worker(url));
    this.id = 0;
    this.callBackMap = {};
    workers.forEach(worker => {
      worker.addEventListener('message', event => {
        const { id, result } = event.data;
        this.callBackMap[id](result);
      });
    });
    this.workers = workers;
  }

  compress(data, transferable = true) {
    return new Promise(resolve => {
      const id = this.id++;
      this.callBackMap[id] = resolve;
      const index = id % this.workers.length;
      const worker = this.workers[index];
      if (transferable) {
        worker.postMessage({ id, data, transferable }, [ data ]);
      } else {
        worker.postMessage({ id, data, transferable });
      }
    });
  }

  destroy() {
    this.workers.forEach(worker => worker.terminate());
  }
}


const benchMarkTable = document.getElementById('benchmark-table');

async function test() {
  const kittenNumber = parseInt(document.getElementById('kittenNumber').value || 10);
  const workerNumber = parseInt(document.getElementById('workerNumber').value || 5)
  const pakoWorker = new PakoWorker(workerNumber);
  const tr = document.createElement('tr');
  benchMarkTable.appendChild(tr);
  const index = benchMarkTable.childElementCount;
  const td = document.createElement('td');
  td.innerText = index;
  tr.appendChild(td);

  const filesWithOneFile = await getImageFiles(1);
  const filesWithMultipleFiles = await getImageFiles(kittenNumber);
  

  var suite = new Benchmark.Suite;

  // add tests
  suite
  .add('compress 1 images in mainthread', {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithOneFile);
      const compressed = pako.deflate(arrayBuffers[0], { level: 3 });
      const result = pako.inflate(compressed);
      await (new Response(result).arrayBuffer());
      deferred.resolve();
    }
  })
  .add('compress 1 images in worker', {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithOneFile);
      await pakoWorker.compress(arrayBuffers[0]);
      deferred.resolve();
    }
  })
  .add('compress 1 images in worker without transferable', {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithOneFile);
      await pakoWorker.compress(arrayBuffers[0], false);
      deferred.resolve();
    }
  })
  .add(`compress ${kittenNumber} images in mainthread`, {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithMultipleFiles);
      arrayBuffers.forEach((arrayBuffer) =>{
        const compressed = pako.deflate(arrayBuffer, { level: 3 });
        const result = pako.inflate(compressed);
        new Response(result).arrayBuffer();
      });
      deferred.resolve();
    }
  })
  .add(`compress ${kittenNumber} images in worker`, {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithMultipleFiles);
      await Promise.all(arrayBuffers.map((arrayBuffer) =>{
        return pakoWorker.compress(arrayBuffer);
      }));
      deferred.resolve();
    }
  })
  .add(`compress ${kittenNumber} images in worker without transferable`, {
    defer: true,
    fn: async (deferred) => {
      const arrayBuffers = await getImageArrayBuffersFromFiles(filesWithMultipleFiles);
      await Promise.all(arrayBuffers.map((arrayBuffer) =>{
        return pakoWorker.compress(arrayBuffer, false);
      }));
      deferred.resolve();
    }
  })
  // add listeners
  .on('cycle', function(event) {
    const td = document.createElement('td');
    const name = event.target.name;
    const match = name.match(/\d+/);
    td.innerText = `[${match ? match[0]: 'Multiple'}] ${String(event.target).replace(name, '')}`;
    tr.appendChild(td);
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
    pakoWorker.destroy();
  })
  // run async
  .run({ 'async': true });
}

// async function cycle() {
//   const pakoWorker = new PakoWorker();
//   const files = await getImageFiles(1);
//   const arrayBuffers = await getImageArrayBuffersFromFiles(files);
//   arrayBuffers.forEach(rawBuffer => {
//     pakoWorker.compress(rawBuffer, (compressed) => {
//       console.error(compressed);
//       const result = pako.inflate(compressed);
//       const blob = new Blob([ result ], { type: 'image/jpeg' });
//       const url = window.URL.createObjectURL(blob);

//       const img = new Image(); 
//       img.src = url;
//       document.body.append(img);
//     })
//     // const uint8Array = new Uint8Array(rawBuffer);
//     // pakoWorker.postMessage({ id: 123 }, [ rawBuffer ]);
    
//     // const compressed = pako.deflate(uint8Array, { level: 3 });
//     // // const compressed = pako.gzip(uint8Array, { level:  });
//     // console.log(compressed.length, uint8Array.length, compressed.length / uint8Array.length);
    
//     // console.log(result, result.length);

    
//   });
//   // const compressedFiles = await compressFiles(files, true);
//   // const images = await getImagesFromFiles(compressFiles);
//   // images.forEach(image => document.body.append(image));
// }

// cycle();

// test(20);



