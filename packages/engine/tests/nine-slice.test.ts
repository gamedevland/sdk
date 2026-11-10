import test from 'node:test';
import assert from 'node:assert/strict';
import { NineSliceSprite as NativeNineSliceSprite, Texture, TextureSource } from 'pixi.js';
import { NineSliceSprite } from '../src/layouts/nodes/NineSliceSprite';
import { AssetManager } from '../src/assets/AssetManager';

test('nine-slice resizing preserves authored borders, texture and anchor without scaling the node', async () => {
  const texture = new Texture({ source: new TextureSource({ width: 384, height: 144 }) });
  const view = new NativeNineSliceSprite({ texture, leftWidth: 52, rightWidth: 52, topHeight: 36, bottomHeight: 44 });
  const node = new NineSliceSprite(view);
  node.setAnchor(0).setSize(296, 144);
  node.setSize(600, 960);
  assert.equal(view.width, 600);
  assert.equal(view.height, 960);
  assert.deepEqual([view.leftWidth, view.rightWidth, view.topHeight, view.bottomHeight], [52, 52, 36, 44]);
  assert.equal(view.texture, texture);
  assert.equal(view.scale.x, 1);
  assert.equal(view.scale.y, 1);
  assert.equal(view.anchor.x, 0);
  assert.throws(() => node.setSize(0, 100));
  assert.throws(() => node.setSize(100, NaN));
  await node.destroy();
  await node.destroy();
  assert.equal(texture.destroyed, false, 'Node disposal must preserve asset-owned textures');
  texture.destroy(true);
});

test('nine-slice factory rejects missing assets and invalid border input', () => {
  const assets = new AssetManager();
  assert.throws(() => NineSliceSprite.create('skin', { type: 'NineSliceSprite', props: {
    asset: 'images/missing.png', leftWidth: 10, rightWidth: 10, topHeight: 10, bottomHeight: 10,
  } }, { assets }));
  assert.throws(() => NineSliceSprite.create('skin', { type: 'NineSliceSprite', props: {
    asset: 'images/missing.png', leftWidth: -1, rightWidth: 10, topHeight: 10, bottomHeight: 10,
  } }, { assets }));
});
