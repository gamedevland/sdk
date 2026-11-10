import { DiTokens } from '../../di/tokens';
import type { ParticlesManager } from '../../particles/ParticlesManager';
import { PhysicsServices } from '../../physics/PhysicsServices';
import type { TextureAssetResolver } from '../../layouts/assets/TextureAssetResolver';
import type { PixiTextureGenerator } from './PixiTextureGenerator';
export class PixiServices {
  static readonly TextureGenerator = DiTokens.service<PixiTextureGenerator>('PixiTextureGenerator');
  static readonly ParticlesManager = DiTokens.service<ParticlesManager>('ParticlesManager');
  /** @deprecated Register MatterPhysicsModule and use PhysicsServices.Manager. */
  static readonly PhysicsManager = PhysicsServices.Manager;
  static readonly TextureAssetResolver = DiTokens.service<TextureAssetResolver>('TextureAssetResolver');
}
