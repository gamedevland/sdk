import { LoadingManager, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SchemaDecoder as S } from '../../validation/schema/SchemaDecoder';
import { ModelAsset } from './ModelAsset';
import type { Loader, AssetDescriptor } from '../../assets/types';
export class GlbLoader implements Loader {
  private static readonly document = S.object({
    buffers: S.optional(S.array(S.object({uri: S.optional(S.string())}))),
    images: S.optional(S.array(S.object({uri: S.optional(S.string())}))),
    extensionsRequired: S.optional(S.array(S.string())),
    animations: S.optional(S.array(S.record())),
  });
  async load(descriptor: AssetDescriptor, signal: AbortSignal, baseURL = '/'): Promise<ModelAsset> {
    const path = descriptor.importedUrl ?? descriptor.url;
    if (!path) throw new Error('GLB URL is missing: ' + descriptor.id);
    const response = await fetch(new URL(path, new URL(baseURL, document.baseURI)), {signal});
    if (!response.ok) throw new Error(`GLB request failed: ${response.status} ${descriptor.id}`);
    const bytes = await response.arrayBuffer();
    const header = new DataView(bytes);
    if (bytes.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength || header.getUint32(16, true) !== 0x4e4f534a) throw new Error('Expected GLB 2.0: ' + descriptor.id);
    const jsonLength = header.getUint32(12, true);
    const raw: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
    const config = S.decode(raw, GlbLoader.document, descriptor.id);
    if (config.extensionsRequired?.length || config.animations?.length) throw new Error('MVP GLB supports static models without required extensions');
    for (const entry of [...config.buffers ?? [], ...config.images ?? []]) {
      if (entry.uri && !entry.uri.startsWith('data:')) throw new Error('GLB must be self-contained');
    }
    signal.throwIfAborted();
    const manager = new LoadingManager();
    manager.setURLModifier(url => {
      if (!url.startsWith('data:') && !url.startsWith('blob:')) throw new Error('External GLB resource is unsupported');
      return url;
    });
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
    const resource = new ModelAsset(gltf.scene);
    try {
      signal.throwIfAborted();
      gltf.scene.traverse(object => { if (object instanceof SkinnedMesh) throw new Error('Skinned GLB is unsupported in MVP'); });
      return resource;
    } catch (error) { resource.dispose(); throw error; }
  }
  dispose(resource: unknown): void {
    if (!(resource instanceof ModelAsset)) throw new Error('Expected a model asset');
    resource.dispose();
  }
}
