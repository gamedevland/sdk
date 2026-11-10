import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneHookDeadline } from '../src/scenes/SceneHookDeadline';

class PageVisibility extends EventTarget {
  hidden = false;
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

test('hidden time is excluded while the remaining visible budget is preserved', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const page = new PageVisibility();
  const failure = new Error('deadline');
  const pending = new SceneHookDeadline(100, page, () => Date.now()).run(
    () => new Promise<void>(() => {}), () => failure,
  );
  const rejected = assert.rejects(pending, (error: unknown) => error === failure);
  let settled = false;
  void pending.then(() => { settled = true; }, () => { settled = true; });
  t.mock.timers.tick(40);
  page.setHidden(true);
  t.mock.timers.tick(10000);
  await Promise.resolve();
  assert.equal(settled, false);
  page.setHidden(false);
  t.mock.timers.tick(59);
  await Promise.resolve();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
});

test('a hook started hidden gets its full budget on return to the page', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const page = new PageVisibility();
  page.setHidden(true);
  const pending = new SceneHookDeadline(100, page, () => Date.now()).run(
    () => new Promise<void>(() => {}), () => new Error('deadline'),
  );
  const rejected = assert.rejects(pending, /deadline/);
  t.mock.timers.tick(10000);
  page.setHidden(false);
  t.mock.timers.tick(100);
  await rejected;
});

test('success and failure remove their visibility listeners and timers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new PageVisibility();
  const added = t.mock.method(page, 'addEventListener');
  const removed = t.mock.method(page, 'removeEventListener');
  let timeouts = 0;
  const createError = (): Error => { timeouts++; return new Error('deadline'); };
  await new SceneHookDeadline(100, page).run(() => {}, createError);
  await assert.rejects(new SceneHookDeadline(100, page).run(() => {
    throw new Error('hook failed');
  }, createError), /hook failed/);
  page.setHidden(true);
  page.setHidden(false);
  t.mock.timers.tick(1000);
  assert.equal(timeouts, 0);
  assert.equal(added.mock.callCount(), 2);
  assert.equal(removed.mock.callCount(), 2);
});

test('without a document the timeout still rejects a stalled hook', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = new SceneHookDeadline(100).run(
    () => new Promise<void>(() => {}), () => new Error('deadline'),
  );
  const rejected = assert.rejects(pending, /deadline/);
  t.mock.timers.tick(100);
  await rejected;
});
