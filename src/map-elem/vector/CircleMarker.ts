import type { LatLng } from '../../geog';
import { Bounds, Point } from '../../geom';
import type { Map } from '../../map';
import { Path, type PathStyle } from './Path.js';

/**
 * A circle of a fixed size (i.e., regardless of the current map zoom)
 * with radius specified in pixels.
 */
export class CircleMarker extends Path {

	declare options: PathStyle;

	_radiusY: number = NaN; // needed for Circle inheritance
	_point: Point | undefined;

	constructor(
		public _latlng: LatLng,
		public _radius = 10,
	) {
		super();
	}

	_recomputeBounds(padding: number): void {
		const
			point = this._point!, // TODO: null safety
			r = this._radius,
		    r2 = this._radiusY || r,
		    p = new Point(r + padding, r2 + padding);

		this._pxBounds = new Bounds(point.subtract(p), point.add(p));
	}

	project(map: Map, padding: number): void {
		this._point = map.latLngToLayerPoint(this._latlng);
		this._recomputeBounds(padding);
	}

	render(ctx: CanvasRenderingContext2D): void {
		const
			p = this._point!, // TODO: null safety
		    r = Math.max(Math.round(this._radius), 1),
		    s = (Math.max(Math.round(this._radiusY), 1) || r) / r;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}
	}

}
