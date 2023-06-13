import { LatLng, LatLngBounds } from '../geog';
import type { CRS } from '../geog/crs';
import { Bounds } from './Bounds.js';
import * as LineUtil from './LineUtil.js';
import { Point } from './Point.js';

// This file contains utilities for manipulating polygon geometry.

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
	let codes = points.map(p => LineUtil._getBitCode(p, bounds));

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
					const p = LineUtil._getEdgeIntersection(b, a, edge, bounds, round);
					clippedPoints.push(p);
					clippedCodes.push(LineUtil._getBitCode(p, bounds));
				}
				clippedPoints.push(a);
				clippedCodes.push(acode);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(bcode & edge)) {
				const p = LineUtil._getEdgeIntersection(b, a, edge, bounds, round);
				clippedPoints.push(p);
				clippedCodes.push(LineUtil._getBitCode(p, bounds));
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

/* @function polygonCenter(latlngs: LatLng[], crs: CRS): LatLng
 * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the passed LatLngs (first ring) from a polygon.
 * TODO: originally this function allowed taking nested arrays of LatLngs, in which case only the first element of the
 * outer array was used--this should be done at the call site if it is actually necessary somewhere
 */
export function polygonCenter(latlngs: readonly LatLng[], crs: CRS) {
	let i, j, p1, p2, f, area, x, y, center: Point;

	if (!latlngs || latlngs.length === 0) {
		throw new Error('latlngs not passed');
	}

	let centroidLatLng = new LatLng(0, 0);

	const bounds = new LatLngBounds(...latlngs);
	const areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) * bounds.getNorthEast().distanceTo(bounds.getNorthWest());
	
	// tests showed that below 1700 rounding errors are happening
	if (areaBounds < 1700) {
		// getting a inexact center, to move the latlngs near to [0, 0] to prevent rounding errors
		centroidLatLng = centroid(latlngs);
	}

	const len = latlngs.length;
	const points = [];

	for (i = 0; i < len; i++) {
		const latlng = latlngs[i];

		points.push(
			crs.project(
				new LatLng(
					latlng.lat - centroidLatLng.lat,
					latlng.lng - centroidLatLng.lng,
				),
			),
		);
	}

	area = x = y = 0;

	// polygon centroid algorithm;
	for (i = 0, j = len - 1; i < len; j = i++) {
		p1 = points[i];
		p2 = points[j];

		f = p1.y * p2.x - p2.y * p1.x;
		x += (p1.x + p2.x) * f;
		y += (p1.y + p2.y) * f;
		area += f * 3;
	}

	if (area === 0) {
		// Polygon is so small that all points are on same pixel.
		center = points[0];
	} else {
		center = new Point(x / area, y / area);
	}

	const latlngCenter = crs.unproject(center);

	return new LatLng(
		latlngCenter.lat + centroidLatLng.lat,
		latlngCenter.lng + centroidLatLng.lng,
	);
}

/**
 * Returns the 'center of mass' of the passed LatLngs by simply averaging
 * all of their lat/lng values.
 */
export function centroid(coords: readonly LatLng[]): LatLng {
	const numCoords = coords.length;

	let latSum = 0;
	let lngSum = 0;
	
	for (let i = 0; i < numCoords; i++) {
		const {lat, lng} = coords[i];
		latSum += lat;
		lngSum += lng;
	}

	return new LatLng(latSum / numCoords, lngSum / numCoords);
}
