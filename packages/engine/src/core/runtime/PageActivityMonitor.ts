interface PageActivityMonitorOptions {
  onInactiveChanged: (inactive: boolean) => void;
}

/**
 * Tracks browser page activity state based on page visibility/lifecycle only.
 */
export class PageActivityMonitor {
  private attached = false;
  private visible: boolean = document.visibilityState === 'visible';
  private pageShown = true;

  constructor(private readonly options: PageActivityMonitorOptions) {}

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.visible = document.visibilityState === 'visible';
    this.pageShown = true;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
    this.emit();
  }

  isInactive(): boolean {
    return !this.visible || !this.pageShown;
  }

  dispose(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
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
    this.emit();
  };

  private emit(): void {
    this.options.onInactiveChanged(this.isInactive());
  }
}
