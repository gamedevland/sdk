/** Public API barrel for the configs subsystem. */
export * from './types';
export * from './common/Locales';
export * from './common/LocaleDictionaryConfigDecoder';
export * from './common/TextStyles';
export * from './common/TextStylesConfigDecoder';
export * from './core/ConfigStore';
export * from './services/DecodedConfigStore';
export * from './services/ConfigEntry';
export * from './services/IndexedDbStorageAdapter';
export * from './services/LocalesService';
export * from './services/LocalStorageAdapter';
export * from './services/PersistentStorageAdapter';
export * from './services/PersistentStorageCoordinator';
export * from './services/SettingsEntry';
export * from './services/SettingsService';
export * from './services/StorageNamespace';
export * from './services/TypedStateStore';
