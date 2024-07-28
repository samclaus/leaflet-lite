import { LatLng, LatLngBounds } from '../../geog';
import { GeogUtil } from '../../geog/util';
import { Bounds, GeomUtil, Point } from '../../geom';
import type { Map } from '../../map/Map';
import { Path } from './Path.js';

/**
 * A class for drawing polyline/polygon overlays on a map. Polyline by default,
 * but passing `true` for the second parameter closes it to form a polygon.
 *
 * Coordinates you pass when creating a polygon shouldn't have an additional last
 * point equal to the first one — it's better to filter out such points.
 *
 * You can even pass nested `LatLng` arrays. This is for making holes in polygons,
 * where the first coordinate array is the main polygon, and the remaining arrays
 * are used to "cut" holes in it. In the case of polylines, nested coordinates
 * will just cause multiple polylines to be drawn, exactly the same as if you
 * created a `Poly` instance for each line.
 */
export class Poly extends Path {

	_parts: Point[][] = [];
	_latlngs!: LatLng[][]; // initialized via _setLatLngs() call in constructor
	_bounds!: LatLngBounds; // initialized via _setLatLngs() call in constructor

	constructor(
		latlngs: LatLng[] | LatLng[][],
		/**
		 * True if this is a 'closed' polygon, or false if it is an 'open' polyline.
		 */
		public _closed = false,
		/**
		 * How much to simplify the polyline on each zoom level. More means better
		 * performance and smoother look, and less means more accurate representation.
		 */
		public _smoothFactor = 1,
	) {
		super();

		this.setLatLngs(latlngs);
	}

	// Replaces all the points in the polyline with the given array of geographical points.
	setLatLngs(latlngs: LatLng[] | LatLng[][]): void {
		if (GeogUtil.isFlat(latlngs)) {
			this._latlngs.length = 0;
			this._latlngs.push(latlngs);
		} else {
			this._latlngs = latlngs;
		}

		const bounds = new LatLngBounds();

		// Now extend the bounds to include every coordinate
		for (const part of this._latlngs) {
			for (const latlng of part) {
				bounds.extend(latlng);
			}
		}

		this._bounds = bounds;
	}

	// Adds a given point to the polyline. By default, adds to the first ring of
	// the polyline in case of a multi-polyline, but can be overridden by passing
	// a specific part index.
	addLatLng(latlng: LatLng, part = 0): void {
		if (part > this._latlngs.length) {
			this._latlngs.push([latlng]);
		} else {
			this._latlngs[part].push(latlng);
		}

		this._bounds.extend(latlng);
	}

	project(map: Map, padding: number): void {
		const pxBounds = new Bounds();

		// TODO: preserve/mutate existing arrays

		this._parts.length = 0;

		for (
			const part of this._latlngs
		) {
			const projected: Point[] = [];

			for (const latlng of part) {
				const point = map.latLngToLayerPoint(latlng);
				projected.push(point);
				pxBounds.extend(point);
			}

			this._parts.push(projected);
		}

		if (this._bounds.isValid() && pxBounds.isValid()) {
			const p = new Point(padding, padding);

			pxBounds.min._subtract(p);
			pxBounds.max._add(p);
	
			this._pxBounds = pxBounds;
		}

		const {_parts, _smoothFactor} = this;

		for (let i = 0; i < _parts.length; ++i) {
			_parts[i] = GeomUtil.simplify(_parts[i], _smoothFactor);
		}
	}

	render(ctx: CanvasRenderingContext2D): void {
		const {_parts, _closed} = this;

		if (!_parts.length) { return; }

		ctx.beginPath();

		for (let i = 0; i < _parts.length; ++i) {
			const part = _parts[i];

			for (let j = 0; j < part.length; ++j) {
				const p = part[j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y); // TODO: this is probably slow
			}

			if (_closed) {
				ctx.closePath();
			}
		}
	}

}

/**
 * Get the point on the polyline closest to `p`. The polyline MUST be projected according
 * to the current pan/zoom of the map (rather, the pan/zoom at the time `p` was obtained)
 * for the result to be accurate.
 */
