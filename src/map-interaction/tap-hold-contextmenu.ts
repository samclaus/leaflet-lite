import { DomEvent } from '../dom';
import { Point } from '../geom';
import type { Map } from '../map';
import { BehaviorBase } from './_behavior-base';

const tapHoldDelay = 600;

export interface TapHoldOptions {
	/**
	 * The max number of pixels a user can shift their finger during touch
	 * for it to be considered a valid tap. Default is 15.
	 */
	tolerance: number;
}

function _cancelClickPrevent(): void {
	DomEvent.off(document, 'touchend', DomEvent.preventDefault);
	DomEvent.off(document, 'touchend touchcancel', _cancelClickPrevent);
}

/**
 * Simulates `contextmenu` event on long hold, which otherwise
 * is not fired by mobile Safari.
 * 
 * Use the following code to check if running on mobile Safari:
 * 
 * ```javascript
 * import { Browser } from 'leaflet-lite';
 * 
 * if (Browser.touchNative && Browser.safari && Browser.mobile) {
 * 	   // ...
 * }
 * ```
 */
export class TapHold extends BehaviorBase {

	_holdTimeout: number | undefined;
	_startPos!: Point; // TODO: null safety
	_newPos!: Point; // TODO: null safety
	_tolerance: number;

	constructor(
		map: Map,
		{ tolerance = 15 }: Partial<TapHoldOptions> = {}
	) {
		super(map);

		this._tolerance = tolerance;

		DomEvent.on(map._container, 'touchstart', this._onDown, this);
	}

	_removeHooks(): void {
		DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	}

	_onDown(e: TouchEvent): void {
		clearTimeout(this._holdTimeout);
		if (e.touches.length !== 1) { return; }

		const first = e.touches[0];
		this._startPos = this._newPos = new Point(first.clientX, first.clientY);

		this._holdTimeout = setTimeout((() => {
			this._cancel();

			if (this._newPos.distanceTo(this._startPos) > this._tolerance) {
				return;
			}

			// prevent simulated mouse events https://w3c.github.io/touch-events/#mouse-events
			DomEvent.on(document, 'touchend', DomEvent.preventDefault);
			DomEvent.on(document, 'touchend touchcancel', _cancelClickPrevent);
			this._simulateEvent('contextmenu', first);
		}), tapHoldDelay);

		DomEvent.on(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.on(document, 'touchmove', this._onMove, this);
	}

	_cancel(): void {
		clearTimeout(this._holdTimeout);
		DomEvent.off(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.off(document, 'touchmove', this._onMove, this);
	}

	_onMove(e: TouchEvent): void {
		const first = e.touches[0];
		this._newPos = new Point(first.clientX, first.clientY);
	}

	_simulateEvent(type: string, e: Touch): void {
		const simulatedEvent = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			view: window,
			// detail: 1,
			screenX: e.screenX,
			screenY: e.screenY,
			clientX: e.clientX,
			clientY: e.clientY,
			// button: 2,
			// buttons: 2
		});

		if (e.target) {
			e.target.dispatchEvent(simulatedEvent);
		}
	}

}
