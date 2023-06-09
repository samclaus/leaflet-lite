import { Point } from './Point.js';

/**
 * Represents an affine transformation: a set of coefficients `a`, `b`, `c`, `d`
 * for transforming a point of a form `(x, y)` into `(a*x + b, c*y + d)` and doing
 * the reverse. Used by Leaflet in its projections code.
 *
 * ```js
 * var transformation = L.transformation(2, 5, -1, 10),
 * 	p = L.point(1, 2),
 * 	p2 = transformation.transform(p), //  L.point(7, 8)
 * 	p3 = transformation.untransform(p2); //  L.point(1, 2)
 * ```
 */
export class Transformation {

	constructor(
		public _a: number,
		public _b: number,
		public _c: number,
		public _d: number,
	) { }

	// Returns a transformed point, optionally multiplied by the given scale.
	// Only accepts actual `L.Point` instances, not arrays.
	transform(point: Point, scale: number): Point {
		return this._transform(point.clone(), scale);
	}

	// destructive transform (faster)
	_transform(point: Point, scale: number): Point {
		// TODO: remove this? was in the original code as a default mechanism, but maybe 0 is valid scale to pass?
		scale ||= 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	}

	// Returns the reverse transformation of the given point, optionally divided
	// by the given scale. Only accepts actual `L.Point` instances, not arrays.
	untransform(point: Point, scale: number): Point {
		scale ||= 1;

		return new Point(
			(point.x / scale - this._b) / this._a,
			(point.y / scale - this._d) / this._c,
		);
	}

}
