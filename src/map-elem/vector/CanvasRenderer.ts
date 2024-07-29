import { Util, type Disposable, type HandlerMap } from '../../core/index.js';
import { DomUtil } from '../../dom/index.js';
import type { LatLng } from '../../geog/index.js';
import { Bounds, Point } from '../../geom/index.js';
import type { Map, ZoomAnimationEvent } from '../../map/index.js';
import type { NormalizedPathStyle, PathBuffer } from './Path.js';

export interface CanvasRendererOptions {
	/**
	 * Which map pane to position the area within. 'overlay' by default.
	 */
	pane: string;
	/**
	 * How much to extend the clip area around the map view (relative to its size)
	 * e.g. 0.1 would be 10% of map view in each direction. 0.1 by default.
	 */
	padding: number;
}

const ctxScale = window.devicePixelRatio;

/**
 * `CanvasRenderer` uses a `<canvas>` element to render vector paths.
 * 
 * Currently, `CanvasRenderer` behaves similarly to `Area` (see `Area`
 * documentation for more info), but it automatically adjusts itself to cover the
 * current viewport of the map every time the map settles (at the end of a pan
 * and/or zoom animation). This is so that vector paths don't need to be constantly
 * redrawn as the map is panned (because the whole `<canvas>` element just gets
 * translated via the CSS `transform` property), but the trade-off is that you will
 * see the vectors get "chopped off" abruptly when you pan outside of the rendered
 * bounds without letting the map sit still. Zoom animations also look clunky.
 * Because the 2D `<canvas>` API is GPU-accelerated in all modern browsers, this
 * strategy is deprecated. Eventually the `<canvas>` element will be statically
 * positioned to fill the map container and will be cleared/re-rendered from
 * scratch as necessary. This will be a great simplification to the code base and
 * will result in nicer UX.
 */
export class CanvasRenderer implements Disposable {

	_events: HandlerMap = {
		viewreset: this._reset,
		zoom: this._onZoom,
		moveend: this._onMoveEnd,
		resize: this._resizeContainer,
		zoomend: this._projectPaths,
	};
	_el: HTMLCanvasElement;
	_padding: number;
	_ctx: CanvasRenderingContext2D;
	_bounds: Bounds | undefined;
	_center: LatLng | undefined;
	_zoom: number | undefined;
	_redrawFrame = 0;

	drawOrder: PathBuffer[] = [];

	constructor(
		public _map: Map,
		opts?: Partial<CanvasRendererOptions>,
	) {
		const el = document.createElement('canvas');

		// always keep transform-origin as 0 0, #8794
		el.classList.add('leaflet-zoom-animated', 'leaflet-image-layer');
		el.onselectstart = Util.falseFn;
		el.onmousemove = Util.falseFn;

		this._el = el;
		this._padding = opts?.padding ?? 0.1;
		this._ctx = this._el.getContext('2d')!;
		
		if (_map._zoomAnimated) {
			_map.on('zoomanim', this._animateZoom, this);
		}

		_map._targets.set(el, this);
		_map.pane(opts?.pane || 'overlay').appendChild(el);
		_map.on(this._events, this);

		this._resizeContainer();
		this._onMoveEnd();

		// Redraw vectors since canvas is cleared upon removal,
		// in case of removing the renderer itself from the map.
		this._draw();
	}

	_resizeContainer(): Point {
		const
			el = this._el,
			size = this._map.getSize().multiplyBy(1 + this._padding*2).round(),
			s = ctxScale;

		// Set canvas size on page, in CSS pixels
		el.style.width = `${size.x}px`;
		el.style.height = `${size.y}px`;

		// Set canvas resolution physical pixels (also clearing it); use double size on retina
		el.width = s * size.x;
		el.height = s * size.y;

		return size;
	}

	_updateCoordSpaceAndRenderFromScratch(): void {
		if (this._map._animatingZoom && this._bounds) { return; }

		const
			b = this._bounds!, // TODO: null safety
		    s = ctxScale;

		// translate so we use the same path coordinates after canvas element moves
		this._ctx.setTransform(
			s, 0, 0, s,
			-b.min.x * s,
			-b.min.y * s,
		);

		// Tell paths to redraw themselves
		this._redraw();
	}

	_reset(): void {
		this._updateCoordSpaceAndRenderFromScratch();
		this._updateCSSTransform(this._center!, this._zoom!); // TODO: null safety
		
		for (const {paths, style} of this.drawOrder) {
			for (const path of paths) {
				const padding = style.stroke ? style.weight / 2 : 0;

				path.project(this._map, padding);
				path.render(this._ctx);
			}

			this._fillStroke(style);
		}
	}

	_redraw(): void {
		this._redrawFrame = 0;
		this._clear(); // clear layers in redraw bounds
		this._draw(); // draw layers
	}

	_clear(): void {
		const
			el = this._el,
			ctx = this._ctx;

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, el.width, el.height);
		ctx.restore();
	}

	_draw(): void {
		const ctx = this._ctx;

		for (const buff of this.drawOrder) {
			for (const path of buff.paths) {
				path.render(ctx);
			}

			this._fillStroke(buff.style);
		}

		ctx.restore();  // Restore state before clipping.
	}

	_fillStroke(style: NormalizedPathStyle): void {
		const ctx = this._ctx;

		if (style.fill) {
			ctx.globalAlpha = style.fillOpacity;
			ctx.fillStyle = style.fillColor || style.color;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.fill(style.fillRule as CanvasFillRule || 'evenodd');
		}

		if (style.stroke && style.weight !== 0) {
			ctx.setLineDash(style.dashArray);
			ctx.globalAlpha = style.opacity;
			ctx.lineWidth = style.weight;
			ctx.strokeStyle = style.color;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.lineCap = style.lineCap as CanvasLineCap;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.lineJoin = style.lineJoin as CanvasLineJoin;
			ctx.stroke();
		}
	}

	_projectPaths(): void {
		for (const {paths, style} of this.drawOrder) {
			for (const path of paths) {
				path.project(this._map, style.stroke ? style.weight / 2 : 0);
			}
		}
	}

	_onZoom(): void {
		this._updateCSSTransform(this._map.getCenter(), this._map._zoom);
	}

	_animateZoom(ev: ZoomAnimationEvent): void {
		this._updateCSSTransform(ev.center, ev.zoom);
	}

	_updateCSSTransform(center: LatLng, zoom: number): void {
		const
			map = this._map,
			scale = map.getZoomScale(zoom, this._zoom),
		    viewHalf = map.getSize().multiplyBy(0.5 + this._padding),
		    currentCenterPoint = map.project(this._center!, zoom), // TODO: null safety
		    topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
		        .subtract(map._getNewPixelOrigin(center, zoom));

		DomUtil.setTransform(this._el, topLeftOffset, scale);
	}

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
		this._updateCSSTransform(this._center, this._zoom);
		this._updateCoordSpaceAndRenderFromScratch();
	}

	redraw(): void {
		this._redrawFrame ||= this._map && requestAnimationFrame(() => this._redraw());
	}

	dispose(): void {
		if (this._map) {
			const { _map, _el } = this;

			_map.off(this._events, this);

			if (_map._zoomAnimated) {
				_map.off('zoomanim', this._animateZoom, this);
			}

			_el.remove();
			_map._targets.delete(_el);

			// TODO: need to make sure to remove all DOM event listeners
			cancelAnimationFrame(this._redrawFrame);

			this._ctx = undefined as any;
			this._map = undefined as any;
			this._el = undefined as any;
			this._events = undefined as any;
		}
	}

}
