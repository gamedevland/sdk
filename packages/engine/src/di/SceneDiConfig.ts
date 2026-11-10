import type { Provider, Token } from './types';

export interface SceneDiEntry {
  readonly definition: string;
  readonly providers: readonly Provider[];
  readonly services: readonly Token<unknown>[];
}

export interface SceneDiConfig {
  readonly scenes: Readonly<Record<string, SceneDiEntry>>;
}

export interface BuiltSceneDiEntry extends SceneDiEntry {
  readonly sceneKey: string;
}
