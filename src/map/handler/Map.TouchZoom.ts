import { Handler, type Map } from '..';
import { DomEvent } from '../../dom';
import type { LatLng } from '../../geo';
import type { Point } from '../../geometry';

export interface TouchZoomOptions {
	/**
	 * Whether the map should zoom to the center of the view regardless of
	 * where the touch events (fingers) were. Defaults to false;
	 */
	touchZoomCentered: boolean;

	/**
	 * Set it to false if you don't want the map to zoom beyond min/max zoom
	 * and then bounce back when pinch-zooming.
	 */
	bounceAtZoomLimits: boolean;
}

/**
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */
export class TouchZoom extends Handler {

	_moved = false;
	_zooming = false;
	_animRequest = 0; // requestAnimationFrame handle
	_startDist = 0;
	_startZoom = 0;
	_centerPoint: Point | undefined;
	_center: LatLng | undefined;
	_zoom = 0;
	_startLatLng: LatLng | undefined;
	_pinchStartLatLng: LatLng | undefined;
	
	options: TouchZoomOptions;

	constructor(
		map: Map,
		options: Partial<TouchZoomOptions>,
	) {
		super(map);

		this.options = {
			touchZoomCentered: false,
			bounceAtZoomLimits: true,
			...options,
		};
	}

	addHooks() {
		this._map._container.classList.add('leaflet-touch-zoom');
		DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
	}

	removeHooks() {
		this._map._container.classList.remove('leaflet-touch-zoom');
		DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
	}

	_onTouchStart(e: TouchEvent) {
		const map = this._map;

		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		const
			p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]);

		this._centerPoint = map.getSize()._divideBy(2);
		this._startLatLng = map.containerPointToLatLng(this._centerPoint);

		if (!this.options.touchZoomCentered) {
			this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
		}

		this._startDist = p1.distanceTo(p2);
		this._startZoom = map._zoom;
		this._moved = false;
		this._zooming = true;

		map._stop();

		// TODO: improve/remove DOM event code and remove these typecasts
		DomEvent.on(document as any, 'touchmove', this._onTouchMove, this);
		DomEvent.on(document as any, 'touchend touchcancel', this._onTouchEnd, this);
		DomEvent.preventDefault(e);
	}

	_onTouchMove(e: TouchEvent) {
		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		const
			map = this._map,
		    p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]),
		    scale = p1.distanceTo(p2) / this._startDist;

		this._zoom = map.getScaleZoom(scale, this._startZoom);

		if (
			!this.options.bounceAtZoomLimits &&
			(
				(this._zoom < map.getMinZoom() && scale < 1) ||
				(this._zoom > map.getMaxZoom() && scale > 1)
			)
		) {
			this._zoom = map._limitZoom(this._zoom);
		}

		if (this.options.touchZoomCentered) {
			this._center = this._startLatLng;
			if (scale === 1) { return; }
		} else {
			// Get delta from pinch to center, so centerLatLng is delta applied to initial pinchLatLng
			const delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint!); // TODO: null safety
			if (scale === 1 && delta.x === 0 && delta.y === 0) { return; }
			// TODO: null safety
			this._center = map.unproject(map.project(this._pinchStartLatLng!, this._zoom).subtract(delta), this._zoom);
		}

		if (!this._moved) {
			map._moveStart(true, false);
			this._moved = true;
		}

		cancelAnimationFrame(this._animRequest);

		const moveFn = map._move.bind(map, this._center, this._zoom, {pinch: true, round: false}, undefined);
		this._animRequest = requestAnimationFrame(moveFn.bind(this));

		DomEvent.preventDefault(e);
	}

	_onTouchEnd() {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		cancelAnimationFrame(this._animRequest);

		// TODO: improve/remove DOM event code and remove these typecasts
		DomEvent.off(document as any, 'touchmove', this._onTouchMove, this);
		DomEvent.off(document as any, 'touchend touchcancel', this._onTouchEnd, this);

		// Pinch updates GridLayers' levels only when zoomSnap is off, so zoomSnap becomes noUpdate.
		if (this._map.options.zoomAnimation) {
			// TODO: null safety
			this._map._animateZoom(this._center!, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap as any); // TODO: cast to boolean with !!?
		} else {
			// TODO: null safety
			this._map._resetView(this._center!, this._map._limitZoom(this._zoom));
		}
	}

}
