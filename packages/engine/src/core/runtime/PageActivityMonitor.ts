interface PageActivityMonitorOptions {
  onInactiveChanged: (inactive: boolean) => void;
}

/**
 * Tracks browser visibility, focus and page lifecycle without changing scene state.
 */
export class PageActivityMonitor {
  private attached = false;
  private visible: boolean = document.visibilityState === 'visible';
  private pageShown = true;
  private focused = document.hasFocus();

  constructor(private readonly options: PageActivityMonitorOptions) {}

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.visible = document.visibilityState === 'visible';
    this.pageShown = true;
    this.focused = document.hasFocus();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    this.emit();
  }

  isInactive(): boolean {
    return !this.visible || !this.pageShown || !this.focused;
  }

  dispose(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
  }

  private readonly onVisibilityChange = (): void => {
    this.visible = document.visibilityState === 'visible';
    this.emit();
  };

  private readonly onPageHide = (): void => {
    this.pageShown = false;
    this.emit();
  };

  private readonly onPageShow = (): void => {
    this.pageShown = true;
    this.focused = document.hasFocus();
    this.emit();
  };

  private readonly onBlur = (): void => {
    this.focused = false;
    this.emit();
  };

  private readonly onFocus = (): void => {
    this.focused = true;
    this.emit();
  };

  private emit(): void {
    this.options.onInactiveChanged(this.isInactive());
  }
}
