import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import type { LatLng, LatLngBounds } from '../geog';
import { Bounds } from '../geom';
import type { Map } from '../map';
import { Elem } from './Elem';

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
export class Area<El extends HTMLElement | SVGSVGElement> extends Elem<El> {

	constructor(
        map: Map,
        el: El,
		public _bounds: LatLngBounds,
		opts?: Partial<AreaOptions>,
	) {
		super(map, el, opts?.pane ?? 'overlay', opts?.interactive ?? true);

		el.classList.add('leaflet-image-layer');
		el.onselectstart = Util.falseFn;
		el.onmousemove = Util.falseFn;
	}

	_mapEvents(): HandlerMap {
		return {
			zoom: this._reset,
			viewreset: this._reset
		};
	}

	_init(): void {
		this._reset();
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

}
