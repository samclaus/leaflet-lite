import { Class } from './Class.js';
import * as Util from './Util.js';

export interface HandlerFn {
	(this: any, ev: any): void;
}

export interface HandlerMap {
	[eventName: string]: HandlerFn;
}

/**
 * A set of methods shared between event-powered classes (like `Map` and `Marker`).
 * Generally, events allow you to execute some function when something happens with
 * an object (e.g. the user clicks on the map, causing the map to fire `'click'`
 * event).
 *
 * ```js
 * map.on('click', function(e) {
 * 	alert(e.latlng);
 * } );
 * ```
 * Leaflet deals with event listeners by reference, so if you want to add a listener
 * and then remove it, define it as a function:
 *
 * ```js
 * function onClick(e) { ... }
 *
 * map.on('click', onClick);
 * map.off('click', onClick);
 * ```
 */
export class Evented extends Class {

	_events: { [key: string]: [HandlerFn, any, boolean][] } = Object.create(null);
	_parents: Evented[] | undefined; // lazy allocate map since uncommon

	/**
	 * Adds a listener function (`fn`) to a particular event type of the object. You can optionally
	 * specify the context of the listener (object the this keyword will point to). You can also
	 * pass several space-separated types (e.g. `'click dblclick'`).
	 */
	on(types: string, handler: HandlerFn, context?: any, once?: boolean): this;
	on(types: Readonly<HandlerMap>, context?: any, once?: boolean): this;
	on(types: string | Readonly<HandlerMap>, handlerOrContext: any, contextOrOnce?: any, once?: boolean): this {
		if (typeof types === 'string') {
			// types can be a string of space-separated words
			for (const eventName of Util.splitWords(types)) {
				this._on(eventName, handlerOrContext, contextOrOnce, once);
			}
		} else {
			for (const [type, handler] of Object.entries(types)) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, handler, handlerOrContext, contextOrOnce);
			}
		}

		return this;
	}

	/**
	 * Removes a previously added listener function. If no function is specified, it will remove
	 * all the listeners of that particular event from the object. Note that if you passed a
	 * custom context to `on`, you must pass the same context to `off` in order to remove the
	 * listener.
	 */
	off(): this;
	off(types: string, handler?: HandlerFn, context?: any): this;
	off(types: Readonly<HandlerMap>, context?: any): this;
	off(types?: string | Readonly<HandlerMap>, handlerOrContext?: any, context?: any): this {
		if (types === undefined) {
			// clear all listeners if called without arguments
			this._events = Object.create(null);
		} else if (typeof types === 'object') {
			for (const [type, handler] of Object.entries(types)) {
				this._off(type, handler, handlerOrContext);
			}
		} else {
			for (const eventName of Util.splitWords(types)) {
				this._off(eventName, handlerOrContext, context);
			}
		}

		return this;
	}

	// attach listener (without syntactic sugar now)
	_on(type: string, fn: HandlerFn, context?: any, once?: boolean): void {
		// check if fn already there
		if (this._indexOfHandler(type, fn, context) >= 0) {
			return;
		}

		if (context === this) {
			// Less memory footprint.
			context = undefined;
		}

		(this._events[type] ||= []).push([fn, context, !!once]);
	}

	_off(type: string, fn?: HandlerFn, context?: any): void {
		const listeners = this._events[type];

		if (!listeners) {
			return;
		}

		if (!fn) {
			// clear all listeners for a type if function isn't specified
			delete this._events[type];
			return;
		}

		const index = this._indexOfHandler(type, fn, context);

		if (index >= 0) {
			if (listeners.length === 1) {
				listeners.length = 0;
				delete this._events[type]
			} else {
				listeners.splice(index, 1);
			}
		}
	}

	// Fires an event of the specified type. You can optionally provide a data
	// object — the first argument of the listener function will contain its
	// properties. The event can optionally be propagated to event parents.
	fire(type: string, data?: any, propagate?: boolean): this {
		const event = Util.extend({}, data, {
			type,
			target: this,
			sourceTarget: data?.sourceTarget || this
		});
		const listeners = this._events[type];

		if (listeners) {
			// NOTE: array is mutated in-place from within the loop if there are
			// any one-time ('once') listeners
			for (let i = 0; i < listeners.length; i++) {
				const [fn, ctx, once] = listeners[i];

				if (once) {
					listeners.splice(i, 1);
					--i;
				}

				fn.call(ctx || this, event);
			}
			
			// In case all listeners were one-time
			if (!listeners.length) {
				delete this._events[type];
			}
		}

		if (propagate && this._parents) {
			// propagate the event to parents (set with addEventParent)
			for (const parent of this._parents) {
				parent.fire(event.type, Util.extend({
					layer: event.target,
					propagatedFrom: event.target,
					...event,
				}, event), true);
			}
		}

		return this;
	}

	// Returns `true` if a particular event type has any listeners attached to it.
	// The verification can optionally be propagated, it will return `true` if parents have the listener attached to it.
	listens(type: string, propagate?: boolean): boolean;
	listens(type: string, fn?: HandlerFn, context?: any, propagate?: boolean): boolean;
	listens(type: string, fn?: HandlerFn | boolean, context?: any, propagate?: boolean): boolean {
		if (typeof fn !== 'function') {
			if (this._events[type]?.length) {
				return true;
			}

			propagate = fn;
			fn = undefined;
		} else if (this._indexOfHandler(type, fn, context) >= 0) {
			return true;
		}

		if (propagate && this._parents) {
			// also check parents for listeners if event propagates
			for (const parent of this._parents) {
				if (parent.listens(type, fn, context, true)) {
					return true;
				}
			}
		}

		return false;
	}

	// returns the index (number) or -1 if not found
	_indexOfHandler(type: string, fn: HandlerFn, context: any): number {
		const listeners = this._events[type];

		if (listeners) {
			if (context === this) {
				// Less memory footprint.
				context = undefined;
			}
	
			for (let i = 0; i < listeners.length; i++) {
				const listener = listeners[i];

				if (listener[0] === fn && listener[1] === context) {
					return i;
				}
			}
		}

		return -1;
	}

	// Adds an event parent - an `Evented` that will receive propagated events
	addEventParent(parent: Evented): void {
		(this._parents ||= []).push(parent);
	}

	// Removes an event parent, so it will stop receiving propagated events
	removeEventParent(parent: Evented): void {
		const index = this._parents?.indexOf(parent);

		if (typeof index === "number") {
			this._parents!.splice(index, 1);
		}
	}

}
