import test from "node:test";
import assert from "node:assert/strict";
import { Container as NativeContainer } from "pixi.js";
import { HybridRoot } from "../src/renderers/hybrid/HybridRoot";
import { HybridHitTester } from "../src/renderers/hybrid/HybridHitTester";
import { HybridProperties } from "../src/renderers/hybrid/HybridProperties";
import { Container } from "../src/layouts/nodes/Container";
import { ThreeGroup } from "../src/renderers/three/ThreeGroup";
import type { HitTester, LayoutProperties } from "../src/rendering/types";
import type { HitTarget } from "../src/input/types";

class TestHitTester implements HitTester {
  readonly ids = new Set<string>();
  calls = 0;
  constructor(public target: HitTarget | undefined) {}
  hitTest() {
    this.calls++;
    return this.target ? { target: this.target } : {};
  }
  addInteractive(id: string) {
    this.ids.add(id);
  }
  removeInteractive(id: string) {
    this.ids.delete(id);
  }
  clearInteractive() {
    this.ids.clear();
  }
}
class TestProperties implements LayoutProperties {
  calls = 0;
  apply() {
    this.calls++;
  }
}
test("hybrid ownership routes both native trees and detaches/disposes idempotently", async () => {
  const root = new HybridRoot(
    new ThreeGroup(),
    new Container(new NativeContainer()),
  );
  const scene = new HybridRoot(
    new ThreeGroup(),
    new Container(new NativeContainer()),
  );
  const world = new ThreeGroup(),
    ui = new Container(new NativeContainer());
  root.addChild("scene", scene);
  root.attach(scene);
  scene.addChild("world", world);
  scene.attach(world);
  scene.addChild("ui", ui);
  scene.attach(ui);
  assert.equal(world.view.parent, scene.world.view);
  assert.equal(ui.view.parent, scene.ui.view);
  assert.equal(scene.world.view.parent, root.world.view);
  assert.equal(scene.ui.view.parent, root.ui.view);
  scene.detach();
  scene.detach();
  assert.equal(scene.world.view.parent, null);
  assert.equal(scene.ui.view.parent, null);
  await scene.destroy();
  await scene.destroy();
  await root.destroy();
});
test("UI hits take priority, empty UI falls through, and registrations clean up both delegates", () => {
  const ui = new TestHitTester({ id: "ui.pause" }),
    world = new TestHitTester({ id: "world.fruit" }),
    hits = new HybridHitTester(ui, world);
  hits.addInteractive("ui.pause");
  assert.ok(ui.ids.has("ui.pause"));
  assert.ok(world.ids.has("ui.pause"));
  assert.equal(hits.hitTest({ x: 1, y: 1 }).target?.id, "ui.pause");
  assert.equal(world.calls, 0);
  ui.target = undefined;
  assert.equal(hits.hitTest({ x: 1, y: 1 }).target?.id, "world.fruit");
  hits.removeInteractive("ui.pause");
  assert.equal(ui.ids.size, 0);
  assert.equal(world.ids.size, 0);
  hits.addInteractive("world.fruit");
  hits.clearInteractive();
  assert.equal(ui.ids.size + world.ids.size, 0);
});
test("property dispatch never sends a native node to the other renderer", async () => {
  const world = new TestProperties(),
    ui = new TestProperties(),
    properties = new HybridProperties(world, ui);
  const a = new ThreeGroup(),
    b = new Container(new NativeContainer());
  properties.apply(a, { type: "Group" });
  assert.equal(world.calls, 1);
  assert.equal(ui.calls, 0);
  properties.apply(b, { type: "Container" });
  assert.equal(world.calls, 1);
  assert.equal(ui.calls, 1);
  const root = new HybridRoot(
    new ThreeGroup(),
    new Container(new NativeContainer()),
  );
  assert.throws(
    () => properties.apply(root, { type: "Group" }),
    /renderer-owned/,
  );
  await a.destroy();
  await b.destroy();
  await root.destroy();
});
