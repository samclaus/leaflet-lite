import { DomEvent } from '../dom';
import { Point } from '../geom';
import type { Map } from '../map';
import { BehaviorBase } from './_behavior-base';

export interface KeyboardOptions {
	/**
	 * Number of pixels to pan when pressing an arrow key. Default is 80.
	 */
	panDelta: number;

	// TODO refactor, move to CRS
	// @option worldCopyJump: Boolean = false
	// With this option enabled, the map tracks when you pan to another "copy"
	// of the world and seamlessly jumps to the original one so that all overlays
	// like markers and vector layers are still visible.
	worldCopyJump: boolean;
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
 * Enables panning/zooming the map via keyboard. Listens for `keydown` events on the document
 * root only when the map is focused, so there is little to no risk of interfering with other
 * keyboard shortcuts or component behavior.
 */
export class Keyboard extends BehaviorBase {

	_focused = false;
	_panKeys: Dict<Point> = Object.create(null);
	_zoomKeys: Dict<number> = Object.create(null);
	_worldCopyJump: boolean;

	constructor(
		map: Map,
		{ panDelta = 80, worldCopyJump = false }: Partial<KeyboardOptions> = {},
	) {
		super(map);

		this._worldCopyJump = worldCopyJump;
		this._setPanDelta(panDelta);
		this._setZoomDelta(map.options.zoomDelta);

		const container = map._container;

		// make the container focusable by tabbing
		if (container.tabIndex <= 0) {
			container.tabIndex = 0;
		}

		DomEvent.on(container, {
			focus: this._onFocus,
			blur: this._onBlur,
			pointerdown: this._onPointerDown
		}, this);

		map.on({
			focus: this._addKeydownListener,
			blur: this._removeKeydownListener
		}, this);
	}

	_addKeydownListener(): void {
		DomEvent.on(document, 'keydown', this._onKeyDown, this);
	}

	_removeKeydownListener(): void {
		DomEvent.off(document, 'keydown', this._onKeyDown, this);
	}

	_removeHooks(): void {
		this._removeKeydownListener();

		DomEvent.off(this._map._container, {
			focus: this._onFocus,
			blur: this._onBlur,
			pointerdown: this._onPointerDown
		}, this);

		this._map.off({
			focus: this._addKeydownListener,
			blur: this._removeKeydownListener
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

	_onKeyDown(e: KeyboardEvent): void {
		if (e.altKey || e.ctrlKey || e.metaKey) { return; }

		const
			key = e.code,
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

				if (this._worldCopyJump) {
					const newLatLng = map.wrapLatLng(map.unproject(map.project(map.getCenter()).add(offset)));
					map.panTo(newLatLng);
				} else {
					map.panBy(offset);
				}
			}
		} else if (key in this._zoomKeys) {
			map.setZoom(map._zoom + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);
		} else {
			return; // Don't stop event propagation or prevent it's default behavior
		}

		DomEvent.stop(e);
	}

}
