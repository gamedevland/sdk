import { EngineError, EngineErrorCode, EngineSubsystem } from '@engine/errors';

interface CommandSceneScopeInvalidatedDetails {
  readonly commandName: string;
  readonly commandSceneScopeVersion: number;
  readonly currentSceneScopeVersion: number;
}

export class CommandSceneScopeInvalidatedError extends EngineError {
  constructor(details: CommandSceneScopeInvalidatedDetails) {
    super({
      code: EngineErrorCode.SceneInvalidState,
      subsystem: EngineSubsystem.Scene,
      message: 'Command scene scope is no longer active',
      details: {
        method: 'BaseCommand.assertSceneScopeActive',
        command: details.commandName,
        commandSceneScopeVersion: String(details.commandSceneScopeVersion),
        currentSceneScopeVersion: String(details.currentSceneScopeVersion),
      },
    });
  }
}
