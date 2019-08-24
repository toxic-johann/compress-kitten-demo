import imageCompression from './index.js'
import compress from './image-compression.js'
import { getNewCanvasAndCtx } from './utils.js'

let cnt = 0
let imageCompressionLibUrl
let workerIndex = 0;
const workerCount = 1;

function createWorker (f) {
  return new Worker(URL.createObjectURL(new Blob([`(${f})()`])))
}

const workers = (new Array(workerCount)).fill(0).map(() => createWorker(() => {
  let scriptImported = false
  self.addEventListener('message', async (e) => {
    const { file, id, imageCompressionLibUrl, options } = e.data
    console.warn(data);
    try {
      if (!scriptImported) {
        // console.log('[worker] importScripts', imageCompressionLibUrl)
        importScripts(imageCompressionLibUrl)
        scriptImported = true
      }
      // console.log('[worker] self', self)
      const compressedFile = await imageCompression(file, options)
      self.postMessage({ file: compressedFile, id })
    } catch (e) {
      // console.error('[worker] error', e)
      self.postMessage({ error: e.message + '\n' + e.stack, id })
    }
  })
}));

function createSourceObject (str) {
  return URL.createObjectURL(new Blob([str], { type: 'application/javascript' }))
}

export function compressOnWebWorker (file, options) {
  return new Promise(async (resolve, reject) => {
    if (!imageCompressionLibUrl) {
      imageCompressionLibUrl = createSourceObject(`
    function imageCompression (){return (${imageCompression}).apply(null, arguments)}

    imageCompression.getDataUrlFromFile = ${imageCompression.getDataUrlFromFile}
    imageCompression.getFilefromDataUrl = ${imageCompression.getFilefromDataUrl}
    imageCompression.loadImage = ${imageCompression.loadImage}
    imageCompression.drawImageInCanvas = ${imageCompression.drawImageInCanvas}
    imageCompression.drawFileInCanvas = ${imageCompression.drawFileInCanvas}
    imageCompression.canvasToFile = ${imageCompression.canvasToFile}
    imageCompression.getExifOrientation = ${imageCompression.getExifOrientation}
    imageCompression.handleMaxWidthOrHeight = ${imageCompression.handleMaxWidthOrHeight}
    imageCompression.followExifOrientation = ${imageCompression.followExifOrientation}

    getDataUrlFromFile = imageCompression.getDataUrlFromFile
    getFilefromDataUrl = imageCompression.getFilefromDataUrl
    loadImage = imageCompression.loadImage
    drawImageInCanvas = imageCompression.drawImageInCanvas
    drawFileInCanvas = imageCompression.drawFileInCanvas
    canvasToFile = imageCompression.canvasToFile
    getExifOrientation = imageCompression.getExifOrientation
    handleMaxWidthOrHeight = imageCompression.handleMaxWidthOrHeight
    followExifOrientation = imageCompression.followExifOrientation

    getNewCanvasAndCtx = ${getNewCanvasAndCtx}
    
    CustomFileReader = FileReader
    
    CustomFile = File
    
    function _slicedToArray(arr, n) { return arr }

    function compress (){return (${compress}).apply(null, arguments)}
    `)
    }
    let id = cnt++

    const worker = workers[workerIndex];
    workerIndex = (workerIndex + 1) % workerCount

    function handler (e) {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler)
        if (e.data.error) {
          reject(new Error(e.data.error))
        }
        resolve(e.data.file)
      }
    }

    worker.addEventListener('message', handler)
    console.log(file);
    worker.postMessage({ id, imageCompressionLibUrl, options }, [ file ])
  })
}