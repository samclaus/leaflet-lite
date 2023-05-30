import type { Map } from '../map/Map.js';
import { Class } from './Class.js';

/**
 * L.Handler is a base class for handler classes that are used internally to inject
 * interaction features like dragging to classes like Map and Marker.
 */
export abstract class Handler extends Class {

	_enabled = false;

	constructor(
		public _map: Map,
	) {
		super();
	}

	abstract addHooks(): void;
	abstract removeHooks(): void;

	// @method enable(): this
	// Enables the handler
	enable() {
		if (this._enabled) { return this; }

		this._enabled = true;
		this.addHooks();
		return this;
	}

	// @method disable(): this
	// Disables the handler
	disable() {
		if (!this._enabled) { return this; }

		this._enabled = false;
		this.removeHooks();
		return this;
	}

	// @method enabled(): Boolean
	// Returns `true` if the handler is enabled
	enabled(): boolean {
		return this._enabled;
	}

}
