/**
 * Applies position using three modes:
 * - global: gx/gy map to screen/global coordinates (converted to local)
 * - edgeCenter: right/bottom and cx/cy offset from center in virtual space
 * - xy: direct x/y (numbers or percentages via parser)
 */
import type { NodeProperty } from './NodeProperty';
import type { NodePropertyContext } from './NodeProperty';
import type { ScreenManager } from '../../screen/ScreenManager';

type Axis = 'w' | 'h';
export type PositionMode = 'global' | 'edgeCenter' | 'xy';
type PositionParser = (v: unknown, axis: Axis) => number | undefined;

interface PointLike {
  x: number;
  y: number;
}

interface TransformNode {
  toGlobal?: (point: PointLike) => PointLike;
  toLocal?: (point: PointLike, from?: unknown) => PointLike;
}

interface PositionTargetView {
  x?: number;
  y?: number;
  parent?: TransformNode;
  position?: {
    set?: (x: number, y: number) => void;
  };
  getGlobalPosition?: () => PointLike;
}

interface PositionConfig {
  props?: PositionConfig;
  x?: number | string;
  y?: number | string;
  gx?: number | string;
  gy?: number | string;
  cx?: number | string;
  cy?: number | string;
  right?: number;
  bottom?: number;
}

export class PositionProperty implements NodeProperty {
  private parseOr(d: unknown, parse: PositionParser | undefined, axis: Axis): number | undefined {
    return parse ? parse(d, axis) : undefined;
  }

  /**
   * Apply one of the positioning strategies to the view.
   * - global: interpret gx/gy as absolute coordinates in virtual screen space
   *           and convert them to local coordinates using parent transform
   * - edgeCenter: compute position from right/bottom edges and optional center offsets
   * - xy: set local x/y directly (supports percentages via parser)
   */
  applyMode(
    view: PositionTargetView | undefined,
    cfg: PositionConfig | undefined,
    ctx: { root: TransformNode; screen: ScreenManager; parse?: PositionParser | undefined },
    mode: PositionMode,
  ): void {
    const d = cfg?.props ?? cfg;
    if (!view || !d) return;
    const parse = ctx.parse;

    if (mode === 'global') {
      const vx = d.gx !== undefined ? this.parseOr(d.gx, parse, 'w') : undefined;
      const vy = d.gy !== undefined ? this.parseOr(d.gy, parse, 'h') : undefined;
      if (vx === undefined && vy === undefined) return;
      // Interpret gx/gy strictly in virtual canvas coordinates (stage local space)
      const cur = view.getGlobalPosition?.() ?? { x: view.x ?? 0, y: view.y ?? 0 };
      const desiredVirtual = { x: vx ?? cur.x, y: vy ?? cur.y };
      // Convert from virtual (root local) to world, then to parent's local
      const world = ctx.root.toGlobal ? ctx.root.toGlobal(desiredVirtual) : desiredVirtual;
      const parent = view.parent ?? ctx.root;
      const local = parent?.toLocal ? parent.toLocal(world) : world;
      view.position?.set?.(local.x, local.y);
      return;
    }

    if (mode === 'edgeCenter') {
      const virt = ctx.screen.getVirtualSize();
      let vx: number | undefined;
      let vy: number | undefined;
      // Right/bottom offsets are computed from the far edges of the VIRTUAL canvas
      if (typeof d.right === 'number') vx = virt.width - d.right;
      if (typeof d.bottom === 'number') vy = virt.height - d.bottom;
      // Center offsets (cx/cy) relative to VIRTUAL center when no absolute set
      if (d.cx !== undefined && d.x === undefined && d.gx === undefined && d.right === undefined) {
        const dx = this.parseOr(d.cx, parse, 'w') ?? 0;
        vx = virt.width / 2 + dx;
      }
      if (d.cy !== undefined && d.y === undefined && d.gy === undefined && d.bottom === undefined) {
        const dy = this.parseOr(d.cy, parse, 'h') ?? 0;
        vy = virt.height / 2 + dy;
      }
      if (vx !== undefined || vy !== undefined) {
        const cur = view.getGlobalPosition?.() ?? { x: view.x ?? 0, y: view.y ?? 0 };
        const desiredVirtual = { x: vx ?? cur.x, y: vy ?? cur.y };
        const world = ctx.root.toGlobal ? ctx.root.toGlobal(desiredVirtual) : desiredVirtual;
        const parent = view.parent ?? ctx.root;
        const local = parent?.toLocal ? parent.toLocal(world) : world;
        view.position?.set?.(local.x, local.y);
      }
      return;
    }

    // mode === 'xy'
    if (d.x !== undefined) {
      const resolvedX = this.parseOr(d.x, parse, 'w');
      if (typeof resolvedX === 'number') {
        view.x = resolvedX;
      } else if (typeof d.x === 'number') {
        view.x = d.x;
      }
    }
    if (d.y !== undefined) {
      const resolvedY = this.parseOr(d.y, parse, 'h');
      if (typeof resolvedY === 'number') {
        view.y = resolvedY;
      } else if (typeof d.y === 'number') {
        view.y = d.y;
      }
    }
  }

  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    const typedView = (view ?? undefined) as PositionTargetView | undefined;
    const typedCfg = (cfg ?? undefined) as PositionConfig | undefined;
    const typedCtx = {
      root: ctx.root as TransformNode,
      screen: ctx.screen as ScreenManager,
      parse: ctx.parse as PositionParser | undefined,
    };
    const d = typedCfg?.props ?? typedCfg;
    if (!typedView || !d) return;
    if (d.gx !== undefined || d.gy !== undefined) {
      this.applyMode(typedView, typedCfg, typedCtx, 'global');
      return;
    }
    if (
      d.cx !== undefined ||
      d.cy !== undefined ||
      typeof d.right === 'number' ||
      typeof d.bottom === 'number'
    ) {
      this.applyMode(typedView, typedCfg, typedCtx, 'edgeCenter');
      return;
    }
    if (d.x !== undefined || d.y !== undefined) {
      this.applyMode(typedView, typedCfg, typedCtx, 'xy');
    }
  }
}
