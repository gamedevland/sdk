/** Owns native capture listeners so audio activation precedes scene input and awaits. */
export class AudioInteractionUnlock {
  private target: HTMLElement | undefined;

  constructor(private readonly activate: () => Promise<void>) {}

  attach(target: HTMLElement): void {
    if (this.target === target) return;
    this.dispose();
    this.target = target;
    target.addEventListener('pointerdown', this.onPointer, { capture: true, passive: true });
    target.addEventListener('pointerup', this.onPointer, { capture: true, passive: true });
    target.addEventListener('touchend', this.onTouch, { capture: true, passive: true });
    target.ownerDocument.addEventListener('keydown', this.onKey, true);
  }

  dispose(): void {
    const target = this.target;
    if (!target) return;
    target.removeEventListener('pointerdown', this.onPointer, true);
    target.removeEventListener('pointerup', this.onPointer, true);
    target.removeEventListener('touchend', this.onTouch, true);
    target.ownerDocument.removeEventListener('keydown', this.onKey, true);
    this.target = undefined;
  }

  private readonly onPointer = (event: PointerEvent): void => {
    if (!event.isTrusted || event.isPrimary === false || event.button !== 0) return;
    this.tryActivate();
  };

  private readonly onTouch = (event: TouchEvent): void => {
    if (!event.isTrusted || event.touches.length > 0) return;
    this.tryActivate();
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    const document = this.target?.ownerDocument;
    if (!document || !event.isTrusted || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.activeElement !== this.target && document.activeElement !== document.body) return;
    this.tryActivate();
  };

  private tryActivate(): void {
    if (!this.target || this.target.ownerDocument.hidden) return;
    // The call stays on the trusted event stack. A rejected/pending attempt never
    // removes listeners or prevents the next gesture from trying again.
    void this.activate().catch(() => {});
  }
}
