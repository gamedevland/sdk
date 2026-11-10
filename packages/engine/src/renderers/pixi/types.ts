import type { ElementConfig as CommonElementConfig, LayoutFile as CommonLayoutFile, DisplayConfig } from '../../layouts/types';
export type ElementConfig = CommonElementConfig<DisplayConfig>;
export type LayoutFile = CommonLayoutFile<DisplayConfig>;
export type { DisplayConfig } from '../../layouts/types';
