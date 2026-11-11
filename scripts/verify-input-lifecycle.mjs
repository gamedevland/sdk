import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

class InputLifecycleVerification {
  async run() {
    const root = resolve(import.meta.dirname, '..');
    const temporary = mkdtempSync(resolve(root, '.input-check-'));
    try {
      const output = resolve(temporary, 'input.mjs');
      await build({ entryPoints: [resolve(root, 'packages/engine/src/input/InputManager.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm', tsconfig: resolve(root, 'packages/engine/tsconfig.json') });
      const { InputManager } = await import(pathToFileURL(output).href);
      const canvas = new EventTarget();
      const captures = new Set();
      canvas.setPointerCapture = id => captures.add(id);
      canvas.hasPointerCapture = id => captures.has(id);
      const send = (type, id, extra = {}) => {
        const event = new Event(type);
        Object.assign(event, { pointerId: id, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: id === 1, clientX: 40, clientY: 50, ...extra });
        canvas.dispatchEvent(event);
      };
      canvas.releasePointerCapture = id => { captures.delete(id); send('lostpointercapture', id); };
      let overButton = true;
      const runtime = {
        screen: { toVirtual: (x, y) => ({ x, y }) },
        rendering: { createHitTester: () => ({ hitTest: () => overButton ? { target: { id: 'button' } } : {}, addInteractive() {}, removeInteractive() {}, clearInteractive() {} }) },
        inputChannel: { publish() {} },
      };
      const input = new InputManager(runtime);
      const order = [];
      let up = 0, cancel = 0, globalUp = 0;
      input.observe('pointerdown', () => order.push('observe'));
      input.onNode('button', 'pointerdown', event => { order.push('button'); event.stopPropagation(); });
      input.onNode('button', 'pointerup', event => event.stopPropagation());
      input.onNode('button', 'pointercancel', event => event.stopPropagation());
      input.observe('pointerup', () => up++);
      input.observe('pointercancel', () => cancel++);
      input.on('pointerup', () => globalUp++);
      input.attach(canvas);
      send('pointerdown', 1); send('pointerup', 1);
      assert.deepEqual(order, ['observe', 'button']);
      assert.equal(up, 1, 'UI cannot hide the end of a tracked contact');
      assert.equal(globalUp, 0, 'Existing routed propagation is preserved');
      assert.equal(cancel, 0, 'Normal release does not synthesize duplicate cancellation');
      overButton = false;
      send('pointerdown', 2); send('pointermove', 2, { clientX: 80 });
      overButton = true;
      send('lostpointercapture', 2);
      assert.equal(cancel, 1, 'Unexpected capture loss terminates a pointer even over a button');
      send('pointerdown', 3); send('pointerup', 3);
      assert.equal(up, 2, 'A fresh gesture works after capture cancellation');
      input.destroy();
      send('pointerdown', 4); send('pointerup', 4);
      assert.equal(up, 2, 'Disposed input has no live observers');
      console.log('Input lifecycle PASS: passive observation, UI-consumed release, lost capture, clean new gestures and disposal.');
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
}

await new InputLifecycleVerification().run();
