import assert from 'node:assert/strict';

import { ScreenManager } from '../dist/sdk.js';

const profiles = {
  land: { width: 960, height: 540, fit: 'height' },
  port: { width: 540, height: 960, fit: 'height' },
};
const window = new EventTarget();
globalThis.window = window;

function setViewport(width, height, dpr) {
  window.visualViewport = { width, height };
  window.devicePixelRatio = dpr;
}

function setup(config) {
  const resizeCalls = [];
  const point = { set() {} };
  const canvas = {
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, ...window.visualViewport }),
  };
  const renderer = {
    resolution: 1,
    resize(width, height, resolution) {
      this.resolution = resolution;
      resizeCalls.push([Math.round(width * resolution), Math.round(height * resolution)]);
    },
  };
  const app = { canvas, renderer, stage: { scale: point, pivot: point, position: point } };
  return { screen: new ScreenManager({
    canvas, get resolution() { return renderer.resolution; },
    resize(snapshot, resolution) {
      renderer.resize(snapshot.canvas.width, snapshot.canvas.height, resolution);
      canvas.style.width = `${snapshot.viewport.width}px`;
      canvas.style.height = `${snapshot.viewport.height}px`;
    },
  }, { ...profiles, ...config }), canvas, resizeCalls };
}

setViewport(640, 360, 2);
for (const [config, size] of [
  [{}, [960, 540]],
  [{ dpr: 1.5, maxDpr: 1 }, [1440, 810]],
  [{ dpr: 'auto', maxDpr: 1.25 }, [1200, 675]],
  [{ dpr: 'native' }, [1280, 720]],
]) {
  const { screen, resizeCalls } = setup(config);
  await screen.init();
  assert.deepEqual(resizeCalls, [size]);
  screen.destroy();
}

const budget = 1_500_000;
const { screen, canvas, resizeCalls } = setup({
  dpr: 'native',
  maxDpr: 2,
  render: { maxCanvasPixels: budget },
});
await screen.init();
assert.deepEqual(resizeCalls.at(-1), [1280, 720]);

for (const [width, height, dpr, expected] of [
  [836, 470, 2, [1633, 918]],
  [1031, 580, 2, [1632, 918]],
  [1920, 1080, 2, [1632, 918]],
  [380, 620, 3, [760, 1240]],
]) {
  setViewport(width, height, dpr);
  screen.updateFromWindow();
  assert.deepEqual(resizeCalls.at(-1), expected);
  assert.ok(expected[0] * expected[1] <= budget);
  assert.equal(canvas.style.width, `${width}px`);
  assert.equal(canvas.style.height, `${height}px`);
  assert.deepEqual(screen.toVirtual(width / 2, height / 2), screen.center);
}

setViewport(380, 620, 1);
screen.updateFromWindow();
assert.deepEqual(resizeCalls.at(-1), [380, 620]);
const count = resizeCalls.length;
screen.updateFromWindow();
assert.equal(resizeCalls.length, count);
screen.destroy();
assert.throws(() => setup({ render: { maxCanvasPixels: 0 } }), RangeError);

console.log('PASS: legacy DPR, viewport-native pixels, canvas budget, resize, and pointer mapping.');
