import {Map} from '../Map.js';
import {Handler} from '../../core/Handler.js';
import * as DomUtil from '../../dom/DomUtil.js';
import * as DomEvent from '../../dom/DomEvent.js';
import {LatLngBounds} from '../../geo/LatLngBounds.js';
import {Bounds} from '../../geometry/Bounds.js';
import type { Point } from '../../Leaflet.js';

/**
 * L.Handler.BoxZoom is used to add shift-drag zoom interaction to the map
 * (zoom to a selected bounding box), enabled by default.
 */
export class BoxZoom extends Handler {

	_container: HTMLElement;
	_pane: any; // TODO: type?
	_resetStateTimeout = 0;
	_moved = false;
	_startPoint: Point | undefined;
	_box: HTMLElement | undefined;

	constructor(map: Map) {
		super(map);

		this._container = map._container;
		this._pane = map._panes.overlayPane;

		map.on('unload', this._destroy, this);
	}

	addHooks(): void {
		DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
	}

	removeHooks(): void {
		DomEvent.off(this._container, 'mousedown', this._onMouseDown, this);
	}

	_destroy(): void {
		this._pane.remove();
		this._pane = undefined;
	}

	_resetState(): void {
		this._resetStateTimeout = 0;
		this._moved = false;
	}

	_clearDeferredResetState(): void {
		clearTimeout(this._resetStateTimeout);
		this._resetStateTimeout = 0;
	}

	_onMouseDown(e: MouseEvent): void {
		if (!e.shiftKey || (e.button !== 0)) { return false; }

		// Clear the deferred resetState if it hasn't executed yet, otherwise it
		// will interrupt the interaction and orphan a box element in the container.
		this._clearDeferredResetState();
		this._resetState();

		DomUtil.disableTextSelection();
		DomUtil.disableImageDrag();

		this._startPoint = this._map.mouseEventToContainerPoint(e);

		DomEvent.on(document, {
			contextmenu: DomEvent.stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	}

	_onMouseMove(e) {
		if (!this._moved) {
			this._moved = true;
			this._box = DomUtil.create('div', 'leaflet-zoom-box', this._container);
			this._container.classList.add('leaflet-crosshair');
			this._map.fire('boxzoomstart');
		}

		this._point = this._map.mouseEventToContainerPoint(e);

		const
			bounds = new Bounds(this._point, this._startPoint),
		    size = bounds.getSize();

		DomUtil.setPosition(this._box, bounds.min);

		this._box.style.width  = `${size.x}px`;
		this._box.style.height = `${size.y}px`;
	}

	_finish(): void {
		if (this._moved) {
			this._box.remove();
			this._container.classList.remove('leaflet-crosshair');
		}

		DomUtil.enableTextSelection();
		DomUtil.enableImageDrag();
		DomEvent.off(document, {
			contextmenu: DomEvent.stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	}

	_onMouseUp(e: MouseEvent): void {
		if (e.button !== 0) { return; }

		this._finish();

		if (!this._moved) { return; }
		// Postpone to next JS tick so internal click event handling
		// still see it as "moved".
		this._clearDeferredResetState();
		this._resetStateTimeout = setTimeout(this._resetState.bind(this), 0);

		const bounds = new LatLngBounds(
			this._map.containerPointToLatLng(this._startPoint),
			this._map.containerPointToLatLng(this._point),
		);

		this._map
			.fitBounds(bounds)
			.fire('boxzoomend', {boxZoomBounds: bounds});
	}

	_onKeyDown(e: KeyboardEvent): void {
		if (e.code === 'Escape') {
			this._finish();
			this._clearDeferredResetState();
			this._resetState();
		}
	}

}
