import type { HandlerMap } from '../../core';
import { Bounds, Point } from '../../geom';
import type { Map } from '../../map';
import { ViewPortArea, type ViewPortAreaOptions } from '../ViewPortArea';
import type { CircleMarker } from './CircleMarker.js';
import type { Path, PathOptions } from './Path.js';
import type { Polyline } from './Polyline.js';

const ctxScale = window.devicePixelRatio;

/**
 * Allows vector layers to be displayed with
 * [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
 */
export class Canvas extends ViewPortArea<HTMLCanvasElement> {

	_ctx: CanvasRenderingContext2D;
	_drawOrder: Path[] = [];
	_redrawBounds: Bounds | undefined;
	_redrawFrame = 0;
	_postponeUpdatePaths = false;
	_drawing = false;
	_hoveredPath: any; // TODO
	_mouseHoverThrottled = false;

	constructor(
		map: Map,
		opts?: Partial<ViewPortAreaOptions>,
	) {
		super(map, document.createElement('canvas'), opts);

		this._ctx = this._el.getContext('2d')!;
	}

	_mapEvents(): HandlerMap {
		const events = super._mapEvents();
		events.viewprereset = this._onViewPreReset;
		return events;
	}

	_init(): void {
		super._init();

		// Redraw vectors since canvas is cleared upon removal,
		// in case of removing the renderer itself from the map.
		this._draw();
	}

	_deinit(): void {
		cancelAnimationFrame(this._redrawFrame);
		this._ctx = undefined as any;
	}

	/**
	 * Implements the 'zoomend' handler for BlanketOverlay, calling `_projectPaths()`
	 * which must iterate over all paths owned by the renderer and have them each
	 * re-project themselves now that the origin pixel for the map has changed.
	 */
	_onZoomEnd(): void {
		this._projectPaths();
	}

	_onViewReset(): void {
		this._resetPaths();
	}

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
			size = super._resizeContainer(),
			s = ctxScale;

		// set canvas size (also clearing it); use double size on retina
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
		super._reset();

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

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
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

}
