import { Util, type Disposable, type HandlerMap } from '../../core';
import { DomUtil } from '../../dom';
import type { LatLng } from '../../geog';
import { Bounds, Point } from '../../geom';
import type { Map, ZoomAnimationEvent } from '../../map';
import type { CircleMarker } from './CircleMarker.js';
import type { Path, PathOptions } from './Path.js';
import type { Polyline } from './Polyline.js';

export interface CanvasOptions {
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
 * TODO: update this doc comment.
 * TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
 * 
 * `ViewPortArea` is the same as `Area` (see `Area` documentation for more info),
 * but it automatically adjusts itself to cover the current viewport of the map
 * every time the map settles (at the end of a pan and/or zoom animation).
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
 * 
 * Allows vector layers to be displayed with
 * [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
 */
export class Canvas implements Disposable {

	_events: HandlerMap = {
		viewreset: this._reset,
		zoom: this._onZoom,
		moveend: this._onMoveEnd,
		resize: this._resizeContainer,
		zoomend: this._onZoomEnd,
		viewprereset: this._onViewPreReset,
	};
	_el: HTMLCanvasElement;
	_padding: number;
	_ctx: CanvasRenderingContext2D;
	_bounds: Bounds | undefined;
	_center: LatLng | undefined;
	_zoom: number | undefined;
	_drawOrder: Path[] = [];
	_redrawBounds: Bounds | undefined;
	_redrawFrame = 0;
	_postponeUpdatePaths = false;
	_drawing = false;
	_hoveredPath: any; // TODO
	_mouseHoverThrottled = false;
	_disposed = false;

	constructor(
		public _map: Map,
		opts?: Partial<CanvasOptions>,
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

	/**
	 * Implements the 'zoomend' handler for BlanketOverlay, calling `_projectPaths()`
	 * which must iterate over all paths owned by the renderer and have them each
	 * re-project themselves now that the origin pixel for the map has changed.
	 */
	_onZoomEnd(): void {
		this._projectPaths();
	}

	/**
	 * Runs whenever the map state settles after changing (at the end of pan/zoom
	 * animations, etc). This should trigger the bulk of any rendering logic.
	 */
	_onSettled(): void {
		this._update();
	}

	_onViewPreReset(): void {
		// Set a flag so that a viewprereset+moveend+viewreset only updates&redraws once
		this._postponeUpdatePaths = true;
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

	_updatePaths(): void {
		if (this._postponeUpdatePaths) { return; }

		this._redrawBounds = undefined;

		for (const path of this._drawOrder) {
			path._update();
		}

		this._redraw();
	}

	_update(): void {
		if (this._map._animatingZoom && this._bounds) { return; }

		const
			b = this._bounds!, // TODO: null safety
		    s = ctxScale;

		// translate so we use the same path coordinates after canvas element moves
		this._ctx.setTransform(
			s, 0, 0, s,
			-b.min.x * s,
			-b.min.y * s);

		// Tell paths to redraw themselves
		this._updatePaths();
	}

	_reset(): void {
		this._onSettled();
		this._updateTransform(this._center!, this._zoom!); // TODO: null safety
		this._resetPaths();

		if (this._postponeUpdatePaths) {
			this._postponeUpdatePaths = false;
			this._updatePaths();
		}
	}

	_addPath(path: Path): void {
		this._drawOrder.push(path);
		path._reset();
		this._requestRedraw(path);
	}

	_removePath(path: Path): void {
		const drawIndex = this._drawOrder.indexOf(path);

		if (drawIndex >= 0) {
			this._drawOrder.splice(drawIndex, 1);
		}

		this._requestRedraw(path);
	}

	_updatePath(path: Path): void {
		// Redraw the union of the layer's old pixel
		// bounds and the new pixel bounds.
		this._extendRedrawBounds(path);
		path._project();
		path._update();
		// The redraw will extend the redraw bounds
		// with the new pixel bounds.
		this._requestRedraw(path);
	}

	_updateStyle(path: Path, style: Partial<PathOptions>): void {
		path._mergeStyles(style);
		this._requestRedraw(path);
	}

	_requestRedraw(path: Path): void {
		if (!this._map) { return; }

		this._extendRedrawBounds(path);
		this._redrawFrame ||= requestAnimationFrame(() => this._redraw());
	}

	_extendRedrawBounds(path: Path): void {
		if (path._pxBounds) {
			const
				paddingAmt = (path.options.weight || 0) + 1,
				padding = new Point(paddingAmt, paddingAmt);

			this._redrawBounds ||= new Bounds();
			this._redrawBounds.extend(path._pxBounds.min.subtract(padding));
			this._redrawBounds.extend(path._pxBounds.max.add(padding));
		}
	}

	_redraw(): void {
		this._redrawFrame = 0;

		if (this._redrawBounds) {
			this._redrawBounds.min._floor();
			this._redrawBounds.max._ceil();
		}

		this._clear(); // clear layers in redraw bounds
		this._draw(); // draw layers

		this._redrawBounds = undefined;
	}

	_clear(): void {
		const
			el = this._el,
			bounds = this._redrawBounds,
			ctx = this._ctx;

		if (bounds) {
			const size = bounds.getSize();
			ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
		} else {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, el.width, el.height);
			ctx.restore();
		}
	}

	_draw(): void {
		const
			bounds = this._redrawBounds,
			ctx = this._ctx;

		ctx.save();

		if (bounds) {
			const size = bounds.getSize();
			ctx.beginPath();
			ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
			ctx.clip();
		}

		this._drawing = true;

		for (const path of this._drawOrder) {
			if (!bounds || (path._pxBounds?.intersects(bounds))) {
				path._updatePath();
			}
		}

		this._drawing = false;

		ctx.restore();  // Restore state before clipping.
	}

	_updatePoly(poly: Polyline, closed?: boolean): void {
		if (!this._drawing) { return; }

		let i, j, len2, p;
		const
			parts = poly._parts,
			len = parts.length,
			ctx = this._ctx;

		if (!len) { return; }

		ctx.beginPath();

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				p = parts[i][j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
			}
			if (closed) {
				ctx.closePath();
			}
		}

		poly._fillStroke(ctx);
	}

	_updateCircle(circle: CircleMarker): void {
		if (!this._drawing || circle._empty()) { return; }

		const
			p = circle._point!, // TODO: null safety
		    ctx = this._ctx,
		    r = Math.max(Math.round(circle._radius), 1),
		    s = (Math.max(Math.round(circle._radiusY), 1) || r) / r;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}

		circle._fillStroke(ctx);
	}

	bringToFront(path: Path): void {
		const
			order = this._drawOrder,
			index = order.indexOf(path);

		if (index < 0 || index === (order.length - 1)) {
			// Path is not present, or is already at front (last to draw)
			return;
		}

		order.splice(index, 1);
		order.push(path);

		this._requestRedraw(path);
	}

	bringToBack(path: Path): void {
		const
			order = this._drawOrder,
			index = order.indexOf(path);

		if (index < 1) {
			// Path is not present, or is already at back (first to draw)
			return;
		}

		// Shift all items before/behind the path up one spot
		for (let i = 0; i < index; ++i) {
			order[i + 1] = order[i];
		}

		// Now insert the path at beginning so it draws before/behind everything else
		order[0] = path;

		this._requestRedraw(path);
	}

	_projectPaths(): void {
		for (const path of this._drawOrder) {
			path._project();
		}
	}

	_resetPaths(): void {
		for (const path of this._drawOrder) {
			path._reset();
		}
	}

	_onZoom(): void {
		this._updateTransform(this._map.getCenter(), this._map._zoom);
	}

	_animateZoom(ev: ZoomAnimationEvent): void {
		this._updateTransform(ev.center, ev.zoom);
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

	dispose(): void {
		if (!this._disposed) {
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
			this._disposed = true;
		}
	}

}