export function closestLayerPointOnPolyline(line: Poly, p: Point): Point | undefined {
	let
		minDistance = Infinity,
		minPoint: Point | undefined,
		p1,
		p2;

	const closest = GeomUtil._sqClosestPointOnSegment;

	for (let j = 0, jLen = line._parts.length; j < jLen; j++) {
		const points = line._parts[j];

		for (let i = 1, len = points.length; i < len; i++) {
			p1 = points[i - 1];
			p2 = points[i];

			const sqDist = closest(p, p1, p2, true);

			if (sqDist < minDistance) {
				minDistance = sqDist;
				minPoint = closest(p, p1, p2);
			}
		}
	}

	return minPoint;
}

// HISTORY: Leaflet, by default, with a 'noClip' option to disable, 'clips' polylines and
// polygons to the canvas/SVG viewport prior to rendering. This involves a fair bit of
// computation in JavaScript (i.e., running on the CPU), not to mention all the code to
// do that computation is fairly verbose and therefore impacts bundle size considerably.
// Leaflet also would only apply CSS translations to canvas/SVG renderers DURING panning
// or zooming operations, and then would re-render all paths from scratch once the map
// settled. I removed SVG rendering entirely because the technology is a poor fit (slow)
// for the purpose of highly-interactive geographical maps. Canvas rendering is generally
// done using dedicated GPUs behind the scenes in most modern web browsers/computers, and
// there is already technology at lower-levels to account for not doing extra rendering
// work outside of the viewport. Not to mention, this polyline clipping code does not
// account for `fill: true`. What I mean is if a polyline extends outside the viewport and
// wraps around it (like a spiral) but does not re-enter the viewport, this code would
// incorrectly remove those parts of it even if you use `fill: true` which should cause the
// viewport to get hit with the fill color according to the parts that extend outside of the
// viewport. I am leaving this code here JUST IN CASE I misunderstood the purpose/ramifications.
//
// function clipPolyline(p: Polyline, bounds: Bounds): void {
// 	p._parts = [];
// 	if (!p._pxBounds || !p._pxBounds.intersects(bounds)) {
// 		return;
// 	}

// 	if (p.options.noClip) {
// 		p._parts = p._rings;
// 		return;
// 	}

// 	const parts = p._parts;
// 	let
// 		i: number,
// 		j: number,
// 		k: number,
// 		len: number,
// 		len2: number,
// 		segment: Point[] | undefined,
// 		points: Point[];

// 	for (i = 0, k = 0, len = p._rings.length; i < len; i++) {
// 		points = p._rings[i];

// 		for (j = 0, len2 = points.length; j < len2 - 1; j++) {
// 			segment = GeomUtil.clipSegment(points[j], points[j + 1], bounds, j as any, true); // TODO

// 			if (!segment) { continue; }

// 			parts[k] = parts[k] || [];
// 			parts[k].push(segment[0]);

// 			// if segment goes out of screen, or it's the last one, it's the end of the line part
// 			if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
// 				parts[k].push(segment[1]);
// 				k++;
// 			}
// 		}
// 	}
// }

// function clipPolygon(poly: Polygon, bounds: Bounds): void {
// 	// polygons need a different clipping algorithm so we redefine that

// 	const
// 		w = poly.options.weight,
// 		p = new Point(w, w);

// 	// increase clip padding by stroke width to avoid stroke on clip edges
// 	bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

// 	poly._parts = [];
// 	if (!poly._pxBounds || !poly._pxBounds.intersects(bounds)) {
// 		return;
// 	}

// 	if (poly.options.noClip) {
// 		poly._parts = poly._rings;
// 		return;
// 	}

// 	for (let i = 0, len = poly._rings.length, clipped; i < len; i++) {
// 		clipped = GeomUtil.clipPolygon(poly._rings[i], bounds, true);
// 		if (clipped.length) {
// 			poly._parts.push(clipped);
// 		}
// 	}
// }
