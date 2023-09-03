import type { Disposable } from '../core';
import type { Map } from '../map/Map.js';

/**
 * This is an internal base class used by some of the behaviors. It will probably
 * be removed in the future.
 */
export abstract class BehaviorBase implements Disposable {

	_disposed = false;

	constructor(
		public _map: Map,
	) {
		_map.on('dispose', this.dispose, this, true);
	}

	abstract _removeHooks(): void;

	dispose(): void {
		if (!this._disposed) {
			this._removeHooks();
			this._disposed = true;
		}
	}

}
