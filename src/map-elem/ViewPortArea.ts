import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import type { LatLng } from '../geog';
import { Bounds, type Point } from '../geom';
import type { Map, ZoomAnimationEvent } from '../map';
import { Elem } from './Elem.js';

export interface ViewPortAreaOptions {
	/**
	 * Which map pane to position the area within. 'overlay' by default.
	 */
	pane: string;
	/**
	 * If `true`, the area will emit [mouse events](#interactive-layer)
	 * when clicked or hovered.
	 */
	interactive: boolean;
	/**
	 * How much to extend the clip area around the map view (relative to its size)
	 * e.g. 0.1 would be 10% of map view in each direction. 0.1 by default.
	 */
	padding: number;
	/**
	 * When `false`, the blanket will update its position only when the
	 * map state settles (*after* a pan/zoom animation). When `true`,
	 * it will update when the map state changes (*during* pan/zoom
	 * animations). False by default.
	 */
	continuous: boolean;
}

/**
 * `ViewPortArea` is the same as `Area` (see `Area` documentation for more info),
 * but it automatically adjusts itself to cover the current viewport of the map
 * every time the map settles (at the end of a pan and/or zoom animation).
 * 
 * The `continuous` option can be used to force a `ViewPortArea` to resize and
 * reposition itself even during every frame of an animation, but that will
 * incur a performance penalty.
 * 
 * `ViewPortArea` is only really useful for Canvas/SVG renderers, and trades
 * perfect-world UX for performance. The trade-off revolves around CSS transforms,
 * which are often GPU accelerated. Because Leaflet is usually just modifying the
 * transforms of DOM elements as the user interacts with the map, performance is
 * excellent. However, as soon as you, say, start messing with an SVG's coordinate
 * space or clearing and redrawing an entire `<canvas>`'s content from scratch on
 * every frame, you can run into performance problems. `ViewPortArea` solves this
 * by only updating the transform on the 'floating' `<canvas>` or `<svg>` element
 * on every frame, and updates their content whenever the map stops moving. The
 * trade-off is that dragging the map too far will take you out of the bounds of
 * the `<canvas>` or `<svg>`, so you will see the polylines and whatnot end abruptly,
 * and you will only be able to see further portions of them once you stop panning
 * or zooming and let the map settle.
 */
export abstract class ViewPortArea<El extends HTMLElement | SVGSVGElement> extends Elem<El> {

	_padding: number;
	_continuous: boolean;
	_bounds: Bounds | undefined;
	_center: LatLng | undefined;
	_zoom: number | undefined;

	constructor(
        map: Map,
        el: El,
		opts?: Partial<ViewPortAreaOptions>,
	) {
		super(map, el, opts?.pane ?? 'overlay', opts?.interactive ?? true);

		this._padding = opts?.padding ?? 0.1;
		this._continuous = !!opts?.continuous;

		// always keep transform-origin as 0 0, #8794
		// TODO: Elem only adds class if map._zoomAnimated, but it looks like BlanketOverlay
		// used to always add it regardless
		this._el.classList.add('leaflet-zoom-animated');

		el.classList.add('leaflet-image-layer');
		el.onselectstart = Util.falseFn;
		el.onmousemove = Util.falseFn;
	}

	_mapEvents(): HandlerMap {
		const events: HandlerMap = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._onMoveEnd,
			resize: this._resizeContainer,
		};
		if (this._onZoomEnd) {
			events.zoomend = this._onZoomEnd;
		}
		if (this._continuous) {
			events.move = this._onMoveEnd;
		}
		return events;
	}

	_init(): void {
		this._resizeContainer();
		this._onMoveEnd();
	}

	// TODO: need to make sure Canvas/SVG renderers remove all DOM event listeners
	// inside of their respective _deinit() implementations

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

	_animateZoom(ev: ZoomAnimationEvent): void {
		this._updateTransform(ev.center, ev.zoom);
	}

	_onZoom(): void {
		this._updateTransform(this._map.getCenter(), this._map._zoom);
	}

	_updateTransform(center: LatLng, zoom: number): void {
		const
			map = this._map,
			scale = map.getZoomScale(zoom, this._zoom),
		    viewHalf = map.getSize().multiplyBy(0.5 + this._padding),
		    currentCenterPoint = map.project(this._center!, zoom), // TODO: null safety
		    topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
		        .subtract(map._getNewPixelOrigin(center, zoom));

		DomUtil.setTransform(this._el, topLeftOffset, scale);
	}

	/**
	 * If the `continuous` option is set to `true`, then this also runs on
	 * any map state change (including *during* pan/zoom animations).
	 */
	_onMoveEnd(): void {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		const
			map = this._map,
			p = this._padding,
		    size = map.getSize(),
		    min = map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p*2)).round());
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
	 * The base implementation resizes the container (based on the map's size
	 * and taking into account the padding), returning the new size in CSS pixels.
	 */
	_resizeContainer(): Point {
		const size = this._map.getSize().multiplyBy(1 + this._padding*2).round();

		this._el.style.width = `${size.x}px`;
		this._el.style.height = `${size.y}px`;

		return size;
	}

}
