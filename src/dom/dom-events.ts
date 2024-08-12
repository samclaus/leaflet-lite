import { Browser, Util, type Disposable, type HandlerFn, type HandlerMap } from '../core';
import { Point } from '../geom';
import { getScale } from './DomElement.js';

// This file contains utility functions to work with native DOM events, used by Leaflet internally.

// For browsers that support pointer events (a new generic solution to both mouse/touch
// events) but NOT old-style touch events, we shim touch events using pointer events
//
// TODO: this may be a waste of code in 2024, and perhaps the entire codebase should just
// use pointer events directly
const
	touchEvShims: Dict<string> = (!Browser.touchNative && Browser.pointer) ? {
		touchstart:  'pointerdown',
		touchmove:   'pointermove',
		touchend: 	 'pointerup',
		touchcancel: 'pointercancel',
	} : {},
	_pointers: { [pointerID: number]: PointerEvent } = {};

let _pointerDocListener = false;

function _globalPointerDown(e: PointerEvent): void {
	_pointers[e.pointerId] = e;
}

function _globalPointerMove(e: PointerEvent): void {
	if (_pointers[e.pointerId]) {
		_pointers[e.pointerId] = e;
	}
}

function _globalPointerUp(e: PointerEvent): void {
	delete _pointers[e.pointerId];
}

function shimTouchHandler(fn: HandlerFn): HandlerFn {
	return function (e: any): void {
		if (e.pointerType !== 'mouse') {
			e.touches = Object.values(_pointers);
			e.changedTouches = [e];

			fn(e);
		}
	}
}

export class EventSink implements Disposable {

	_fns: [
		string,
		HandlerFn,
		boolean | AddEventListenerOptions | undefined,
	][] = [];

	constructor(
		public _t: EventTarget,
	) {}

	/**
	 * Removes all of this sink's event listeners. The sink is still safe for further use.
	 */
	dispose(): void {
		for (const [type, fn, options] of this._fns) {
			this._t.removeEventListener(type, fn, options);
		}
		this._fns.length = 0;
	}

	/**
	 * `_on()` is a low-level method which simply passes its arguments through to the
	 * standard `EventTarget#addEventListener()` method and stores them so the listener
	 * can be removed later with a call to `dispose()`.
	 */
	_on(type: string, fn: HandlerFn, opts?: boolean | AddEventListenerOptions | undefined): void {
		this._t.addEventListener(type, fn, opts);
		this._fns.push([type, fn, opts]);
	}

	/**
	 * Calls standard `EventTarget#addEventListener()` with a couple caveats:
	 * 
	 * 1. Touch events (`touchstart`, `touchmove`, etc.) are shimmed if unavailable but the
	 * runtime supports pointer events.
	 * 2. You cannot pass options for the listener. This is so that the library can enforce
	 * standard behavior such as always using passive handlers for `wheel` events.
	 * 
	 * The final arguments to `EventTarget#addEventListener()` are stored so that the handler
	 * can be removed later via a call to `dispose()`.
	 */
	on(type: string, fn: HandlerFn): void {
		const shimType = touchEvShims[type];

		if (shimType) {
			if (!_pointerDocListener && type === 'touchstart') {
				// need to keep track of what pointers and how many are active to provide e.touches emulation
				// we listen document as any drags that end by moving the touch off the screen get fired there
				document.addEventListener('pointerdown', _globalPointerDown, true);
				document.addEventListener('pointermove', _globalPointerMove, true);
				document.addEventListener('pointerup', _globalPointerUp, true);
				document.addEventListener('pointercancel', _globalPointerUp, true);
		
				_pointerDocListener = true;
			}

			this._on(shimType, shimTouchHandler(fn), false);
		} else if (type === 'touchstart' || type === 'touchmove' || type === 'wheel') {
			this._on(type, fn, { passive: false });
		} else {
			this._on(type, fn, false);
		}
	}

	/**
	 * Adds a listener function (`fn`) to a particular DOM event type of the
	 * element `el`. You can optionally specify the context of the listener
	 * (object the `this` keyword will point to). You can also pass several
	 * space-separated types (e.g. `'click dblclick'`).
	 */
	onAll(
		types: string,
		handler: HandlerFn,
		ctx?: unknown,
	): EventSink;
	/**
	 * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`.
	 */
	onAll(
		handlers: HandlerMap,
		ctx?: unknown,
	): EventSink;
	onAll(
		typesOrHandlers: string | HandlerMap,
		handlerOrCtx?: any,
		ctx?: unknown,
	): EventSink {
		const sink = new EventSink(this._t);

		if (typeof typesOrHandlers === 'string') {
			if (ctx) {
				handlerOrCtx = handlerOrCtx.bind(ctx);
			}

			for (const type of Util.splitWords(typesOrHandlers)) {
				sink.on(type, handlerOrCtx);
			}
		} else if (handlerOrCtx) {
			for (const type in typesOrHandlers) {
				sink.on(type, typesOrHandlers[type].bind(handlerOrCtx));
			}
		} else {
			for (const type in typesOrHandlers) {
				sink.on(type, typesOrHandlers[type]);
			}
		}

		return sink;
	}

}

/**
 * Convenience function which simply creates a new `EventSink` and calls the `onAll()`
 * method. See `EventSink#onAll()` for details.
 */
export function on(
	target: EventTarget,
	types: string,
	handler: HandlerFn,
	ctx?: unknown,
): EventSink;
/**
 * Convenience function which simply creates a new `EventSink` and calls the `onAll()`
 * method. See `EventSink#onAll()` for details.
 */
export function on(
	target: EventTarget,
	handlers: HandlerMap,
	ctx?: unknown,
): EventSink;
export function on(
	target: EventTarget,
	typesOrHandlers: any,
	handlerOrCtx?: any,
	ctx?: unknown,
): EventSink {
	const sink = new EventSink(target);
	sink.onAll(typesOrHandlers, handlerOrCtx, ctx);
	return sink;
}

/**
 * Prevents the default action of the DOM Event `ev` from happening (such as
 * following a link in the href of the a element, or doing a POST request
 * with page reload when a `<form>` is submitted).
 * Use it inside listener functions.
 */
export function preventDefault(e: Event): void {
	e.preventDefault();
}

/** Does `stopPropagation` and `preventDefault` at the same time. */
export function cancelEvent(e: Event): void {
	e.preventDefault();
	e.stopPropagation();
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
	el: Node,
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
