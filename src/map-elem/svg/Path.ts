import { type LayerOptions } from '..';
import type { Bounds, Point } from '../../geom';
import type { Renderer } from './Renderer.js';

export interface PathOptions extends LayerOptions {
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
	dashArray: string | undefined;
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
	/**
	 * Custom class name set on an element. Only for SVG renderer.
	 */
	className: string | undefined;
	// Option inherited from "Interactive layer" abstract class
	interactive: boolean;
	// @option bubblingMouseEvents: Boolean = true
	// When `true`, a mouse event on this path will trigger the same event on the map
	// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
	bubblingMouseEvents: boolean;
}

/**
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
 */
export abstract class Path {

	declare options: PathOptions;

	_renderer!: Renderer; // TODO
	_pxBounds: Bounds | undefined;

	/**
	 * Will hold the SVG element created by an SVG renderer, if applicable.
	 */
	_path: any;

	constructor(options?: Partial<PathOptions>) {
		this.options = {
			pane: 'overlay',
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
			bubblingMouseEvents: true,
			className: undefined,
			...options,
		};
	}

	abstract _project(): void;
	abstract _update(): void;
	abstract _updateBounds(): void;
	abstract _updatePath(): void;
	abstract _containsPoint(p: Point): boolean;

	onAdd(): this {
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
		return this;
	}

	onRemove(): void {
		this._renderer._removePath(this);
	}

	// Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
	redraw(): this {
		if (this._renderer) {
			this._renderer._updatePath(this);
		}
		return this;
	}

	// Changes the appearance of a Path based on the options in the `Path options` object.
	setStyle(style: Partial<PathOptions>): this {
		Object.assign(this.options, style);

		if (this._renderer) {
			this._renderer._updateStyle(this);
			if (this.options.stroke && style && Object.hasOwn(style, 'weight')) {
				this._updateBounds();
			}
		}

		return this;
	}

	// Brings the layer to the top of all path layers.
	bringToFront(): this {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	}

	// Brings the layer to the bottom of all path layers.
	bringToBack(): this {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	}

	_reset(): void {
		// defined in child classes
		this._project();
		this._update();
	}

	_clickTolerance(): number {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 : 0) +
		  (this._renderer!.options.tolerance || 0);
	}

}