import type { LatLng } from '../../geog';
import { Bounds, Point } from '../../geom';
import type { Canvas } from './Canvas.js';
import { Path, type PathOptions } from './Path.js';

/**
 * A circle of a fixed size with radius specified in pixels. Extends `Path`.
 */
export class CircleMarker extends Path {

	declare options: PathOptions;

	_radiusY: number = NaN; // needed for Circle inheritance
	_point: Point | undefined;

	constructor(
		_canvas: Canvas,
		public _latlng: LatLng,
		public _radius = 10,
		options?: Partial<PathOptions>,
	) {
		super(_canvas, {
			fill: true,
			...options,
		});
	}

	// Sets the position of a circle marker to a new location.
	setLatLng(latlng: LatLng): this {
		this._latlng = latlng;
		return this.redraw();
	}

	// Sets the radius of a circle marker. Units are in pixels.
	setRadius(radius: number): this {
		this._radius = radius;
		return this.redraw();
	}

	// Returns the current radius of the circle
	getRadius(): number {
		return this._radius;
	}

	_mergeStyles(style: Partial<PathOptions>): void {
		super._mergeStyles(style);
	}

	_project(): void {
		this._point = this._canvas._map.latLngToLayerPoint(this._latlng);
		this._updateBounds();
	}

	_updateBounds(): void {
		const
			point = this._point!, // TODO: null safety
			r = this._radius,
		    r2 = this._radiusY || r,
		    w = this._clickTolerance(),
		    p = new Point(r + w, r2 + w);

		this._pxBounds = new Bounds(point.subtract(p), point.add(p));
	}

	_update(): void {
		this._updatePath();
	}

	_updatePath(): void {
		this._canvas._updateCircle(this);
	}

	_empty(): boolean {
		// TODO: null safety
		return !!this._radius && !this._canvas._bounds!.intersects(this._pxBounds!);
	}

}
