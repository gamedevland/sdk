import { DiTokens } from '../di/tokens';
import type { RenderRuntime } from './types';
export class RenderTokens { static readonly Runtime = DiTokens.service<RenderRuntime>('RenderRuntime'); }
