import type { Bounds } from './Bounds.js';
import { Point } from './Point.js';

/*************************************************************************
 * This file contains utilities for manipulating geometric *primitives*. *
 *                                                                       *
 * DO NOT DUMP CODE HERE THAT DEPENDS ON ANYTHING OTHER THAN GEOMETRIC   *
 * PRIMITIVES IN THE SURROUNDING FOLDER. THINK ABOUT THE HIERARCHY OF    *
 * CODE (LOW-LEVEL TO HIGH-LEVEL).                                       *
 *************************************************************************/

/**
 * Simplify polyline with vertex reduction and Douglas-Peucker simplification.
 * Improves rendering performance dramatically by lessening the number of points to draw.
 *
 * Dramatically reduces the number of points in a polyline while retaining
 * its shape and returns a new array of simplified points, using the
 * [Ramer-Douglas-Peucker algorithm](https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm).
 * Used for a huge performance boost when processing/displaying Leaflet polylines for
 * each zoom level and also reducing visual noise. tolerance affects the amount of
 * simplification (lesser value means higher quality but slower and with more points).
 * Also released as a separated micro-library [Simplify.js](https://mourner.github.io/simplify-js/).
 */
export function simplify(points: Point[], tolerance: number): Point[] {
	if (!tolerance || !points.length) {
		return points.slice();
	}

	const sqTolerance = tolerance * tolerance;

	// stage 1: vertex reduction
	points = _reducePoints(points, sqTolerance);

	// stage 2: Douglas-Peucker simplification
	points = _simplifyDP(points, sqTolerance);

	return points;
}

/**
 * Returns the distance between point `p` and segment `p1` to `p2`.
 */
