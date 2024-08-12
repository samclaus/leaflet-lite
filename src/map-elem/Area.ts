import { Util, type Disposable, type HandlerMap } from '../core';
import { DomUtil, type DomElement } from '../dom';
import type { LatLng, LatLngBounds } from '../geog';
import { Bounds } from '../geom';
import type { Map } from '../map';

export interface AreaOptions {
	/**
	 * Which map pane to position the area within. 'overlay' by default.
	 */
	pane: string;
	/**
	 * If `true`, the area will emit [mouse events](#interactive-layer)
	 * when clicked or hovered.
	 */
	interactive: boolean;
}

/**
 * `Area` is used to position/size a DOM element such that it covers a particular
 * area of the map. You provide bounds consisting of 2 latitude-longitude coordinates,
 * and then `Area` will continually update the CSS properties of the element to make
 * sure it covers the resulting rectangle on the map.
 *
 * ```js
 * // TODO: <video> element example for hurricane movement
 * ```
 * 
 * ### How does it work?
 * 
 * The `Area` class simply manipulates the CSS properties of the given DOM element
 * to position it in the relevant map pane (which itself is just a `<div>`). That
 * means you can use the element mostly as normal, including adding children to it
 * whenever/however you want. However, if you mess with the CSS properties that
 * `Area` uses to position the element, it will of course no longer be positioned
 * correctly. Here are the CSS properties manipulated by `Area`:
 * 
 * - `display: block`
 * - `width` and `height` to set the dimensions of the element
 * - `position: absolute`, `left: 0`, and `top: 0` to position the element in the
 *   pane's top-left corner
 * - `transform` is used to offset the element to the 'real' position via translation,
 *   as well as to give the element a desired amount of rotation
 * 
 * And that's all there is to it!
 * ```
 */
export class Area<El extends DomElement = DomElement> implements Disposable {

	/**
	 * This field exists purely for the application's use. Leaflet Lite does not use
	 * read or write to it. It should generally be used to associate app-specific IDs
	 * with Leaflet elements for the sake of event handling.
	 * 
	 * For example, let's say you load a list of restaurants from your server, as a
	 * JSON array. Each restaurant has a randomly generated string ID for referencing
	 * it in the database on the server. Your application JavaScript can loop over the
	 * array of restaurant objects (JSON), creating a marker on the map for each one,
	 * but also setting the 'data' field to the restaurant ID. Then, when Leaflet tells
	 * you that a marker was clicked, you can grab the restaurant ID from the 'data'
	 * field of the marker associated with the event, and pull some additional info
	 * about the restaurant from your server to show in a pop-up UI.
	 */
	appData: any;

	_events: HandlerMap = {
		zoom: this._reset,
		viewreset: this._reset,
	};
	_disposed = false;

	constructor(
        public _map: Map,
        public _el: El,
		public _bounds: LatLngBounds,
		opts?: Partial<AreaOptions>,
	) {
		_el.classList.add('leaflet-image-layer');
		_el.onselectstart = Util.falseFn;
		_el.onmousemove = Util.falseFn;

		_map.on(this._events, this);

		if (_map._zoomAnimated) {
			_el.classList.add('leaflet-zoom-animated')
			_map.on('zoomanim', this._animateZoom, this);
		}
		if (opts?.interactive) {
			_el.classList.add('leaflet-interactive');
		}

		_map.pane(opts?.pane ?? 'overlay').appendChild(_el);

		this._reset()
	}

	_animateZoom(e: any): void {
		const
			scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

		DomUtil.setTransform(this._el, offset, scale);
	}

	_reset(): void {
		const
			el = this._el,
		    bounds = new Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast()),
			),
		    size = bounds.getSize();

		DomUtil.setPosition(el, bounds.min);

		el.style.width = `${size.x}px`;
		el.style.height = `${size.y}px`;
	}

	// Returns the center of the ImageOverlay.
	getCenter(): LatLng {
		return this._bounds.getCenter();
	}

	/**
     * Update the bounds that this area covers.
     */
	setBounds(bounds: LatLngBounds): this {
		this._bounds = bounds;
        this._reset();
		return this;
	}

	dispose(): void {
		if (!this._disposed) {
			const { _map, _el } = this;

			_map.off(this._events, this);

			if (_map._zoomAnimated) {
				_map.off('zoomanim', this._animateZoom, this);
			}

			_el.remove();

			this._map = undefined as any;
			this._el = undefined as any;
			this._events = undefined as any;
			this._disposed = true;
		}
	}

}
