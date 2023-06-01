import { Handler } from '../../core/Handler.js';
import * as DomEvent from '../../dom/DomEvent.js';
import { Point } from '../../geometry/Point.js';

const tapHoldDelay = 600;

/**
 * L.Map.TapHold is used to simulate `contextmenu` event on long hold,
 * which otherwise is not fired by mobile Safari.
 */
export class TapHold extends Handler {

	_holdTimeout: number | undefined;
	_startPos!: Point; // TODO: null safety
	_newPos!: Point; // TODO: null safety

	addHooks(): void {
		DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
	}

	removeHooks(): void {
		DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	}

	_onDown(e: TouchEvent): void {
		clearTimeout(this._holdTimeout);
		if (e.touches.length !== 1) { return; }

		const first = e.touches[0];
		this._startPos = this._newPos = new Point(first.clientX, first.clientY);

		this._holdTimeout = setTimeout((() => {
			this._cancel();
			if (!this._isTapValid()) { return; }

			// prevent simulated mouse events https://w3c.github.io/touch-events/#mouse-events
			DomEvent.on(document, 'touchend', DomEvent.preventDefault);
			DomEvent.on(document, 'touchend touchcancel', this._cancelClickPrevent);
			this._simulateEvent('contextmenu', first);
		}), tapHoldDelay);

		DomEvent.on(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.on(document, 'touchmove', this._onMove, this);
	}

	_cancelClickPrevent = function _cancelClickPrevent(): void {
		DomEvent.off(document, 'touchend', DomEvent.preventDefault);
		DomEvent.off(document, 'touchend touchcancel', _cancelClickPrevent);
	};

	_cancel(): void {
		clearTimeout(this._holdTimeout);
		DomEvent.off(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.off(document, 'touchmove', this._onMove, this);
	}

	_onMove(e: TouchEvent): void {
		const first = e.touches[0];
		this._newPos = new Point(first.clientX, first.clientY);
	}

	_isTapValid(): boolean {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
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
