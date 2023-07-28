import { Layer, type LayerOptions } from '..';
import { Util } from '../../core';
import type { Bounds, Point } from '../../geom';
import type { Map } from '../../map';
import type { Renderer } from './Renderer.js';

export interface PathOptions extends LayerOptions {
	// @option stroke: Boolean = true
	// Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles.
	stroke: boolean;

	// @option color: String = '#3388ff'
	// Stroke color
	color: string;

	// @option weight: Number = 3
	// Stroke width in pixels
	weight: number;

	// @option opacity: Number = 1.0
	// Stroke opacity
	opacity: number;

	// @option lineCap: String= 'round'
	// A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
	lineCap: string;

	// @option lineJoin: String = 'round'
	// A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
	lineJoin: string;

	// @option dashArray: String = null
	// A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
	dashArray: string | undefined;

	// @option dashOffset: String = null
	// A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
	dashOffset: string | undefined;

	// @option fill: Boolean = depends
	// Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
	fill: boolean;

	// @option fillColor: String = *
	// Fill color. Defaults to the value of the [`color`](#path-color) option
	fillColor: string | undefined;

	// @option fillOpacity: Number = 0.2
	// Fill opacity.
	fillOpacity: number;

	// @option fillRule: String = 'evenodd'
	// A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
	fillRule: string;

	// Option inherited from "Interactive layer" abstract class
	interactive: boolean;

	// @option bubblingMouseEvents: Boolean = true
	// When `true`, a mouse event on this path will trigger the same event on the map
	// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
	bubblingMouseEvents: boolean;

	/**
	 * Custom class name set on an element. Only for SVG renderer.
	 */
	className: string | undefined;
	/**
	 * Use this specific instance of `Renderer` for this path. Takes
	 * precedence over the map's [default renderer](#map-renderer).
	 */
	renderer: Renderer | undefined;
}

/** @deprecated TODO: figure out better way to manage render order for Canvas */
export interface RenderOrderNode {
	layer: Path;
	prev: RenderOrderNode | undefined;
	next: RenderOrderNode | undefined;
}

/**
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
 */
export abstract class Path extends Layer {

	declare options: PathOptions;

	_renderer: Renderer | undefined;
	_path: any; // TODO: type this
	_pxBounds: Bounds | undefined;

	/** @deprecated TODO: figure out better way to manage render order for Canvas */
	_order?: RenderOrderNode;

	constructor(options?: Partial<PathOptions>) {
		super();

		Util.setOptions(this, options, {
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
			renderer: undefined,
		});
	}

	abstract _updateBounds(): void;
	abstract _updatePath(): void;
	abstract _containsPoint(p: Point): boolean;

	beforeAdd(map: Map): void {
		// Renderer is set here because we need to call renderer.getEvents
		// before this.getEvents.
		this._renderer = map.getRenderer(this);
	}

	onAdd(): this {
		// TODO: null safety
		this._renderer!._initPath(this);
		this._reset();
		// TODO: null safety
		this._renderer!._addPath(this);
		return this;
	}

	onRemove(): void {
		// TODO: null safety
		this._renderer!._removePath(this);
	}

	// Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
	redraw(): this {
		if (this._map) {
			// TODO: null safety
			this._renderer!._updatePath(this);
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

	getElement() {
		return this._path;
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
