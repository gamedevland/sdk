import { Mesh, Texture } from 'three';
import type { Object3D } from 'three';
/** Owns shared GPU resources; scene instances hold explicit leases. */
export class ModelAsset {
  private references = 0;
  private disposed = false;
  constructor(private readonly template: Object3D) {}
  acquire(): {view: Object3D; release: () => void} {
    if (this.disposed) throw new Error('Model asset is disposed');
    this.references += 1;
    let released = false;
    return {view: this.template.clone(true), release: () => {
      if (!released) { released = true; this.references -= 1; }
    }};
  }
  dispose(): void {
    if (this.disposed) return;
    if (this.references !== 0) throw new Error('Cannot dispose a model with live instances');
    this.disposed = true;
    const geometries = new Set<Mesh['geometry']>();
    const materials = new Set<import('three').Material>();
    const textures = new Set<Texture>();
    this.template.traverse(object => {
      if (object instanceof Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
        }
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) { texture.dispose(); if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close(); }
    this.template.clear();
  }
}
