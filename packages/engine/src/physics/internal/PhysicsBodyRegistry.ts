import { PhysicsErrors } from '../PhysicsErrors';

import type { Body } from 'matter-js';

export class PhysicsBodyRegistry {
  private readonly byId = new Map<string, Body>();
  private readonly byMatterId = new Map<number, string>();

  add(bodyId: string, body: Body, source: string): void {
    if (bodyId.length === 0) {
      throw PhysicsErrors.bodyIdRequired(source);
    }
    if (this.byId.has(bodyId)) {
      throw PhysicsErrors.duplicateBodyId(source, bodyId);
    }
    this.byId.set(bodyId, body);
    this.byMatterId.set(body.id, bodyId);
    for (const part of body.parts) {
      this.byMatterId.set(part.id, bodyId);
    }
  }

  getRequired(bodyId: string, source: string): Body {
    if (bodyId.length === 0) {
      throw PhysicsErrors.bodyIdRequired(source);
    }
    const body = this.byId.get(bodyId);
    if (!body) {
      throw PhysicsErrors.bodyNotFound(source, bodyId);
    }
    return body;
  }

  removeOptional(bodyId: string): Body | undefined {
    const body = this.byId.get(bodyId);
    if (!body) {
      return undefined;
    }
    this.byId.delete(bodyId);
    this.byMatterId.delete(body.id);
    for (const part of body.parts) {
      this.byMatterId.delete(part.id);
    }
    return body;
  }

  findBodyId(body: Body): string | undefined {
    return this.byMatterId.get(body.id);
  }

  entries(): IterableIterator<[string, Body]> {
    return this.byId.entries();
  }

  clear(): void {
    this.byId.clear();
    this.byMatterId.clear();
  }
}
