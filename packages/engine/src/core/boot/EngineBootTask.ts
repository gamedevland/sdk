export interface EngineBootTask {
  run(signal?: AbortSignal): Promise<void>;
}
