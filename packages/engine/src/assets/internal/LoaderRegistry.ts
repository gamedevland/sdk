import type { AssetType, Loader } from '../types';

/** Loader registration by declared asset type. */
export class LoaderRegistry {
  private readonly loaders = new Map<AssetType, Loader>();
  register(type: AssetType, loader: Loader): void {
    this.loaders.set(type, loader);
  }
  get(type: AssetType): Loader | undefined {
    return this.loaders.get(type);
  }
}
