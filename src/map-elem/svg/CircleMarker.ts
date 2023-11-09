import { Util } from '../../core';
import type { LatLng } from '../../geog';
import { Bounds, Point } from '../../geom';
import { Path, type PathOptions } from './Path.js';

export interface CircleMarkerOptions extends PathOptions {
	// @option radius: Number = 10
	// Radius of the circle marker, in pixels
	radius: number;
}

/**
 * A circle of a fixed size with radius specified in pixels. Extends `Path`.
 */
export class CircleMarker extends Path {

	declare options: CircleMarkerOptions;

	_radius: number;
	_radiusY: number = NaN; // needed for Circle inheritance
	_point: Point | undefined;

	constructor(
		public _latlng: LatLng,
		options?: Partial<CircleMarkerOptions>,
	) {
		super();

		Util.setOptions(this, options, {
			fill: true,
			radius: 10,
		});

		this._radius = this.options.radius;
	}

	// Sets the position of a circle marker to a new location.
	setLatLng(latlng: LatLng): this {
		const oldLatLng = this._latlng;
		this._latlng = latlng;
		this.redraw();

		// @event move: Event
		// Fired when the marker is moved via [`setLatLng`](#circlemarker-setlatlng). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
		return this.fire('move', { oldLatLng, latlng: this._latlng });
	}

	// Sets the radius of a circle marker. Units are in pixels.
	setRadius(radius: number): this {
		this.options.radius = this._radius = radius;
		return this.redraw();
	}

	// Returns the current radius of the circle
	getRadius(): number {
		return this._radius;
	}

	setStyle(options: Partial<CircleMarkerOptions>) {
		const radius = options?.radius || this._radius;
		Path.prototype.setStyle.call(this, options);
		this.setRadius(radius);
		return this;
	}

	_project(): void {
		// TODO: null safety
		this._point = this._map!.latLngToLayerPoint(this._latlng);
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
		if (this._map) {
			this._updatePath();
		}
	}

	_updatePath(): void {
		this._renderer!._updateCircle(this); // TODO: null safety
	}

	_empty(): boolean {
		// TODO: null safety
		return !!this._radius && !this._renderer!._bounds!.intersects(this._pxBounds!);
	}

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint(p: Point): boolean {
		// TODO: null safety
		return p.distanceTo(this._point!) <= this._radius + this._clickTolerance();
	}

}
