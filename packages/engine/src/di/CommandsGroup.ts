import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ProviderGroup } from './ProviderGroup';
import { DiTokens } from './tokens';

import type { Provider } from './types';
import type { BaseCommand } from '@engine/commands/BaseCommand';

/**
 * Command class type compatible with DI `useClass`.
 *
 * @template T - Concrete command type.
 * @example
 * class MyCommand extends BaseCommand {
 *   run() {}
 * }
 * const cls: CommandClass = MyCommand;
 */
export type CommandClass<T extends BaseCommand = BaseCommand> = new () => T;

/**
 * Command class with an optional explicit DI token.
 *
 * @template T - Concrete command type.
 * @example
 * class MyCommand extends BaseCommand {
 *   static readonly diToken = 'MyCommand';
 * }
 */
export type CommandTokenClass<T extends BaseCommand = BaseCommand> = CommandClass<T> & {
  readonly diToken?: string;
};

/**
 * Provider group for commands.
 *
 * @remarks
 * Produces `command:*` tokens with transient lifetime.
 *
 * @example
 * const commands = new CommandsGroup()
 *   .add('OpenDoor', OpenDoorCommand);
 */
export class CommandsGroup extends ProviderGroup {
  private readonly commands = new Map<string, CommandClass>();

  /**
   * Register a command class under a command name.
   *
   * @param {string} name - Command token name.
   * @param {CommandClass} commandClass - Command constructor.
   * @returns {this} Fluent API for chaining.
   * @example
   * commands.add('PopupConfirm', PopupConfirmCommand);
   */
  add(name: string, commandClass: CommandClass): this {
    this.commands.set(name, commandClass);
    return this;
  }

  /**
   * Register a command class using its `diToken` field or class name.
   *
   * @param {CommandTokenClass} commandClass - Command constructor with `diToken`.
   * @returns {this} Fluent API for chaining.
   * @throws {Error} If neither `diToken` nor class name is available.
   * @example
   * commands.addByToken(SpawnStickerCommand);
   */
  addByToken(commandClass: CommandTokenClass): this {
    const token = commandClass.diToken || commandClass.name;
    if (!token) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Command token is required',
        details: { method: 'CommandsGroup.addByToken' },
      });
    }
    return this.add(token, commandClass);
  }

  /**
   * Convert all command registrations into DI providers.
   *
   * @returns {Provider[]} Providers for commands.
   * @example
   * const providers = commands.toProviders();
   */
  toProviders(): Provider[] {
    const providers: Provider[] = [];
    for (const [name, commandClass] of this.commands.entries()) {
      providers.push({
        token: DiTokens.command(name),
        useClass: commandClass,
        lifetime: 'transient',
      });
    }
    return providers;
  }
}
