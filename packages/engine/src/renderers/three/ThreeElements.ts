import { AmbientLight, DirectionalLight, OrthographicCamera, PerspectiveCamera, BoxGeometry, PlaneGeometry, SphereGeometry, Mesh, MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { ThreeNode } from './ThreeNode';
import { ThreeGroup } from './ThreeGroup';
import { ThreeSchemas } from './ThreeSchemas';
import { ModelAsset } from './ModelAsset';
import { SchemaDecoder as S } from '../../validation/schema/SchemaDecoder';
import type { ElementConfig } from '../../layouts/types';
import type { ElementFactory } from '../../di/ElementFactoriesGroup';
import type { AssetManager } from '../../assets/AssetManager';
export class ThreeElements {
  factory(): ElementFactory { return (id, cfg, ctx) => ({id, object: this.create(id, cfg, ctx.assets)}); }
  private create(id: string, cfg: ElementConfig, assets: AssetManager): ThreeNode {
    const source = id + '.props';
    const raw = cfg.props ?? {};
    if (cfg.type === 'Group') {
      S.decode(raw, ThreeSchemas.transforms, source); return new ThreeGroup();
    }
    if (cfg.type === 'Mesh') {
      const props = S.decode(raw, ThreeSchemas.mesh, source);
      const size = props.geometry.size ?? {x: 1, y: 1, z: 1};
      if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error(source + ': geometry dimensions must be positive');
      const geometry = props.geometry.type === 'box' ? new BoxGeometry(size.x, size.y, size.z) : props.geometry.type === 'plane' ? new PlaneGeometry(size.x, size.y) : new SphereGeometry(props.geometry.radius ?? 0.5, 12, 8);
      if (!/^#[0-9a-f]{6}$/i.test(props.material.color)) { geometry.dispose(); throw new Error(source + ': expected #rrggbb color'); }
      const material = props.material.type === 'standard' ? new MeshStandardMaterial({color: props.material.color, roughness: props.material.roughness ?? 0.6, metalness: props.material.metalness ?? 0}) : new MeshBasicMaterial({color: props.material.color});
      return new ThreeNode(new Mesh(geometry, material), () => {geometry.dispose(); material.dispose();});
    }
    if (cfg.type === 'Model') {
      const props = S.decode(raw, ThreeSchemas.model, source);
      const asset = assets.getRequired<unknown>(props.asset);
      if (!(asset instanceof ModelAsset)) throw new Error(source + ': asset must be a loaded GLB');
      const lease = asset.acquire();
      lease.view.traverse(view => { if (view instanceof Mesh) { view.castShadow = props.castShadow ?? false; view.receiveShadow = props.receiveShadow ?? false; } });
      return new ThreeNode(lease.view, lease.release);
    }
    if (cfg.type === 'OrthographicCamera' || cfg.type === 'PerspectiveCamera') {
      const props = S.decode(raw, ThreeSchemas.camera, source);
      if (props.far <= props.near) throw new Error(source + ': camera far must exceed near');
      if (cfg.type === 'OrthographicCamera' && props.height === undefined) throw new Error(source + ': orthographic height is required');
      if (cfg.type === 'PerspectiveCamera' && props.fov === undefined) throw new Error(source + ': perspective fov is required');
      const camera = cfg.type === 'OrthographicCamera' ? new OrthographicCamera(-1, 1, 1, -1, props.near, props.far) : new PerspectiveCamera(props.fov, 1, props.near, props.far);
      camera.userData['worldHeight'] = props.height;
      return new ThreeNode(camera);
    }
    const props = S.decode(raw, ThreeSchemas.light, source);
    if (!/^#[0-9a-f]{6}$/i.test(props.color)) throw new Error(source + ': expected #rrggbb color');
    if (cfg.type === 'AmbientLight') return new ThreeNode(new AmbientLight(props.color, props.intensity));
    const light = new DirectionalLight(props.color, props.intensity);
    light.castShadow = props.castShadow ?? false;
    const size = props.shadowMapSize ?? 1024;
    light.shadow.mapSize.set(size, size);
    const bounds = props.shadowBounds ?? 20;
    Object.assign(light.shadow.camera, {left: -bounds, right: bounds, top: bounds, bottom: -bounds, near: .5, far: 80});
    light.shadow.bias = props.shadowBias ?? -.0001;
    light.shadow.normalBias = props.shadowNormalBias ?? .02;
    return new ThreeNode(light, () => { light.shadow.dispose(); light.target.removeFromParent(); });
  }
}
