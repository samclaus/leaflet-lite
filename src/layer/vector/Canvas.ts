import { Util, type HandlerMap } from '../../core';
import { DomEvent } from '../../dom';
import { Bounds, Point } from '../../geom';
import type { Map } from '../../map';
import type { CircleMarker } from './CircleMarker.js';
import type { Path, RenderOrderNode } from './Path.js';
import type { Polyline } from './Polyline.js';
import { Renderer } from './Renderer.js';

/**
 * Allows vector layers to be displayed with [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
 * Inherits `Renderer`.
 *
 * Due to [technical limitations](https://caniuse.com/canvas), Canvas is not
 * available in all web browsers, notably IE8, and overlapping geometries might
 * not display properly in some edge cases.
 *
 * Use Canvas by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.canvas()
 * });
 * ```
 *
 * Use a Canvas renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.canvas({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */
export class Canvas extends Renderer {

	declare _container: HTMLCanvasElement | undefined;

	_ctxScale = window.devicePixelRatio;
	_ctx: CanvasRenderingContext2D | undefined;
	_redrawBounds: Bounds | undefined;
	_redrawFrame = 0;
	_postponeUpdatePaths = false;
	_drawing = false;
	_drawFirst: RenderOrderNode | undefined;
	_drawLast: RenderOrderNode | undefined;
	_hoveredLayer: any; // TODO
	_mouseHoverThrottled = false;

	getEvents(): HandlerMap {
		const events = Renderer.prototype.getEvents.call(this);
		events.viewprereset = this._onViewPreReset;
		return events;
	}

	_onViewPreReset(): void {
		// Set a flag so that a viewprereset+moveend+viewreset only updates&redraws once
		this._postponeUpdatePaths = true;
	}

	onAdd(map: Map): this {
		Renderer.prototype.onAdd.call(this, map);

		// Redraw vectors since canvas is cleared upon removal,
		// in case of removing the renderer itself from the map.
		this._draw();

		return this;
	}

	_initContainer(): void {
		const container = this._container = document.createElement('canvas');

		DomEvent.on(container, 'mousemove', this._onMouseMove, this);
		DomEvent.on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		DomEvent.on(container, 'mouseout', this._handleMouseOut, this);
		container['_leaflet_disable_events'] = true;

		this._ctx = container.getContext('2d') || undefined;
	}

	_destroyContainer(): void {
		cancelAnimationFrame(this._redrawFrame);
		this._ctx = undefined;
		Renderer.prototype._destroyContainer.call(this);
	}

	_resizeContainer(): Point {
		const
			container = this._container as HTMLCanvasElement, // TODO: type safety
			size = Renderer.prototype._resizeContainer.call(this),
			m = this._ctxScale;

		// set canvas size (also clearing it); use double size on retina
		container.width = m * size.x;
		container.height = m * size.y;

		return size;
	}

	_updatePaths() {
		if (this._postponeUpdatePaths) { return; }

		this._redrawBounds = undefined;
		for (const layer of Object.values(this._layers)) {
			layer._update();
		}
		this._redraw();
	}

	_update() {
		// TODO: null safety
		if (this._map!._animatingZoom && this._bounds) { return; }

		const
			b = this._bounds!, // TODO: null safety
		    s = this._ctxScale;

		// translate so we use the same path coordinates after canvas element moves
		this._ctx!.setTransform( // TODO: null safety
			s, 0, 0, s,
			-b.min.x * s,
			-b.min.y * s);

		// Tell paths to redraw themselves
		this.fire('update');
	}

	_reset(): void {
		Renderer.prototype._reset.call(this);

		if (this._postponeUpdatePaths) {
			this._postponeUpdatePaths = false;
			this._updatePaths();
		}
	}

	_initPath(layer: Path): void {
		this._updateDashArray(layer);
		this._layers[Util.stamp(layer)] = layer;

		const order: RenderOrderNode = layer._order = {
			layer,
			prev: this._drawLast,
			next: undefined,
		};

		if (this._drawLast) {
			this._drawLast.next = order;
		}

		this._drawLast = order;
		this._drawFirst ||= this._drawLast;
	}

	_addPath(layer: Path): void {
		this._requestRedraw(layer);
	}

	_removePath(layer: Path): void {
		const order = layer._order!; // TODO: null safety
		const next = order.next;
		const prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			this._drawLast = prev;
		}
		if (prev) {
			prev.next = next;
		} else {
			this._drawFirst = next;
		}

		delete layer._order;
		delete this._layers[Util.stamp(layer)];

