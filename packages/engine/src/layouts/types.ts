/**
 * Declarative layout file format used by the LayoutResolver/LayoutBuilder pipeline.
 * A layout is a JSON-like tree of elements where each element may declare display properties,
 * components, actions and, for Container nodes only, child elements. The pipeline validates and turns it into
 * runtime display nodes and behavior bindings.
 */
import type {
  ValidationIssue as StructuralValidationIssue,
  ValidationResult as StructuralValidationResult,
} from '@engine/validation';

export type LayoutFile<TProps extends object = Record<string, unknown>> = Record<string, ElementConfig<TProps>>;

/**
 * Special directive has been replaced by `$include` and is resolved by IncludeExpander.
 */
// InjectConfig removed in new inject-anywhere semantics

/**
 * ElementConfig describes a single node in the layout tree.
 * - type: required node type identifier (must be registered in nodes registry)
 * - extends: optional named base element to inherit defaults from
 * - props: display and transform properties applied to the created node
 *
 * - children: Container-only map of child elements, each with its own ElementConfig
 * - components: attachable behaviors (composition) instantiated on the node
 * - actions: named actions that can be triggered by input or lifecycle
 */
export interface ElementConfig<TProps extends object = Record<string, unknown>> {
  type: string;
  extends?: string;
  props?: TProps;
  children?: Record<string, ElementConfig<TProps>>;
  components?: Record<string, ComponentConfig>;
  actions?: Record<string, ActionConfig>;
}

/**
 * Visual and transform properties for a display node. Values may be absolute numbers
 * or strings when relative parsing is supported (e.g. percentages by DimensionParser).
 * Some fields are shortcuts or extended aliases used by DisplayManager.
 */
export interface DisplayConfig {
  x?: number | string; // position X
  y?: number | string; // position Y
  scale?: number | { x?: number; y?: number }; // uniform or per-axis scale
  rotation?: number; // radians
  alpha?: number; // 0..1 transparency
  visible?: boolean; // toggle visibility
  zIndex?: number; // rendering order
  interactive?: boolean; // enable input events for this node
  pivot?: { x?: number; y?: number }; // transform pivot in local space
  anchor?: number | { x?: number; y?: number }; // sprite/text anchor (uniform number or per-axis)
  // extended
  cx?: number | string; // center X positioning
  cy?: number | string; // center Y positioning
  right?: number; // align right with offset
  bottom?: number; // align bottom with offset
  gx?: number | string; // global X (screen) support
  gy?: number | string; // global Y (screen) support
  color?: number | string; // tint color
  angle?: number; // degrees (converted into rotation)
  asset?: string; // asset id for sprite/texture-based nodes
  width?: number; // width override
  height?: number; // height override
  leftWidth?: number; // NineSliceSprite left border in texture pixels
  rightWidth?: number; // NineSliceSprite right border in texture pixels
  topHeight?: number; // NineSliceSprite top border in texture pixels
  bottomHeight?: number; // NineSliceSprite bottom border in texture pixels
  text?: string; // text content for Text nodes
  style?: Record<string, unknown> | string; // style object or style preset key
  radius?: number; // corner radius for GraphicsRectProperty
}

/**
 * Declarative component to attach to a node.
 * - type: component type key registered in ComponentRegistry
 * - enabled: initial toggle state
 * - data: arbitrary configuration passed to the component
 */
export interface ComponentConfig {
  type: string;
  enabled?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Declarative action that can be invoked against a node (e.g., animations, commands).
 * - type: action type key registered in ActionRegistry
 * - data: action parameters consumed by the action implementation
 */
export interface ActionConfig {
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Single validation issue indicating what went wrong and where in the layout tree.
 */
export type LayoutValidationIssue = StructuralValidationIssue;

/**
 * Result wrapper used by validators: either a successful value or a collection of issues.
 */
export type LayoutValidationResult<T> = StructuralValidationResult<T>;
