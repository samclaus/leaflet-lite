import type { Disposable } from '../../core';
import type { Bounds, Point } from '../../geom';
import type { Canvas } from './Canvas.js';

export interface PathOptions {
	/**
	 * Whether to draw stroke along the path. Set it to `false` to disable
	 * borders on polygons or circles. True by default.
	 */
	stroke: boolean;
	/** Stroke color. '#3388ff' by default. */
	color: string;
	/** Stroke width in pixels. 3 by default. */
	weight: number;
	/** Stroke opacity, in range [0, 1]. 1 (fully opaque) by default. */
	opacity: number;
	/**
	 * A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap)
	 * of the stroke. 'round' by default.
	 */
	lineCap: string;
	/** A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin)
	 * of the stroke. 'round' by default. */
	lineJoin: string;
	/**
	 * A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't
	 * work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
	 * Undefined (meaning the stroke is solid) by default.
	 */
	dashArray: string | readonly number[] | undefined;
	/**
	 * A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset).
	 * Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
	 * Undefined (no offset) by default.
	 */
	dashOffset: number | undefined;
	/**
	 * Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
	 * The default value depends on the type of path.
	 */
	fill: boolean;
	/** Fill color. Defaults to the value of the `color` option. */
	fillColor: string | undefined;
	/** Opacity of the fill color, in range [0, 1]. 0.2 by default. */
	fillOpacity: number;
	/**
	 * A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule)
	 * is determined. 'evenodd' by default.
	 */
	fillRule: string;
	// Option inherited from "Interactive layer" abstract class
	interactive: boolean;
}

function normalizeDashArray(dashArray: string | readonly number[] | undefined): readonly number[] {
	return typeof dashArray === 'string'
		? dashArray.split(/[, ]+/).map(Number)
		: (dashArray || []);
}

/**
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
 */
export abstract class Path implements Disposable {

	declare options: PathOptions;

	_dashArray: readonly number[];
	_pxBounds: Bounds | undefined;
	_disposed = false;

	constructor(
		public _canvas: Canvas,
		style?: Partial<PathOptions>,
	) {
		this.options = {
			stroke: true,
			color: '#3388ff',
			weight: 3,
			opacity: 1,
			lineCap: 'round',
			lineJoin: 'round',
			dashArray: undefined,
			dashOffset: undefined,
			fill: false,
			fillColor: undefined,
			fillOpacity: 0.2,
			fillRule: 'evenodd',
			interactive: true,
			...style,
		};
		this._dashArray = normalizeDashArray(this.options.dashArray);
	}

	abstract _project(): void;
	abstract _update(): void;
	abstract _updateBounds(): void;
	abstract _updatePath(): void;

	/**
	 * Tests if a point lies on/inside the path. This is used for hitbox testing
	 * so mouse events on the canvas can be mapped to a particular path.
	 */
	abstract _containsPoint(p: Point): boolean;

	/**
	 * Registers this path with the canvas so it actually gets rendered.
	 * 
	 * @deprecated Constructing a path should also register it immediately because that is
	 * better for null-safety and brevity, and there is no reason for construction to be
	 * separate from registration for the purposes of this library. I just needed a separate
	 * mechanism because I couldn't register in the constructor of, say, CircleMarker, and then
	 * have Circle inherit from it because then it would be registered before Circle's constructor
	 * runs.
	 */
	add(): void {
		this._canvas._addPath(this);
	}

	// Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
	redraw(): this {
		if (this._canvas) {
			this._canvas._updatePath(this);
		}
		return this;
	}

	// Changes the appearance of a Path based on the options in the `Path options` object.
	_mergeStyles(style: Partial<PathOptions>): void {
		Object.assign(this.options, style);

		this._dashArray = normalizeDashArray(this.options.dashArray);

		if (this.options.stroke && Object.hasOwn(style, 'weight')) {
			this._updateBounds();
		}
	}

	_reset(): void {
		// defined in child classes
		this._project();
		this._update();
	}

	_clickTolerance(): number {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 : 0) +
		  0; // TODO: (this._canvas!.options.tolerance || 0);
	}

	_fillStroke(ctx: CanvasRenderingContext2D): void {
		const options = this.options; // TODO

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.fill(options.fillRule as CanvasFillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			ctx.setLineDash(this._dashArray);
			ctx.globalAlpha = options.opacity;
			ctx.lineWidth = options.weight;
			ctx.strokeStyle = options.color;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.lineCap = options.lineCap as CanvasLineCap;
			// Intentionally let them give us any string to avoid TypeScript compatibility headaches
			ctx.lineJoin = options.lineJoin as CanvasLineJoin;
			ctx.stroke();
		}
	}

	dispose(): void {
		if (!this._disposed) {
			this._canvas._removePath(this);
			this._canvas = undefined as any;
			this._disposed = true;
		}
	}

}
