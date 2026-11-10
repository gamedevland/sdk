import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { AudioManager } from '../dist/sdk.js';
import { Container, DisplacementFilterComponent, Sprite } from '../dist/renderers/pixi.js';

/** Exercise the built public bundle with real Howler event stores and Pixi bind groups. */
class ResourceCleanupVerification {
  static async audio() {
    const manager = AudioManager.createDefault({}), backend = manager.backend;
    const sources = [];
    let sequence = 0;
    const source = id => {
      backend.createSource({ id, url: 'controlled.mp3' });
      const howl = backend.sourcesById.get(id).howl;
      howl.play = () => ++sequence;
      howl.state = () => 'loaded';
      for (const method of ['loop', 'rate', 'volume', 'mute', 'stop', 'pause']) howl[method] = () => howl;
      sources.push(howl);
      return howl;
    };
    const count = howl => ['end', 'stop', 'playerror', 'play', 'unlock', 'loaderror']
      .map(event => howl['_on' + event].length);
    const idle = [0, 0, 0, 0, 0, 0];
    const externalOnly = [1, 0, 0, 0, 0, 0];
    const active = [1, 1, 1, 1, 0, 1];
    const howl = source('sfx');
    const external = () => {};
    howl.on('end', external);
    try {
      for (const event of ['end', 'stop', 'playerror']) {
        for (let i = 0; i < 1000; i++) {
          backend.play('sfx'); howl._emit(event, sequence);
        }
        await delay(10);
        assert.equal(backend.handles.size, 0, event + ' releases handles');
        assert.deepEqual(count(howl), externalOnly, event + ' releases only backend-owned listeners');
      }
      for (let i = 0; i < 1000; i++) backend.stop(backend.play('sfx'));
      assert.deepEqual(count(howl), externalOnly, 'Explicit stop cleans up synchronously');

      const sfx = backend.play('sfx'), music = source('music');
      let loop = backend.play('music', { channel: 'music', loop: true });
      const soundId = sequence;
      for (let i = 0; i < 4; i++) { music._emit('end', soundId); await delay(1); }
      assert.ok(backend.isHandleActive(loop), 'Loop boundaries do not terminate music');
      assert.deepEqual(count(music), active);
      backend.pause(loop);
      assert.ok(backend.isHandleActive(loop)); assert.deepEqual(count(music), active);
      backend.stopAll('sfx');
      assert.ok(!backend.isHandleActive(sfx) && backend.isHandleActive(loop));
      assert.deepEqual(count(howl), externalOnly);
      for (let i = 0; i < 100; i++) {
        const previous = loop;
        loop = backend.play('music', { channel: 'music', loop: true });
        assert.equal(loop, previous, 'Repeated music requests preserve the handle');
        assert.ok(backend.isHandleActive(previous)); assert.deepEqual(count(music), active);
      }
      backend.stopAll('music'); assert.deepEqual(count(music), idle);
      backend.play('sfx'); backend.play('music', { channel: 'music', loop: true });
      backend.stopAll(); assert.equal(backend.handles.size, 0);
      assert.deepEqual(count(howl), externalOnly); assert.deepEqual(count(music), idle);

      const unloaded = source('unloaded'); backend.play('unloaded'); backend.unloadSource('unloaded');
      assert.deepEqual(count(unloaded), idle); assert.ok(!backend.hasSource('unloaded'));
      backend.play('sfx'); backend.play('music', { channel: 'music', loop: true });
      backend.dispose(); backend.dispose();
      assert.equal(backend.handles.size, 0);
      for (const item of sources) assert.deepEqual(count(item), item === howl ? externalOnly : idle);
    } finally { howl.off('end', external); manager.dispose(); }
  }

  static async displacement() {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } });
    const blank = Sprite.create('noise', { type: 'Sprite' }, { assets: {} });
    const parent = Container.create('parent', { type: 'Container' }, { assets: {} });
    const layer = Container.create('layer', { type: 'Container' }, { assets: {} }); parent.view.addChild(layer.view);
    const texture = blank.view.texture, source = texture.source, before = source.listenerCount('change');
    const node = layer;
    node.engine = { di: { get: () => ({ getRequiredTexture: () => texture }) }, tweens: {kill() {}} };
    const peer = new DisplacementFilterComponent(), component = new DisplacementFilterComponent();
    peer.init(node, { noiseAssetId: 'noise' }); component.init(node, { noiseAssetId: 'noise' });
    try {
      peer.enable();
      const peerFilter = layer.view.filters[0], program = peerFilter.glProgram, vertex = program.vertex;
      for (let i = 0; i < 300; i++) {
        component.enable();
        const filter = layer.view.filters[1]; let map;
        filter.apply({ calculateSpriteMatrix(_matrix, sprite) { map = sprite; }, applyFilter() {} }, null, null, false);
        assert.equal(layer.view.filters.length, 2);
        component.disable(); component.disable();
        assert.deepEqual(layer.view.filters, [peerFilter]); assert.ok(map.destroyed);
        assert.equal(filter.groups, null, 'Owned bind groups are destroyed');
        assert.equal(source.listenerCount('change'), before + 1, 'Only the live peer stays subscribed');
        assert.equal(source.destroyed, false); assert.equal(program.vertex, vertex);
        assert.equal(parent.view.children.length, 2);
      }
      component.enable(); component.onDetach(); component.onDetach(); await component.completeDetach();
      assert.deepEqual(layer.view.filters, [peerFilter]);
      peer.onDetach(); await peer.completeDetach();
      assert.equal(source.listenerCount('change'), before);
      assert.equal(layer.view.filters.length, 0); assert.equal(parent.view.children.length, 1);
      assert.equal(source.destroyed, false); assert.equal(program.vertex, vertex);
    } finally {
      component.onDetach(); peer.onDetach(); await parent.destroy(); await blank.destroy();
      if (previous) Object.defineProperty(globalThis, 'document', previous);
      else Reflect.deleteProperty(globalThis, 'document');
    }
  }

  static async run() {
    await this.audio(); await this.displacement();
    process.stdout.write('PASS: 3000 terminal audio events, 1000 explicit stops, loops/pause/channel/source/dispose cleanup; 300 filter cycles and repeated detach preserve peer filters, shared programs and textures. No audio device or GPU used.\n');
  }
}

await ResourceCleanupVerification.run();
