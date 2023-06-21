import { LatLng, LatLngBounds } from '..';
import { Point } from '../../geom';
import type { CRS } from '../crs';

/**************************************************************************
 * This file contains utilities for manipulating geographic *primitives*. *
 *                                                                        *
 * DO NOT DUMP CODE HERE THAT DEPENDS ON ANYTHING OTHER THAN GEOGRAPHIC   *
 * PRIMITIVES IN THE SURROUNDING FOLDER. THINK ABOUT THE HIERARCHY OF     *
 * CODE (LOW-LEVEL TO HIGH-LEVEL).                                        *
 *                                                                        *
 * Geographic code is, on that note, mid-level code in the project. It    *
 * depends on geoMETRIC primitives, but not much else.                    *
 **************************************************************************/

/**
 * Returns true if `latlngs` is a flat array, false is nested.
 * 
 * @deprecated Working with nested arrays should be very explicit throughout the code.
 */
export function isFlat(latlngs: LatLng[] | LatLng[][]): latlngs is LatLng[] {
	return !latlngs.length || latlngs[0] instanceof LatLng;
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

/**
 * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the passed LatLngs (first ring) from a polyline.
 */
export function polylineCenter(latlngs: readonly LatLng[], crs: CRS): LatLng {
	let i, halfDist, segDist, dist, p1, p2, ratio, center: Point;

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
	const points: Point[] = [];

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

	for (i = 0, halfDist = 0; i < len - 1; i++) {
		halfDist += points[i].distanceTo(points[i + 1]) / 2;
	}

	// The line is so small in the current view that all points are on the same pixel.
	if (halfDist === 0) {
		center = points[0];
	} else {
		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				center = new Point(
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				);
				break;
			}
		}
	}

	const latlngCenter = crs.unproject(center!); // TODO: null safety

	return new LatLng(
		latlngCenter.lat + centroidLatLng.lat,
		latlngCenter.lng + centroidLatLng.lng,
	);
}

/**
 * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the
 * passed LatLngs (first ring) from a polygon.
 */
export function polygonCenter(latlngs: readonly LatLng[], crs: CRS): LatLng {
	let i, j, p1, p2, f, area, x, y, center: Point;

	if (!latlngs || latlngs.length === 0) {
		throw new Error('latlngs not passed');
	}

	let centroidLatLng = new LatLng(0, 0);

	const bounds = new LatLngBounds(...latlngs);
	const areaBounds = (
		bounds.getNorthWest().distanceTo(bounds.getSouthWest()) *
		bounds.getNorthEast().distanceTo(bounds.getNorthWest())
	);
	
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
