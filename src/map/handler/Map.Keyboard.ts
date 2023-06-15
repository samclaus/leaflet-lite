import { Handler, Map } from '..';
import { DomEvent } from '../../dom';
import { Point } from '../../geom';

export interface KeyboardOptions {
	/**
	 * Number of pixels to pan when pressing an arrow key. Default is 80.
	 */
	panDelta: number;
}

const keyCodes = {
	left:    ['ArrowLeft'],
	right:   ['ArrowRight'],
	down:    ['ArrowDown'],
	up:      ['ArrowUp'],
	zoomIn:  ['Equal', 'NumpadAdd', 'BracketRight'],
	zoomOut: ['Minus', 'NumpadSubtract', 'Digit6', 'Slash']
} as const;

/**
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */
export class Keyboard extends Handler {

	_focused = false;
	_panKeys: Dict<Point> = Object.create(null);
	_zoomKeys: Dict<number> = Object.create(null);

	constructor(
		map: Map,
		{ panDelta = 80 }: Partial<KeyboardOptions> = {},
	) {
		super(map);

		this._setPanDelta(panDelta);
		this._setZoomDelta(map.options.zoomDelta);
	}

	addHooks(): void {
		const container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex <= 0) {
			container.tabIndex = 0;
		}

		DomEvent.on(container, {
			focus: this._onFocus,
			blur: this._onBlur,
			pointerdown: this._onPointerDown
		}, this);

		this._map.on({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	}

	removeHooks(): void {
		this._removeHooks();

		DomEvent.off(this._map._container, {
			focus: this._onFocus,
			blur: this._onBlur,
			pointerdown: this._onPointerDown
		}, this);

		this._map.off({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	}

	//  acquire/lose focus #594, #1228, #1540
	_onPointerDown() {
		if (this._focused) { return; }

		const body = document.body,
		    docEl = document.documentElement,
		    top = body.scrollTop || docEl.scrollTop,
		    left = body.scrollLeft || docEl.scrollLeft;

		this._map._container.focus();

		window.scrollTo(left, top);
	}

	_onFocus(): void {
		this._focused = true;
		this._map.fire('focus');
	}

	_onBlur(): void {
		this._focused = false;
		this._map.fire('blur');
	}

	_setPanDelta(panDelta: number): void {
		const
			keys: typeof this._panKeys = this._panKeys = {},
		    codes = keyCodes;

		let i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = new Point(-1 * panDelta, 0);
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = new Point(panDelta, 0);
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = new Point(0, panDelta);
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = new Point(0, -1 * panDelta);
		}
	}

	_setZoomDelta(zoomDelta: number): void {
		const
			keys = this._zoomKeys = {} as { [key: string]: any },
		    codes = keyCodes;

		let i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoomDelta;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoomDelta;
		}
	}

	_addHooks() {
		DomEvent.on(document, 'keydown', this._onKeyDown, this);
	}

	_removeHooks() {
		DomEvent.off(document, 'keydown', this._onKeyDown, this);
	}

	_onKeyDown(e: KeyboardEvent): void {
		if (e.altKey || e.ctrlKey || e.metaKey) { return; }

		const key = e.code,
		     map = this._map;
		let offset;

		if (key in this._panKeys) {
			if (!map._panAnim || !map._panAnim._inProgress) {
				offset = this._panKeys[key];

				if (e.shiftKey) {
					offset = offset.multiplyBy(3);
				}

				if (map.options.maxBounds) {
					offset = map._limitOffset(offset, map.options.maxBounds);
				}

				if (map.options.worldCopyJump) {
					const newLatLng = map.wrapLatLng(map.unproject(map.project(map.getCenter()).add(offset)));
					map.panTo(newLatLng);
				} else {
					map.panBy(offset);
				}
			}
		} else if (key in this._zoomKeys) {
			map.setZoom(map._zoom + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);
		} else {
			return;
		}

		DomEvent.stop(e);
	}

}
