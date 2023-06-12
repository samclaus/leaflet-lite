import type { HandlerFn } from '../core/Events.js';
import { falseFn } from '../core/Util.js';

const pEvent: Dict<string> = {
	touchstart  : 'pointerdown',
	touchmove   : 'pointermove',
	touchend    : 'pointerup',
	touchcancel : 'pointercancel'
};
const handle: Dict<(handler: HandlerFn, ev: any) => void> = {
	touchstart  : _handlePointer,
	touchmove   : _handlePointer,
	touchend    : _handlePointer,
	touchcancel : _handlePointer
};
const _pointers: { [pointerID: number]: PointerEvent } = {};
let _pointerDocListener = false;

// Provides a touch events wrapper for pointer events.
// ref https://www.w3.org/TR/pointerevents/

export function addPointerListener(this: any, obj: EventTarget, type: string, handler: HandlerFn): HandlerFn {
	if (type === 'touchstart') {
		_addPointerDocListener();
	}
	if (!handle[type]) {
		console.warn('wrong event specified:', type);
		return falseFn;
	}
	handler = handle[type].bind(this, handler);
	obj.addEventListener(pEvent[type], handler, false);
	return handler;
}

export function removePointerListener(obj: EventTarget, type: string, handler: HandlerFn): void {
	if (!pEvent[type]) {
		console.warn('wrong event specified:', type);
		return;
	}
	obj.removeEventListener(pEvent[type], handler, false);
}

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

function _addPointerDocListener(): void {
	// need to keep track of what pointers and how many are active to provide e.touches emulation
	if (!_pointerDocListener) {
		// we listen document as any drags that end by moving the touch off the screen get fired there
		document.addEventListener('pointerdown', _globalPointerDown, true);
		document.addEventListener('pointermove', _globalPointerMove, true);
		document.addEventListener('pointerup', _globalPointerUp, true);
		document.addEventListener('pointercancel', _globalPointerUp, true);

		_pointerDocListener = true;
	}
}

function _handlePointer(handler: HandlerFn, e: any): void {
	if (e.pointerType === 'mouse') { return; }

	e.touches = [];
	for (const value of Object.values(_pointers)) {
		e.touches.push(value);
	}
	e.changedTouches = [e];

	handler(e);
}