		this._requestRedraw(layer);
	}

	_updatePath(layer: Path): void {
		// Redraw the union of the layer's old pixel
		// bounds and the new pixel bounds.
		this._extendRedrawBounds(layer);
		layer._project();
		layer._update();
		// The redraw will extend the redraw bounds
		// with the new pixel bounds.
		this._requestRedraw(layer);
	}

	_updateStyle(layer: Path): void {
		this._updateDashArray(layer);
		this._requestRedraw(layer);
	}

	_updateDashArray(layer: Path) {
		if (typeof layer.options.dashArray === 'string') {
			const
				parts = layer.options.dashArray.split(/[, ]+/),
				dashArray = [];

			let dashValue,
			    i;
			for (i = 0; i < parts.length; i++) {
				dashValue = Number(parts[i]);
				// Ignore dash array containing invalid lengths
				if (isNaN(dashValue)) { return; }
				dashArray.push(dashValue);
			}
			(layer.options as any)._dashArray = dashArray;
		} else {
			(layer.options as any)._dashArray = layer.options.dashArray;
		}
	}

	_requestRedraw(layer: Path): void {
		if (!this._map) { return; }

		this._extendRedrawBounds(layer);
		this._redrawFrame ||= requestAnimationFrame(() => this._redraw());
	}

	_extendRedrawBounds(layer: Path): void {
		if (layer._pxBounds) {
			const
				paddingAmt = (layer.options.weight || 0) + 1,
				padding = new Point(paddingAmt, paddingAmt);

			this._redrawBounds ||= new Bounds();
			this._redrawBounds.extend(layer._pxBounds.min.subtract(padding));
			this._redrawBounds.extend(layer._pxBounds.max.add(padding));
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
			bounds = this._redrawBounds,
			ctx = this._ctx!; // TODO: null safety

		if (bounds) {
			const size = bounds.getSize();
			ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
		} else {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this._container!.width, this._container!.height); // TODO: null safety
			ctx.restore();
		}
	}

	_draw() {
		const
			bounds = this._redrawBounds,
			ctx = this._ctx!; // TODO: null safety

		ctx.save();

		if (bounds) {
			const size = bounds.getSize();
			ctx.beginPath();
			ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
			ctx.clip();
		}

		this._drawing = true;

		for (let order = this._drawFirst; order; order = order.next) {
			const layer = order.layer;
			if (!bounds || (layer._pxBounds?.intersects(bounds))) {
				layer._updatePath();
			}
		}

		this._drawing = false;

		ctx.restore();  // Restore state before clipping.
	}

	_updatePoly(layer: Polyline, closed?: boolean): void {
		if (!this._drawing) { return; }

		let i, j, len2, p;
		const
			parts = layer._parts,
			len = parts.length,
			ctx = this._ctx!; // TODO: null safety

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

		this._fillStroke(ctx, layer);

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	}

	_updateCircle(layer: CircleMarker): void {

		if (!this._drawing || layer._empty()) { return; }

		const
			p = layer._point!, // TODO: null safety
		    ctx = this._ctx!, // TODO: null safety
		    r = Math.max(Math.round(layer._radius), 1),
		    s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}

		this._fillStroke(ctx, layer);
	}

	_fillStroke(ctx: CanvasRenderingContext2D, layer: Path): void {
		const options = layer.options as any; // TODO

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			if (ctx.setLineDash) {
				ctx.setLineDash(options._dashArray || []);
			}
			ctx.globalAlpha = options.opacity;
			ctx.lineWidth = options.weight;
			ctx.strokeStyle = options.color;
			ctx.lineCap = options.lineCap;
			ctx.lineJoin = options.lineJoin;
			ctx.stroke();
		}
	}

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	_onClick(e: any): void {
		const point = this._map!.mouseEventToLayerPoint(e); // TODO: null safety
		let layer, clickedLayer;

		for (let order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point)) {
				 // TODO: null safety
				if (
					!(e.type === 'click' || e.type === 'preclick') ||
					!this._map!._draggableMoved(layer)
				) {
					clickedLayer = layer;
				}
			}
		}
		this._fireEvent(clickedLayer ? [clickedLayer] : false, e);
	}

	_onMouseMove(e: any): void {
		if (!this._map || this._map.dragging?.moving() || this._map._animatingZoom) { return; }

		const point = this._map.mouseEventToLayerPoint(e);
		this._handleMouseHover(e, point);
	}


	_handleMouseOut(e: any): void {
		const layer = this._hoveredLayer;

		if (layer) {
			// if we're leaving the layer, fire mouseout
			this._container!.classList.remove('leaflet-interactive'); // TODO: null safety
			this._fireEvent([layer], e, 'mouseout');
			this._hoveredLayer = undefined;
			this._mouseHoverThrottled = false;
		}
	}

	_handleMouseHover(e: any, point: Point): void {
		if (this._mouseHoverThrottled) {
			return;
		}

		let layer, candidateHoveredLayer;

		for (let order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point)) {
				candidateHoveredLayer = layer;
			}
		}

		if (candidateHoveredLayer !== this._hoveredLayer) {
			this._handleMouseOut(e);

			if (candidateHoveredLayer) {
				// TODO: null safety
				this._container!.classList.add('leaflet-interactive'); // change cursor
				this._fireEvent([candidateHoveredLayer], e, 'mouseover');
				this._hoveredLayer = candidateHoveredLayer;
			}
		}

		this._fireEvent(this._hoveredLayer ? [this._hoveredLayer] : false, e);

		this._mouseHoverThrottled = true;
		setTimeout((() => {
			this._mouseHoverThrottled = false;
		}), 32);
	}

	_fireEvent(layers: any, e: any, type?: string): void {
		// TODO: null safety
		this._map!._fireDOMEvent(e, type || e.type, layers);
	}

	_bringToFront(layer: Path): void {
		const order = layer._order;

		if (!order) { return; }

		const next = order.next;
		const prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			// Already last
			return;
		}
		if (prev) {
			prev.next = next;
		} else if (next) {
			// Update first entry unless this is the
			// single entry
			this._drawFirst = next;
		}

		order.prev = this._drawLast;
		this._drawLast!.next = order; // TODO: null safety

		order.next = undefined;
		this._drawLast = order;

		this._requestRedraw(layer);
	}

	_bringToBack(layer: Path): void {
		const order = layer._order;

		if (!order) { return; }

		const next = order.next;
		const prev = order.prev;

		if (prev) {
			prev.next = next;
		} else {
			// Already first
			return;
		}
		if (next) {
			next.prev = prev;
		} else if (prev) {
			// Update last entry unless this is the
			// single entry
			this._drawLast = prev;
		}

		order.prev = undefined;
		order.next = this._drawFirst;

		this._drawFirst!.prev = order; // TODO: null safety
		this._drawFirst = order;

		this._requestRedraw(layer);
	}

}
