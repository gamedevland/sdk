import test from 'node:test';
import assert from 'node:assert/strict';
import { Container, Sprite, Texture, TextureSource, WebGLRenderer } from 'pixi.js';
import type { PrepareQueueItem } from 'pixi.js';
import { PixiScenePreparer } from '../src/renderers/pixi/PixiScenePreparer';

class TestPreparer extends PixiScenePreparer {
  readonly uploaded: PrepareQueueItem[] = [];
  failAt: number | undefined;
  protected override uploadQueueItem(item: PrepareQueueItem): void {
    if (this.uploaded.length === this.failAt) throw new Error('upload failed');
    this.uploaded.push(item);
  }
}

class PrepareFixture {
  readonly preparer = new TestPreparer(new WebGLRenderer());
  readonly root = new Container<Sprite>();
  readonly lifetime = new AbortController();
  constructor() {
    for (let i = 0; i < 9; i++) {
      const sprite = new Sprite(new Texture({ source: new TextureSource() }));
      sprite.visible = false;
      this.root.addChild(sprite);
    }
    this.root.addChild(new Sprite(this.root.getChildAt(0).texture));
  }
}

test('preparation uploads hidden resources in bounded batches without RAF and deduplicates them', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = new PrepareFixture();
  const pending = f.preparer.prepare(f.root, f.lifetime.signal);
  assert.equal(f.preparer.uploaded.length, 0);
  t.mock.timers.tick(1); await Promise.resolve();
  assert.equal(f.preparer.uploaded.length, 4);
  t.mock.timers.tick(1); await Promise.resolve();
  assert.equal(f.preparer.uploaded.length, 8);
  t.mock.timers.tick(1); await pending;
  assert.equal(f.preparer.uploaded.length, 9);
});

test('a resource upload exception rejects preparation instead of leaving a pending promise', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = new PrepareFixture();
  f.preparer.failAt = 1;
  const rejected = assert.rejects(f.preparer.prepare(f.root, f.lifetime.signal), /upload failed/);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(f.preparer.getQueue().length, 0);
});

test('cancelling preparation prevents the remaining uploads', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = new PrepareFixture();
  const pending = f.preparer.prepare(f.root, f.lifetime.signal);
  const rejected = assert.rejects(pending, /scene disposed/);
  t.mock.timers.tick(1); await Promise.resolve();
  f.lifetime.abort(new Error('scene disposed'));
  await rejected;
  t.mock.timers.tick(100);
  assert.equal(f.preparer.uploaded.length, 4);
  assert.equal(f.preparer.getQueue().length, 0);
});
