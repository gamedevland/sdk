// Type contracts used by the layout building pipeline.
import type { AssetManager } from '../../assets/AssetManager';
import type { ActionRegistry } from '../actions/ActionRegistry';
import type { BaseAction } from '../actions/BaseAction';
import type { BaseComponent } from '../components/BaseComponent';
import type { ComponentRegistry } from '../components/ComponentRegistry';

import type { ElementConfig } from '../types';
import type { LayoutRuntime } from '@engine/core';
import type { DiContainerInterface } from '@engine/di/types';
import type { ScreenManager } from '@engine/screen';
import type { NodeBase } from '../NodeBase';

export interface BuildOptions {
  container?: DiContainerInterface;
  components?: ComponentRegistry | Record<string, new () => BaseComponent>;
  actions?: ActionRegistry | Record<string, new () => BaseAction>;
  screen?: ScreenManager;
}

export interface BuildContext {
  assets: AssetManager;
  container: DiContainerInterface;
  components: ComponentRegistry;
  actions: ActionRegistry;
  screen: ScreenManager;
  engine?: LayoutRuntime;
  /** Asset ID of the text styles config, forwarded from GameConfig.layouts.textStylesConfigId. */
  textStylesConfigId?: string;
}

export interface BuiltElement {
  id: string;
  object: NodeBase;
  children: Map<string, BuiltElement>;
  cfg: ElementConfig;
  parentId?: string;
}

export interface BuildResult {
  root: NodeBase;
  elements: Map<string, BuiltElement>;
}

// Element factory types (moved from registry). A factory is provided by DI.
export interface CreatedElement {
  id: string;
  object: NodeBase;
  /** Await owned resources after tree assembly and before component readiness. */
  prepare?: () => Promise<void>;
}

export interface ElementFactoryContext {
  createChild: (id: string, cfg: ElementConfig) => CreatedElement;
  assets: AssetManager;
}
