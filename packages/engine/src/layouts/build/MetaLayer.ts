export interface NodeMetaHooks {
  onCreated(nodeObject: unknown, params: { id: string; engine?: unknown }): void;
}

export class DefaultMetaLayer implements NodeMetaHooks {
  /**
   * Best-effort metadata attachment: assigns a stable id and optionally engine ref.
   * Failures are ignored to avoid breaking 3rd‑party objects that freeze properties.
   */
  onCreated(nodeObject: unknown, params: { id: string; engine?: unknown }): void {
    if (!nodeObject) return;
    try {
      if (typeof nodeObject === 'object' && nodeObject !== null && 'id' in nodeObject) {
        (nodeObject as { id?: string }).id = params.id;
      }
    } catch {
      /* ignore */
    }
    if (
      params.engine &&
      typeof nodeObject === 'object' &&
      nodeObject !== null &&
      'engine' in nodeObject
    ) {
      try {
        (nodeObject as { engine?: unknown }).engine = params.engine;
      } catch {
        /* ignore */
      }
    }
  }
}
