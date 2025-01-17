import { Point } from './Point.js';

/**
 * Represents a rectangular area in pixel coordinates.
 *
 * ```js
 * var p1 = L.point(10, 10),
 * p2 = L.point(40, 60),
 * bounds = L.bounds(p1, p2);
 * ```
 *
 * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * otherBounds.intersects([[10, 10], [40, 60]]);
 * ```
 *
 * Note that `Bounds` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */
export class Bounds {

	min!: Point; // assigned by extend() call in constructor
	max!: Point; // assigned by extend() call in constructor

	// TODO: figure out where this is called and make sure Bounds is always constructed
	// with at least a single Point (also make constructor monomorphic)
	constructor(...points: readonly Point[]) {
		// TODO: need to enforce that enough points are passed, preferably without guarding here
		for (let i = 0, len = points.length; i < len; i++) {
			this.extend(points[i]);
		}
	}
	
	// Extends the bounds to contain the given point or bounds.
	// TODO: separate into 2 monomorphic methods.
	extend(obj: Point | Bounds): this {
		let min2: Point;
		let max2: Point;

		if (obj instanceof Point) {
			min2 = max2 = obj;
		} else {
			min2 = obj.min;
			max2 = obj.max;
		}

		// @property min: Point
		// The top left corner of the rectangle.
		// @property max: Point
		// The bottom right corner of the rectangle.
		if (!this.min && !this.max) {
			this.min = min2.clone();
			this.max = max2.clone();
		} else {
			this.min.x = Math.min(min2.x, this.min.x);
			this.max.x = Math.max(max2.x, this.max.x);
			this.min.y = Math.min(min2.y, this.min.y);
			this.max.y = Math.max(max2.y, this.max.y);
		}

		return this;
	}

	// Returns the center point of the bounds.
	getCenter(round?: boolean): Point {
		return new Point(
			(this.min.x + this.max.x) / 2,
			(this.min.y + this.max.y) / 2,
			round,
		);
	}

	// Returns the bottom-left point of the bounds.
	getBottomLeft(): Point {
		return new Point(this.min.x, this.max.y);
	}

	// Returns the top-right point of the bounds.
	getTopRight(): Point {
		return new Point(this.max.x, this.min.y);
	}

	// Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)).
	getTopLeft(): Point {
		return this.min;
	}

	// Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)).
	getBottomRight(): Point {
		return this.max;
	}

	// Returns the size of the given bounds
	getSize(): Point {
		return this.max.subtract(this.min);
	}

	// Returns true if these bounds contain the given point or bounds.
	// TODO: make this not polymorphic, add "fromPoint" constructor for Bounds class
	contains(obj: Point | Bounds): boolean {
		let min: Point;
		let max: Point;

		if (obj instanceof Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (
			(min.x >= this.min.x) &&
			(max.x <= this.max.x) &&
			(min.y >= this.min.y) &&
			(max.y <= this.max.y)
		);
	}

	// Returns `true` if the rectangle intersects the given bounds. Two bounds
	// intersect if they have at least one point in common.
	intersects(otherBounds: Bounds): boolean {
		const
			min = this.min,
		    max = this.max,
		    min2 = otherBounds.min,
		    max2 = otherBounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	}

	// Returns `true` if the rectangle overlaps the given bounds. Two bounds
	// overlap if their intersection is an area.
	overlaps(otherBounds: Bounds): boolean {
		const
			min = this.min,
		    max = this.max,
		    min2 = otherBounds.min,
		    max2 = otherBounds.max,
		    xOverlaps = (max2.x > min.x) && (min2.x < max.x),
		    yOverlaps = (max2.y > min.y) && (min2.y < max.y);

		return xOverlaps && yOverlaps;
	}

	// Returns `true` if the bounds are properly initialized.
	/** @deprecated Bounds should never be constructed with an "invalid" state-makes no sense */
	isValid(): boolean {
		return !!(this.min && this.max);
	}

	// Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
	// For example, a ratio of 0.5 extends the bounds by 50% in each direction.
	// Negative values will retract the bounds.
	pad(bufferRatio: number): Bounds {
		const
			min = this.min,
			max = this.max,
			heightBuffer = Math.abs(min.x - max.x) * bufferRatio,
			widthBuffer = Math.abs(min.y - max.y) * bufferRatio;

		return new Bounds(
			new Point(min.x - heightBuffer, min.y - widthBuffer),
			new Point(max.x + heightBuffer, max.y + widthBuffer),
		);
	}

	// Returns `true` if the rectangle is equivalent to the given bounds.
	equals(otherBounds: Bounds): boolean {
		return (
			this.min.equals(otherBounds.min) &&
			this.max.equals(otherBounds.max)
		);
	}

}
