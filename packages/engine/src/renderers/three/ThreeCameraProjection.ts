import { OrthographicCamera, PerspectiveCamera } from 'three';
import { SchemaDecoder as S } from '../../validation';
import type { Camera } from 'three';

/** Shared projection sizing for screen and texture render targets. */
export class ThreeCameraProjection {
  static update(camera: Camera, aspect: number): void {
    if (camera instanceof PerspectiveCamera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    if (camera instanceof OrthographicCamera) {
      const height = S.decode(camera.userData['worldHeight'], S.number({ min: 0.001 }), 'Three.camera.height');
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.left = -height * aspect / 2;
      camera.right = height * aspect / 2;
      camera.updateProjectionMatrix();
    }
  }
}