export function pointToSegmentDistance(p: Point, p1: Point, p2: Point): number {
	return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

/**
 * Returns the closest point from a point `p` on a segment `p1` to `p2`.
 */
export function closestPointOnSegment(p: Point, p1: Point, p2: Point): Point {
	return _sqClosestPointOnSegment(p, p1, p2);
}

/**
 * Ramer-Douglas-Peucker simplification.
 * 
 * @see https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
 */
function _simplifyDP(points: readonly Point[], sqTolerance: number): Point[] {
	const
		len = points.length,
	    markers = new Uint8Array(len);

	markers[0] = markers[len - 1] = 1;

	_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

	let i;
	const newPoints: Point[] = [];

	for (i = 0; i < len; i++) {
		if (markers[i]) {
			newPoints.push(points[i]);
		}
	}

	return newPoints;
}

function _simplifyDPStep(
	points: readonly Point[],
	markers: Uint8Array,
	sqTolerance: number,
	first: number,
	last: number,
): void {
	let
		maxSqDist = 0,
		index: number;

	for (let i = first + 1; i <= last - 1; i++) {
		const sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		markers[index!] = 1;

		_simplifyDPStep(points, markers, sqTolerance, first, index!);
		_simplifyDPStep(points, markers, sqTolerance, index!, last);
	}
}

// reduce points that are too close to each other to a single point
function _reducePoints(
	points: readonly Point[],
	sqTolerance: number,
): Point[] {
	const reducedPoints = [points[0]];

	let prev = 0;

	for (let i = 1; i < points.length; i++) {
		if (_sqDist(points[i], points[prev]) > sqTolerance) {
			reducedPoints.push(points[i]);
			prev = i;
		}
	}
	if (prev < points.length - 1) {
		reducedPoints.push(points[points.length - 1]);
	}

	return reducedPoints;
}

let _lastCode: number;

/**
 * Clips the segment a to b by rectangular bounds with the
 * [Cohen-Sutherland algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm)
 * (modifying the segment points directly!). Used by Leaflet to only show polyline
 * points that are on the screen or near, increasing performance.
 */
export function clipSegment(
	a: Point,
	b: Point,
	bounds: Bounds,
	useLastCode?: boolean,
	round?: boolean,
): Point[] | undefined {
	let
		codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
	    codeB = _getBitCode(b, bounds),
	    codeOut,
		p,
		newCode;

	// save 2nd code to avoid calculating it on the next segment
	_lastCode = codeB;

	while (true) {
		// if a,b is inside the clip window (trivial accept)
		if (!(codeA | codeB)) {
			return [a, b];
		}

		// if a,b is outside the clip window (trivial reject)
		if (codeA & codeB) {
			return;
		}

		// other cases
		codeOut = codeA || codeB;
		p = _getEdgeIntersection(a, b, codeOut, bounds, round);
		newCode = _getBitCode(p, bounds);

		if (codeOut === codeA) {
			a = p;
			codeA = newCode;
		} else {
			b = p;
			codeB = newCode;
		}
	}
}

export function _getEdgeIntersection(
	a: Point,
	b: Point,
	code: number,
	bounds: Bounds,
	round?: boolean,
): Point {
	const
		dx = b.x - a.x,
		dy = b.y - a.y,
		min = bounds.min,
		max = bounds.max;

	let
		x: number,
		y: number;

	if (code & 8) { // top
		x = a.x + dx * (max.y - a.y) / dy;
		y = max.y;
	} else if (code & 4) { // bottom
		x = a.x + dx * (min.y - a.y) / dy;
		y = min.y;
	} else if (code & 2) { // right
		x = max.x;
		y = a.y + dy * (max.x - a.x) / dx;
	} else if (code & 1) { // left
		x = min.x;
		y = a.y + dy * (min.x - a.x) / dx;
	} else {
		// TODO: can we make last else-if clause just an else? What are the
		// expectations for the math done in this function?
		throw new Error("cannot compute edge intersection point");
	}

	return new Point(x, y, round);
}

export function _getBitCode(p: Point, bounds: Bounds): number {
	let code = 0;

	if (p.x < bounds.min.x) { // left
		code |= 1;
	} else if (p.x > bounds.max.x) { // right
		code |= 2;
	}

	if (p.y < bounds.min.y) { // bottom
		code |= 4;
	} else if (p.y > bounds.max.y) { // top
		code |= 8;
	}

	return code;
}

// square distance (to avoid unnecessary Math.sqrt calls)
function _sqDist(p1: Point, p2: Point): number {
	const
		dx = p2.x - p1.x,
	    dy = p2.y - p1.y;

	return dx*dx + dy*dy;
}

// return closest point on segment or distance to that point
// TODO: just split this into two functions instead of returning different things
// based on final parameter
export function _sqClosestPointOnSegment(p: Point, p1: Point, p2: Point): Point;
export function _sqClosestPointOnSegment(p: Point, p1: Point, p2: Point, sqDist: true): number;
export function _sqClosestPointOnSegment(
	p: Point,
	p1: Point,
	p2: Point,
	sqDist?: boolean,
): Point | number {
	let
		x = p1.x,
	    y = p1.y,
	    dx = p2.x - x,
	    dy = p2.y - y,
	    t;

	const dot = dx*dx + dy*dy;

	if (dot > 0) {
		t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

		if (t > 1) {
			x = p2.x;
			y = p2.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p.x - x;
	dy = p.y - y;

	return sqDist ? dx*dx + dy*dy : new Point(x, y);
}

/**
 * Clips the polygon geometry defined by the given `points` by the given bounds (using the [Sutherland-Hodgman algorithm](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)).
 * Used by Leaflet to only show polygon points that are on the screen or near, increasing
 * performance. Note that polygon points needs different algorithm for clipping
 * than polyline, so there's a separate method for it.
 * 
 * TODO: make this function allocate fewer arrays (just reuse them carefully)
 */
export function clipPolygon(
	points: readonly Point[],
	bounds: Bounds,
	round?: boolean,
): Point[] {
	let codes = points.map(p => _getBitCode(p, bounds));

	// for each edge (left, bottom, right, top)
	for (const edge of [1, 4, 2, 8]) {
		const
			clippedPoints: Point[] = [],
			clippedCodes: number[] = [];

		for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			const
				a = points[i],
				acode = codes[i],
				b = points[j],
				bcode = codes[j];

			// if a is inside the clip window
			if (!(acode & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (bcode & edge) {
					const p = _getEdgeIntersection(b, a, edge, bounds, round);
					clippedPoints.push(p);
					clippedCodes.push(_getBitCode(p, bounds));
				}
				clippedPoints.push(a);
				clippedCodes.push(acode);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(bcode & edge)) {
				const p = _getEdgeIntersection(b, a, edge, bounds, round);
				clippedPoints.push(p);
				clippedCodes.push(_getBitCode(p, bounds));
			}
		}

		points = clippedPoints;
		codes = clippedCodes;
	}

	// Safely cast away readonly because the variable will definitely be pointing to
	// the last 'clipped' point array we allocated from inside this function, NOT the
	// original passed array which we are basically promising not to mutate
	return points as Point[];
}
