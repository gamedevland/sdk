import { Raycaster, Vector2 } from 'three';
import { ThreeNode } from './ThreeNode';
import type { Camera } from 'three';
import type { SceneLayout } from '../../layouts/scene/SceneLayout';
import type { HitTester } from '../../rendering/types';
import type { HitTarget } from '../../input/types';
export class ThreeHitTester implements HitTester {
  private readonly ids = new Set<string>();
  private readonly ray = new Raycaster();
  constructor(private readonly getLayout: () => SceneLayout | undefined, private readonly getCamera: () => Camera, private readonly getSize: () => {width: number; height: number}) {}
  addInteractive(id: string): void { this.ids.add(id); }
  removeInteractive(id: string): void { this.ids.delete(id); }
  clearInteractive(): void { this.ids.clear(); }
  hitTest(point: {x: number; y: number}): {target?: HitTarget} {
    const layout = this.getLayout();
    if (!layout || this.ids.size === 0) return {};
    const size = this.getSize();
    const camera = this.getCamera();
    camera.updateMatrixWorld(true);
    this.ray.setFromCamera(new Vector2(point.x / size.width * 2 - 1, 1 - point.y / size.height * 2), camera);
    let best: {distance: number; target: HitTarget} | undefined;
    for (const id of this.ids) {
      const node = layout.findNode(id);
      if (!(node instanceof ThreeNode)) continue;
      let visible = true;
      for (let view: import('three').Object3D | null = node.view; view; view = view.parent) visible &&= view.visible;
      if (!visible) continue;
      node.view.updateWorldMatrix(true, true);
      const hit = this.ray.intersectObject(node.view, true)[0];
      if (hit && (!best || hit.distance < best.distance)) best = {distance: hit.distance, target: {id, node, displayObject: hit.object}};
    }
    return best ? {target: best.target} : {};
  }
}
