import { DiTokens } from '../../di/tokens';
import type { ParticlesManager } from '../../particles/ParticlesManager';
import type { PhysicsManager } from '../../physics/PhysicsManager';
import type { TextureAssetResolver } from '../../layouts/assets/TextureAssetResolver';
import type { PixiTextureGenerator } from './PixiTextureGenerator';
export class PixiServices {
  static readonly TextureGenerator = DiTokens.service<PixiTextureGenerator>('PixiTextureGenerator');
  static readonly ParticlesManager = DiTokens.service<ParticlesManager>('ParticlesManager');
  static readonly PhysicsManager = DiTokens.service<PhysicsManager>('PhysicsManager');
  static readonly TextureAssetResolver = DiTokens.service<TextureAssetResolver>('TextureAssetResolver');
}
