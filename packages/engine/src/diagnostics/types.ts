export type RuntimeDiagnostic =
  | { readonly kind: 'error'; readonly error: unknown; readonly source: string; readonly eventType?: string }
  | { readonly kind: 'timing'; readonly source: string; readonly durationMs: number; readonly frame?: number }
  | { readonly kind: 'frame'; readonly rawDelta: number; readonly simulationDelta: number };
export type RuntimeDiagnosticObserver = (record: RuntimeDiagnostic) => void;
