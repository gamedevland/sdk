/**
 * Shared GameDistribution bootstrap protocol used by builder and runtime.
 */
export class GameDistributionBootstrapContract {
  static readonly BRIDGE_KEY = '__ENGINE_GAMEDISTRIBUTION_BRIDGE__';
  static readonly SDK_SCRIPT_ID = 'gamedistribution-jssdk';
  static readonly SDK_SCRIPT_SRC = 'https://html5.api.gamedistribution.com/main.min.js';

  static createBootstrapScript(gameId: string): string {
    const bridgeKey = JSON.stringify(GameDistributionBootstrapContract.BRIDGE_KEY);
    const serializedGameId = JSON.stringify(gameId);

    return `;(function(w){var bridge=w[${bridgeKey}];if(!bridge){bridge={queue:[],listeners:new Set()};w[${bridgeKey}]=bridge;}w.GD_OPTIONS={gameId:${serializedGameId},onEvent:function(event){var activeBridge=w[${bridgeKey}];if(!activeBridge){activeBridge={queue:[],listeners:new Set()};w[${bridgeKey}]=activeBridge;}if(activeBridge.listeners.size===0){activeBridge.queue.push(event);}activeBridge.listeners.forEach(function(listener){try{listener(event);}catch(_error){}});}};})(window);`;
  }
}
