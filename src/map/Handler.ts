import type { Map } from './Map.js';

/**
 * L.Handler is a base class for handler classes that are used internally to inject
 * interaction features like dragging to classes like Map and Marker.
 */
export abstract class Handler {

	_enabled = false;

	constructor(
		public _map: Map,
	) {}

	abstract addHooks(): void;
	abstract removeHooks(): void;

	enable(): void {
		if (!this._enabled) {
			this._enabled = true;
			this.addHooks();
		}
	}

	disable(): void {
		if (this._enabled) {
			this._enabled = false;
			this.removeHooks();
		}
	}

}
