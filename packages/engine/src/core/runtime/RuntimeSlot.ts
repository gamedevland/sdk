export class RuntimeSlot<T> {
  private value: T | undefined;

  set(value: T | undefined): void {
    this.value = value;
  }

  clear(value: T | undefined): void {
    if (value === undefined || value === this.value) {
      this.value = undefined;
    }
  }

  get(): T | undefined {
    return this.value;
  }

  getRequired(createError: () => Error): T {
    if (this.value === undefined) {
      throw createError();
    }
    return this.value;
  }
}
