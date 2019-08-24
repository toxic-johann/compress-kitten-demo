importScripts('./web_modules/pako.js');

self.addEventListener('message', async (event) => {
  const { id, data, transferable } = event.data;
  const compressed = pakoEs.deflate(data, { level: 3 });
  const arr = pakoEs.inflate(compressed);
  const blob = new Blob([ arr ], { type: 'image/jpeg' });
  const result = await (new Response(blob).arrayBuffer());
  if (transferable) {
    self.postMessage({ id, result }, [ result ]);
  } else {
    self.postMessage({ id, result, transferable });
  }
});