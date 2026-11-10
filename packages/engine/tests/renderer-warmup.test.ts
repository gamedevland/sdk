import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera } from "three";
import { ThreeRuntime } from "../src/renderers/three/ThreeRuntime";

class WarmupBackend {
  renders = 0;
  compilations = 0;
  release: (() => void) | undefined;
  failure: Error | undefined;
  async compileAsync(): Promise<void> {
    this.compilations++;
    await new Promise<void>((resolve) => { this.release = resolve; });
    if (this.failure) throw this.failure;
  }
  render(): void { this.renders++; }
}

class WarmupFixture {
  readonly runtime = new ThreeRuntime();
  readonly backend = new WarmupBackend();
  constructor() {
    const camera = new PerspectiveCamera();
    this.runtime.root.view.add(camera);
    Object.defineProperty(this.runtime, "backend", { value: this.backend, writable: true });
    Object.defineProperty(this.runtime, "camera", { value: camera, writable: true });
  }
}

test("Three warmup awaits compilation and gates regular frames until the preparation render", async () => {
  const { runtime, backend } = new WarmupFixture();
  const pending = runtime.warmupScene();
  assert.equal(backend.compilations, 1);
  runtime.renderFrame(); runtime.renderFrame();
  assert.equal(backend.renders, 0, "A normal frame must not synchronously wait for compiling shaders");
  backend.release?.();
  await pending;
  assert.equal(backend.renders, 1, "The loading phase initializes buffers, textures and shadows");
  runtime.renderFrame();
  assert.equal(backend.renders, 2);
});

test("a scene removed during asynchronous compilation cannot submit a stale render", async () => {
  const { runtime, backend } = new WarmupFixture();
  const pending = runtime.warmupScene();
  runtime.cleanup(runtime.root);
  backend.release?.();
  await pending;
  runtime.renderFrame();
  assert.equal(backend.renders, 0);
});

test("warmup fails fast without a camera and propagates compilation failures", async () => {
  await assert.rejects(new ThreeRuntime().warmupScene(), /active camera/);
  const { runtime, backend } = new WarmupFixture();
  backend.failure = new Error("Shader compilation failed");
  const pending = runtime.warmupScene();
  backend.release?.();
  await assert.rejects(pending, /Shader compilation failed/);
  assert.equal(backend.renders, 0);
});
