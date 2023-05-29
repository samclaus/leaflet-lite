import { formatNum } from '../core/Util.js';

/*
 * @class Point
 * @aka L.Point
 *
 * Represents a point with `x` and `y` coordinates in pixels.
 *
 * @example
 *
 * ```js
 * var point = L.point(200, 300);
 * ```
 *
 * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panBy([200, 300]);
 * map.panBy(L.point(200, 300));
 * ```
 *
 * Note that `Point` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */
export class Point {

	x: number;
	y: number;

	constructor(
		x: number,
		y: number,
		/**
		 * TODO: remove this and round at call site
		 * @deprecated
		 */
		round?: boolean,
	) {
		this.x = round ? Math.round(x) : x;
		this.y = round ? Math.round(y) : y;
	}

	// @method clone(): Point
	// Returns a copy of the current point.
	clone(): Point {
		return new Point(this.x, this.y);
	}

	// @method add(otherPoint: Point): Point
	// Returns the result of addition of the current and the given points.
	add(point: Point): Point {
		// non-destructive, returns a new point
		return this.clone()._add(point);
	}

	_add(point: Point): this {
		// destructive, used directly for performance in situations where it's safe to modify existing point
		this.x += point.x;
		this.y += point.y;
		return this;
	}

	// @method subtract(otherPoint: Point): Point
	// Returns the result of subtraction of the given point from the current.
	subtract(point: Point): Point {
		return this.clone()._subtract(point);
	}

	_subtract(point: Point): this {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	}

	// @method divideBy(num: Number): Point
	// Returns the result of division of the current point by the given number.
	divideBy(num: number): Point {
		return this.clone()._divideBy(num);
	}

	_divideBy(num: number): this {
		this.x /= num;
		this.y /= num;
		return this;
	}

	// @method multiplyBy(num: Number): Point
	// Returns the result of multiplication of the current point by the given number.
	multiplyBy(num: number): Point {
		return this.clone()._multiplyBy(num);
	}

	_multiplyBy(num: number): this {
		this.x *= num;
		this.y *= num;
		return this;
	}

	// @method scaleBy(scale: Point): Point
	// Multiply each coordinate of the current point by each coordinate of
	// `scale`. In linear algebra terms, multiply the point by the
	// [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
	// defined by `scale`.
	scaleBy(point: Point): Point {
		return new Point(this.x * point.x, this.y * point.y);
	}

	// @method unscaleBy(scale: Point): Point
	// Inverse of `scaleBy`. Divide each coordinate of the current point by
	// each coordinate of `scale`.
	unscaleBy(point: Point): Point {
		return new Point(this.x / point.x, this.y / point.y);
	}

	// @method round(): Point
	// Returns a copy of the current point with rounded coordinates.
	round(): Point {
		return this.clone()._round();
	}

	_round(): this {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	// @method floor(): Point
	// Returns a copy of the current point with floored coordinates (rounded down).
	floor(): Point {
		return this.clone()._floor();
	}

	_floor(): this {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	// @method ceil(): Point
	// Returns a copy of the current point with ceiled coordinates (rounded up).
	ceil(): Point {
		return this.clone()._ceil();
	}

	_ceil(): this {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	// @method trunc(): Point
	// Returns a copy of the current point with truncated coordinates (rounded towards zero).
	trunc(): Point {
		return this.clone()._trunc();
	}

	_trunc(): this {
		this.x = Math.trunc(this.x);
		this.y = Math.trunc(this.y);
		return this;
	}

	// @method distanceTo(otherPoint: Point): Number
	// Returns the cartesian distance between the current and the given points.
	distanceTo(point: Point): number {
		const dx = point.x - this.x;
		const dy = point.y - this.y;
		return Math.sqrt(dx*dx + dy*dy);
	}

	// @method equals(otherPoint: Point): Boolean
	// Returns `true` if the given point has the same coordinates.
	equals(point: Point): boolean {
		return point.x === this.x && point.y === this.y;
	}

	// @method contains(otherPoint: Point): Boolean
	// Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
	contains(point: Point): boolean {
		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	}

	// @method toString(): String
	// Returns a string representation of the point for debugging purposes.
	toString(): string {
		return `Point(${formatNum(this.x)}, ${formatNum(this.y)})`;
	}

}
