import { Util, type HandlerMap } from '../core';
import { DomEvent, DomUtil } from '../dom';
import type { LatLng } from '../geog';
import { Bounds, type Point } from '../geom';
import type { Map } from '../map';
import { Layer } from './Layer.js';

/**
 * Represents an HTML element that covers ("blankets") the entire surface
 * of the map.
 *
 * Do not use this class directly. It's meant for `Renderer`, and for plugins
 * that rely on one single HTML element.
 *
 * Subclass implementations shall reset container parameters and data
 * structures as needed.
 */
export abstract class BlanketOverlay extends Layer {

	options = {
		// @option padding: Number = 0.1
		// How much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction
		padding: 0.1,

		// @option continuous: Boolean = false
		// When `false`, the blanket will update its position only when the
		// map state settles (*after* a pan/zoom animation). When `true`,
		// it will update when the map state changes (*during* pan/zoom
		// animations)
		continuous: false,
	};

	_container!: HTMLElement | undefined;
	_bounds: Bounds | undefined;
	_center: LatLng | undefined;
	_zoom: number | undefined;

	constructor(options: any /* TODO */) {
		super();
		Util.setOptions(this, options);
	}

	/**
	 * (Optional) Runs on the map's `zoomend` event.
	 */
	_onZoomEnd?(ev?: MouseEvent): void;

	/**
	 * (Optional) Runs on the map's `viewreset` event.
	 */
	_onViewReset?(ev?: MouseEvent): void;

	/**
	 * Runs whenever the map state settles after changing (at the end of pan/zoom
	 * animations, etc). This should trigger the bulk of any rendering logic.
	 */
	abstract _onSettled(): void;

	onAdd(_map: Map): this {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			// always keep transform-origin as 0 0, #8794
			// TODO: null safety
			this._container!.classList.add('leaflet-zoom-animated');
		}

		// TODO: null safety
		this.getPane()!.appendChild(this._container!);
		this._resizeContainer();
		this._onMoveEnd();

		return this;
	}

	onRemove(): this {
		this._destroyContainer();
		return this;
	}

	getEvents(): HandlerMap {
		const events: HandlerMap = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._onMoveEnd,
			zoomend: this._onZoomEnd || Util.falseFn,
			resize: this._resizeContainer,
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._onAnimZoom;
		}
		if (this.options.continuous) {
			events.move = this._onMoveEnd;
		}
		return events;
	}

	_onAnimZoom(ev: any): void {
		this._updateTransform(ev.center, ev.zoom);
	}

	_onZoom(): void {
		// TODO: null safety
		this._updateTransform(this._map!.getCenter(), this._map!._zoom);
	}

	_updateTransform(center: LatLng, zoom: number): void {
		const
			map = this._map!, // TODO: null safety
			scale = map.getZoomScale(zoom, this._zoom),
		    viewHalf = map.getSize().multiplyBy(0.5 + this.options.padding),
		    currentCenterPoint = map.project(this._center!, zoom), // TODO: null safety
		    topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
		        .subtract(map._getNewPixelOrigin(center, zoom));

		// TODO: null safety
		DomUtil.setTransform(this._container!, topLeftOffset, scale);
	}


	/**
	 * If the `continuous` option is set to `true`, then this also runs on
	 * any map state change (including *during* pan/zoom animations).
	 */
	_onMoveEnd(): void {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		const
			map = this._map!, // TODO: null safety
			p = this.options.padding,
		    size = map.getSize(),
		    min = map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
		this._center = map.getCenter();
		this._zoom = map._zoom;
		this._updateTransform(this._center, this._zoom);
		this._onSettled();
	}

	_reset(): void {
		this._onSettled();
		this._updateTransform(this._center!, this._zoom!); // TODO: null safety
		this._onViewReset?.();
	}

	/**
	 * Must initialize the HTML element to use as blanket, and store it as
	 * `this._container`. The base implementation creates a blank `<div>`.
	 */
	_initContainer(): void {
		this._container = DomUtil.create('div');
	}

	/**
	 * Must destroy the HTML element in `this._container` and free any other
	 * resources. The base implementation destroys the element and removes
	 * any event handlers attached to it.
	 */
	_destroyContainer(): void {
		if (this._container) {
			DomEvent.off(this._container);
			this._container.remove();
			this._container = undefined;
		}
	}

	/**
	 * The base implementation resizes the container (based on the map's size
	 * and taking into account the padding), returning the new size in CSS pixels.
	 */
	_resizeContainer(): Point {
		const
			p = this.options.padding,
			// TODO: null safety
		    size = this._map!.getSize().multiplyBy(1 + p * 2).round();
		// TODO: null safety
		this._container!.style.width = `${size.x}px`;
		this._container!.style.height = `${size.y}px`;
		return size;
	}

}
