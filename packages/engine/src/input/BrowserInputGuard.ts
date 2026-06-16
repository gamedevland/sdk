export interface BrowserInputGuardConfig {
  /** Prevent wheel scroll/zoom on canvas. */
  readonly preventWheel: boolean;
  /** Prevent context menu (right-click / long-press) on canvas. */
  readonly preventContextMenu: boolean;
  /** Prevent browser text selection and drag interactions on canvas. */
  readonly preventTextSelection: boolean;
  /** Prevent iOS/WebKit touch callout and drag affordances on canvas. */
  readonly preventTouchCallout: boolean;
  /** Prevent multi-touch pinch zoom. */
  readonly preventPinchZoom: boolean;
  /** Prevent touch scroll and pull-to-refresh interactions. */
  readonly preventTouchScroll: boolean;
  /** Prevent Safari gesture events. */
  readonly preventSafariGestures: boolean;
  /** Prevent page scrolling/jumping on gameplay keys (Space/Arrows). */
  readonly preventPageJumpKeys: boolean;
}

export class BrowserInputGuard {
  private static readonly DefaultConfig: BrowserInputGuardConfig = Object.freeze({
    preventWheel: true,
    preventContextMenu: true,
    preventTextSelection: true,
    preventTouchCallout: true,
    preventPinchZoom: true,
    preventTouchScroll: true,
    preventSafariGestures: true,
    preventPageJumpKeys: true,
  });

  private attached = false;
  private canvas: HTMLCanvasElement | undefined;
  private canvasDraggableBeforeAttach = false;
  private touchActionBeforeAttach: string | undefined;
  private userSelectBeforeAttach: string | undefined;
  private webkitUserSelectBeforeAttach: string | undefined;
  private webkitUserDragBeforeAttach: string | undefined;
  private webkitTouchCalloutBeforeAttach: string | undefined;
  private webkitTapHighlightColorBeforeAttach: string | undefined;
  private readonly config: BrowserInputGuardConfig;

  constructor(config: Partial<BrowserInputGuardConfig> = {}) {
    this.config = {
      ...BrowserInputGuard.DefaultConfig,
      ...config,
    };
  }

  attach(canvas: HTMLCanvasElement): void {
    if (this.attached) {
      return;
    }

    this.canvas = canvas;
    this.canvasDraggableBeforeAttach = canvas.draggable;
    this.touchActionBeforeAttach = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    if (this.config.preventTextSelection) {
      this.userSelectBeforeAttach = canvas.style.getPropertyValue('user-select');
      this.webkitUserSelectBeforeAttach = canvas.style.getPropertyValue('-webkit-user-select');
      this.webkitUserDragBeforeAttach = canvas.style.getPropertyValue('-webkit-user-drag');
      canvas.draggable = false;
      canvas.style.setProperty('user-select', 'none');
      canvas.style.setProperty('-webkit-user-select', 'none');
      canvas.style.setProperty('-webkit-user-drag', 'none');
      canvas.addEventListener('selectstart', this.onSelectStart, { passive: false });
      canvas.addEventListener('dragstart', this.onDragStart, { passive: false });
    }
    if (this.config.preventTouchCallout) {
      this.webkitTouchCalloutBeforeAttach = canvas.style.getPropertyValue('-webkit-touch-callout');
      this.webkitTapHighlightColorBeforeAttach = canvas.style.getPropertyValue(
        '-webkit-tap-highlight-color',
      );
      canvas.style.setProperty('-webkit-touch-callout', 'none');
      canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    }

    if (this.config.preventWheel) {
      canvas.addEventListener('wheel', this.onWheel, { passive: false });
    }
    if (this.config.preventContextMenu) {
      canvas.addEventListener('contextmenu', this.onContextMenu, { passive: false });
    }
    if (this.config.preventTouchScroll || this.config.preventPinchZoom) {
      canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    }
    if (this.config.preventPinchZoom) {
      canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    }
    if (this.config.preventSafariGestures) {
      canvas.addEventListener('gesturestart', this.onGestureStart, { passive: false });
      canvas.addEventListener('gesturechange', this.onGestureChange, { passive: false });
      canvas.addEventListener('gestureend', this.onGestureEnd, { passive: false });
    }
    if (this.config.preventPageJumpKeys) {
      window.addEventListener('keydown', this.onKeyDown, { passive: false });
    }

    this.attached = true;
  }

  dispose(): void {
    if (!this.attached || this.canvas === undefined) {
      return;
    }

    const canvas = this.canvas;
    canvas.draggable = this.canvasDraggableBeforeAttach;
    canvas.style.touchAction = this.touchActionBeforeAttach ?? '';

    if (this.config.preventTextSelection) {
      canvas.style.setProperty('user-select', this.userSelectBeforeAttach ?? '');
      canvas.style.setProperty('-webkit-user-select', this.webkitUserSelectBeforeAttach ?? '');
      canvas.style.setProperty('-webkit-user-drag', this.webkitUserDragBeforeAttach ?? '');
      canvas.removeEventListener('selectstart', this.onSelectStart);
      canvas.removeEventListener('dragstart', this.onDragStart);
    }
    if (this.config.preventTouchCallout) {
      canvas.style.setProperty('-webkit-touch-callout', this.webkitTouchCalloutBeforeAttach ?? '');
      canvas.style.setProperty(
        '-webkit-tap-highlight-color',
        this.webkitTapHighlightColorBeforeAttach ?? '',
      );
    }

    if (this.config.preventWheel) {
      canvas.removeEventListener('wheel', this.onWheel);
    }
    if (this.config.preventContextMenu) {
      canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    if (this.config.preventTouchScroll || this.config.preventPinchZoom) {
      canvas.removeEventListener('touchmove', this.onTouchMove);
    }
    if (this.config.preventPinchZoom) {
      canvas.removeEventListener('touchstart', this.onTouchStart);
    }
    if (this.config.preventSafariGestures) {
      canvas.removeEventListener('gesturestart', this.onGestureStart);
      canvas.removeEventListener('gesturechange', this.onGestureChange);
      canvas.removeEventListener('gestureend', this.onGestureEnd);
    }
    if (this.config.preventPageJumpKeys) {
      window.removeEventListener('keydown', this.onKeyDown);
    }

    this.canvas = undefined;
    this.canvasDraggableBeforeAttach = false;
    this.touchActionBeforeAttach = undefined;
    this.userSelectBeforeAttach = undefined;
    this.webkitUserSelectBeforeAttach = undefined;
    this.webkitUserDragBeforeAttach = undefined;
    this.webkitTouchCalloutBeforeAttach = undefined;
    this.webkitTapHighlightColorBeforeAttach = undefined;
    this.attached = false;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onSelectStart = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onDragStart = (event: DragEvent): void => {
    event.preventDefault();
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.config.preventTouchScroll) {
      event.preventDefault();
      return;
    }

    if (this.config.preventPinchZoom && event.touches.length > 1) {
      event.preventDefault();
    }
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  };

  private readonly onGestureStart = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onGestureChange = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onGestureEnd = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!BrowserInputGuard.isPageJumpKey(event.key)) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && BrowserInputGuard.isEditableTarget(target)) {
      return;
    }

    event.preventDefault();
  };

  private static isPageJumpKey(key: string): boolean {
    return (
      key === ' ' ||
      key === 'Spacebar' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
    );
  }

  private static isEditableTarget(target: HTMLElement): boolean {
    if (target.isContentEditable) {
      return true;
    }

    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }
}
