import Browser from '../core/Browser.js';
import type { HandlerFn, HandlerMap } from '../core/Events.js';
import * as Util from '../core/Util.js';
import { Point } from '../geometry/Point.js';
import { addDoubleTapListener, removeDoubleTapListener, type DoubleTapHandlers } from './DomEvent.DoubleTap.js';
import { addPointerListener, removePointerListener } from './DomEvent.Pointer.js';
import { getScale } from './DomUtil.js';

// This file contains utility functions to work with native DOM events, used by Leaflet internally.

/**
 * Adds a listener function (`fn`) to a particular DOM event type of the
 * element `el`. You can optionally specify the context of the listener
 * (object the `this` keyword will point to). You can also pass several
 * space-separated types (e.g. `'click dblclick'`).
 */
export function on<This>(
	this: This,
	el: HTMLElement,
	types: string,
	handler: HandlerFn,
	context?: any,
): This;
/**
 * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`.
 */
export function on<This>(
	this: This,
	el: HTMLElement,
	handlers: HandlerMap,
	context?: any,
): This;
export function on<This>(
	this: This,
	el: HTMLElement,
	typesOrHandlers: string | HandlerMap,
	handlerOrCtx?: any,
	context?: any,
): This {
	// Inspired by John Resig, Dean Edwards and YUI addEvent implementations.
	if (typeof typesOrHandlers === 'object') {
		for (const [type, listener] of Object.entries(typesOrHandlers)) {
			addOne(el, type, listener, handlerOrCtx);
		}
	} else {
		for (const type of Util.splitWords(typesOrHandlers)) {
			addOne(el, type, handlerOrCtx, context);
		}
	}

	return this;
}

const eventsKey = '_leaflet_events';

/**
 * Removes a previously added listener function for the given space-separated event types.
 * 
 * NOTE: if you passed a custom context to `on(...)`, you must pass the same
 * context to `off(...)` in order to remove the listener.
 */
export function off<This>(
	this: This,
	el: HTMLElement,
	types: string,
	handler: HandlerFn,
	context?: any,
): This;
/**
 * Removes the previously added type/handler pairs.
 * 
 * NOTE: if you passed a custom context to `on(...)`, you must pass the same
 * context to `off(...)` in order to remove the listener.
 */
export function off<This>(
	this: This,
	el: HTMLElement,
	handlers: HandlerMap,
	context?: any,
): This;
/** Removes all previously added listeners of given types. */
export function off<This>(
	this: This,
	el: HTMLElement,
	types: string,
): This;
/** Removes all previously added listeners from given HTMLElement. */
export function off<This>(
	this: This,
	el: HTMLElement,
): This;
export function off(
	this: any,
	el: HTMLElement,
	typesOrHandlers?: string | HandlerMap,
	handlerOrCtx?: any,
	context?: any,
): any {
	if (!typesOrHandlers) {
		// Remove all known listeners for any type of event from the element
		batchRemove(el);
		delete el[eventsKey];
	} else if (typeof typesOrHandlers === 'object') {
		// Remove the given type/listener pairs
		for (const [type, listener] of Object.entries(typesOrHandlers)) {
			removeOne(el, type, listener, handlerOrCtx);
		}
	} else {
		// Remove the single given handler for space-separated list of types
		if (arguments.length === 2) {
			const types = new Set(Util.splitWords(typesOrHandlers));
			batchRemove(el, type => types.has(type));
		} else {
			for (const type of Util.splitWords(typesOrHandlers)) {
				removeOne(el, type, handlerOrCtx, context);
			}
		}
	}

	return this;
}

function batchRemove(el: HTMLElement, filterFn?: (type: string) => any): void {
	const events = el[eventsKey];

	if (!events) return;

	for (const id of Object.keys(events)) {
		const type = id.split(/\d/)[0];
		
		if (!filterFn || filterFn(type)) {
			removeOne(el, type, Util.falseFn, null, id);
		}
	}
}

const mouseSubst: Dict<string | false> = {
	mouseenter: 'mouseover',
	mouseleave: 'mouseout',
	wheel: !('onwheel' in window) && 'mousewheel',
};

function makeHandlerID(type: string, handler: HandlerFn, context: any): string {
	return type + Util.stamp(handler) + (context ? `_${Util.stamp(context)}` : '');
}

function addOne(
	el: HTMLElement,
	type: string,
	fn: HandlerFn,
	context?: any,
): void {
	const id = makeHandlerID(type, fn, context);

	if (el[eventsKey]?.[id]) { return; }

	let handler: HandlerFn | DoubleTapHandlers = function (e) {
		return fn.call(context || el, e || window.event);
	};

	const originalHandler = handler;

	if (!Browser.touchNative && Browser.pointer && type.startsWith('touch')) {
		// Needs DomEvent.Pointer.js
		handler = addPointerListener(el, type, handler);

	} else if (Browser.touch && (type === 'dblclick')) {
		handler = addDoubleTapListener(el, handler);

	} else {

		if (type === 'touchstart' || type === 'touchmove' || type === 'wheel' ||  type === 'mousewheel') {
			el.addEventListener(mouseSubst[type] || type, handler, { passive: false });

		} else if (type === 'mouseenter' || type === 'mouseleave') {
			handler = function (e) {
				e = e || window.event;
				if (isExternalTarget(el, e)) {
					originalHandler(e);
				}
			};
			el.addEventListener(mouseSubst[type] as string /* TODO */, handler, false);

		} else {
			el.addEventListener(type, originalHandler, false);
		}

	}

	el[eventsKey] ||= {};
	el[eventsKey][id] = handler;
}

