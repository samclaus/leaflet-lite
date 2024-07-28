import type { Bounds } from '../../geom';
import type { Map } from '../../map';

export interface PathStyle {
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
	dashArray: string | number[] | undefined;
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

export interface NormalizedPathStyle extends PathStyle {
	dashArray: number[];
}

/**
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly.
 */
export abstract class Path {

	_pxBounds: Bounds | undefined;

	abstract project(map: Map, padding: number): void;
	abstract render(ctx: CanvasRenderingContext2D): void;

}

export class PathBuffer {

	style: NormalizedPathStyle;

	constructor(
		style: Partial<PathStyle>,
		public paths: Path[] = [],
	) {
		const dashArray = style.dashArray;

		this.style = {
			stroke: true,
			color: '#3388ff',
			weight: 3,
			opacity: 1,
			lineCap: 'round',
			lineJoin: 'round',
			dashOffset: undefined,
			fill: false,
			fillColor: undefined,
			fillOpacity: 0.2,
			fillRule: 'evenodd',
			interactive: true,
			...style,
			dashArray: typeof dashArray === 'string'
				? dashArray.split(/[, ]+/).map(Number)
				: (dashArray || []),
		};
	}

}
