/**
 * Hit-test helpers for display objects working in virtual/stage coordinates.
 * Extracted to decouple geometry checks from NodeHitTester.
 */
export class HitTestUtils {
  static containsPoint(display: unknown, virtual: { x: number; y: number }, top: unknown): boolean {
    if (!display || !top || typeof display !== 'object' || typeof top !== 'object') return false;
    const displayObj = display as {
      toLocal?: (p: { x: number; y: number }, from: unknown) => { x: number; y: number };
      hitArea?: { contains?: (x: number, y: number) => boolean };
      getBounds?: (skipUpdate?: boolean) => { x: number; y: number; width: number; height: number };
    };
    const topObj = top as {
      toLocal?: (p: { x: number; y: number }) => { x: number; y: number };
    };
    if (
      typeof displayObj.toLocal === 'function' &&
      displayObj.hitArea &&
      typeof displayObj.hitArea.contains === 'function'
    ) {
      const lp = displayObj.toLocal({ x: virtual.x, y: virtual.y }, top);
      return displayObj.hitArea.contains(lp.x, lp.y);
    }
    if (typeof displayObj.getBounds === 'function' && typeof topObj.toLocal === 'function') {
      const b = displayObj.getBounds(false);
      const tl = topObj.toLocal({ x: b.x, y: b.y });
      const br = topObj.toLocal({ x: b.x + b.width, y: b.y + b.height });
      const minX = Math.min(tl.x, br.x);
      const maxX = Math.max(tl.x, br.x);
      const minY = Math.min(tl.y, br.y);
      const maxY = Math.max(tl.y, br.y);
      return virtual.x >= minX && virtual.x <= maxX && virtual.y >= minY && virtual.y <= maxY;
    }
    return false;
  }
}

export default HitTestUtils;
