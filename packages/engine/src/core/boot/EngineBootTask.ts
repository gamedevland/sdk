export interface EngineBootTask {
  run(): Promise<void>;
}