function removeOne(
	el: HTMLElement,
	type: string,
	fn: HandlerFn,
	context?: any,
	id = makeHandlerID(type, fn, context),
): void {
	const handler = el[eventsKey] && el[eventsKey][id];

	if (!handler) { return; }

	if (!Browser.touchNative && Browser.pointer && type.startsWith('touch')) {
		removePointerListener(el, type, handler);
	} else if (Browser.touch && (type === 'dblclick')) {
		removeDoubleTapListener(el, handler);
	} else {
		el.removeEventListener(mouseSubst[type] || type, handler, false);
	}

	// el[eventsKey] is guaranteed from null check for handler at top of function
	delete el[eventsKey]![id];
}

/**
 * Stop the given event from propagation to parent elements. Used inside the listener functions:
 *
 * ```js
 * L.DomEvent.on(div, 'click', function (ev) {
 * 	L.DomEvent.stopPropagation(ev);
 * });
 * ```
 */
export function stopPropagation<This>(this: This, e: Event & { originalEvent?: any; }): This {
	if (e.stopPropagation) {
		e.stopPropagation();
	} else if (e.originalEvent) {  // In case of Leaflet event.
		e.originalEvent._stopped = true;
	} else {
		e.cancelBubble = true;
	}

	return this;
}

/**
 * Adds `stopPropagation` to the element's `'wheel'` events (plus browser variants).
 */
export function disableScrollPropagation<This>(this: This, el: HTMLElement): This {
	addOne(el, 'wheel', stopPropagation);
	return this;
}

/**
 * Adds `stopPropagation` to the element's `'click'`, `'dblclick'`, `'contextmenu'`,
 * `'mousedown'` and `'touchstart'` events (plus browser variants).
 */
export function disableClickPropagation(el: HTMLElement): void {
	on(el, 'mousedown touchstart dblclick contextmenu', stopPropagation);
	el._leaflet_disable_click = true;
}

/**
 * Prevents the default action of the DOM Event `ev` from happening (such as
 * following a link in the href of the a element, or doing a POST request
 * with page reload when a `<form>` is submitted).
 * Use it inside listener functions.
 */
export function preventDefault<This>(this: This, e: Event): This {
	if (e.preventDefault) {
		e.preventDefault();
	} else {
		e.returnValue = false;
	}
	return this;
}

/** Does `stopPropagation` and `preventDefault` at the same time. */
export function stop<This>(this: This, e: Event): This {
	preventDefault(e);
	stopPropagation(e);
	return this;
}

/**
 * Compatibility polyfill for [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath).
 * Returns an array containing the `HTMLElement`s that the given DOM event
 * should propagate to (if not stopped).
 */
export function getPropagationPath(ev: Event): HTMLElement[] {
	if (ev.composedPath) {
		return ev.composedPath() as HTMLElement[];
	}

	const path = [];

	let el = ev.target as HTMLElement | null;

	while (el) {
		path.push(el);
		el = el.parentNode as HTMLElement | null;
	}

	return path;
}

export interface MouseEventLike {
	readonly clientX: number;
	readonly clientY: number;
}

/**
 * Gets normalized mouse position from a DOM event relative to the
 * `container` (border excluded) or to the whole page if not specified.
 */
export function getMousePosition(e: MouseEventLike, container?: HTMLElement): Point {
	if (!container) {
		return new Point(e.clientX, e.clientY);
	}

	const
		scale = getScale(container),
	    offset = scale.boundingClientRect; // left and top  values are in page scale (like the event clientX/Y)

	return new Point(
		// offset.left/top values are in page scale (like clientX/Y),
		// whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
		(e.clientX - offset.left) / scale.x - container.clientLeft,
		(e.clientY - offset.top) / scale.y - container.clientTop
	);
}

/**
 * Gets the wheel pixel factor based on the devicePixelRatio.
 */
export function getWheelPxFactor(): number {
	// We need double the scroll pixels (see #7403 and #4538) for all Browsers
	// except OSX (Mac) -> 3x, Chrome running on Linux 1x
	const ratio = window.devicePixelRatio;
	return Browser.linux && Browser.chrome ? ratio :
		Browser.mac ? ratio * 3 :
		ratio > 0 ? 2 * ratio : 1;
}

/**
 * Gets normalized wheel delta from a wheel DOM event, in vertical
 * pixels scrolled (negative if scrolling down).
 * Events from pointing devices without precise scrolling are mapped to
 * a best guess of 60 pixels.
 */
export function getWheelDelta(e: WheelEvent): number {
	return (e.deltaY && e.deltaMode === 0) ? -e.deltaY / getWheelPxFactor() : // Pixels
	       (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 : // Lines
	       (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 : // Pages
	       (e.deltaX || e.deltaZ) ? 0 :	// Skip horizontal/depth wheel events
	       (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 : // Legacy Moz lines
	       e.detail ? e.detail / -32765 * 60 : // Legacy Moz pages
	       0;
}

/**
 * Check if element really left/entered the event target (for mouseenter/mouseleave).
 */
export function isExternalTarget(
	el: HTMLElement,
	e: Event & { relatedTarget?: any },
): boolean {
	let related = e.relatedTarget;

	if (!related) { return true; }

	try {
		while (related && (related !== el)) {
			related = related.parentNode;
		}
	} catch (err) {
		return false;
	}

	return (related !== el);
}
