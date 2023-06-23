import { Handler, Map } from '..';
import { DomEvent, DomUtil } from '../../dom';
import { LatLngBounds } from '../../geog';
import { Bounds, type Point } from '../../geom';

/**
 * L.Handler.BoxZoom is used to add shift-drag zoom interaction to the map
 * (zoom to a selected bounding box).
 */
export class BoxZoom extends Handler {

	_container: HTMLElement;
	_pane: any; // TODO: type?
	_resetStateTimeout = 0;
	_moved = false;
	_startPoint: Point | undefined;
	_point: Point | undefined;
	_box: HTMLElement | undefined;

	constructor(map: Map) {
		super(map);

		this._container = map._container;
		this._pane = map._panes.overlay;

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
		if (!e.shiftKey || (e.button !== 0)) { return; }

		// Clear the deferred resetState if it hasn't executed yet, otherwise it
		// will interrupt the interaction and orphan a box element in the container.
		this._clearDeferredResetState();
		this._resetState();

		DomUtil.disableTextSelection();
		DomUtil.disableImageDrag();

		this._startPoint = this._map.mouseEventToContainerPoint(e);

		// TODO: refactor/remove DOM event code and make things more kosher
		DomEvent.on(document as unknown as HTMLElement, {
			contextmenu: DomEvent.stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	}

	_onMouseMove(e: any): void {
		if (!this._moved) {
			this._moved = true;
			this._box = DomUtil.create('div', 'leaflet-zoom-box', this._container);
			this._container.classList.add('leaflet-crosshair');
			this._map.fire('boxzoomstart');
		}

		this._point = this._map.mouseEventToContainerPoint(e);

		const
			box = this._box!, // TODO: null safety
			bounds = new Bounds(this._point, this._startPoint!), // TODO: null safety
		    size = bounds.getSize();

		DomUtil.setPosition(box, bounds.min);

		box.style.width  = `${size.x}px`;
		box.style.height = `${size.y}px`;
	}

	_finish(): void {
		if (this._moved) {
			this._box!.remove(); // TODO: null safety
			this._container.classList.remove('leaflet-crosshair');
		}

		DomUtil.enableTextSelection();
		DomUtil.enableImageDrag();
		// TODO: refactor/remove DOM event code and make things more kosher
		DomEvent.off(document as unknown as HTMLElement, {
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
			this._map.containerPointToLatLng(this._startPoint!), // TODO: null safety
			this._map.containerPointToLatLng(this._point!), // TODO: null safety
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
