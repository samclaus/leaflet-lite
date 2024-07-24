import { Util } from '../../core';
import { LatLng, LatLngBounds } from '../../geog';
import { GeogUtil } from '../../geog/util';
import { Bounds, GeomUtil, Point } from '../../geom';
import type { Canvas } from './Canvas.js';
import { Path, type PathOptions } from './Path.js';

export interface PolylineOptions extends PathOptions {
	// @option smoothFactor: Number = 1.0
	// How much to simplify the polyline on each zoom level. More means
	// better performance and smoother look, and less means more accurate representation.
	smoothFactor: number;

	// @option noClip: Boolean = false
	// Disable polyline clipping.
	noClip: boolean;
}

/**
 * A class for drawing polyline overlays on a map. Extends `Path`.
 *
 * ```js
 * // create a red polyline from an array of LatLng points
 * var latlngs = [
 * 	[45.51, -122.68],
 * 	[37.77, -122.43],
 * 	[34.04, -118.2]
 * ];
 *
 * const polyline = L.polyline(latlngs, {color: 'red'});
 * 
 * map.addLayer(polyline);
 *
 * // zoom the map to the polyline
 * map.fitBounds(polyline.getBounds());
 * ```
 *
 * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
 *
 * ```js
 * // create a red polyline from an array of arrays of LatLng points
 * var latlngs = [
 * 	[[45.51, -122.68],
 * 	 [37.77, -122.43],
 * 	 [34.04, -118.2]],
 * 	[[40.78, -73.91],
 * 	 [41.83, -87.62],
 * 	 [32.76, -96.72]]
 * ];
 * ```
 */
export class Polyline extends Path {

	declare options: PolylineOptions;

	_parts: Point[][] = [];
	_rings!: Point[][]; // TODO
	_latlngs!: LatLng[] | LatLng[][]; // initialized via _setLatLngs() call in constructor
	_bounds!: LatLngBounds; // initialized via _setLatLngs() call in constructor
	_rawPxBounds: Bounds | undefined;

	constructor(
		_canvas: Canvas,
		latlngs: LatLng[],
		options?: Partial<PolylineOptions>,
	) {
		super(_canvas);

		Util.setOptions(this, options, {
			smoothFactor: 1.0,
			noClip: false,
		});

		this._setLatLngs(latlngs);
	}

	// Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
	getLatLngs(): LatLng[] | LatLng[][] {
		return this._latlngs;
	}

	// Returns the `LatLngBounds` of the path.
	getBounds(): LatLngBounds {
		return this._bounds;
	}

	// Replaces all the points in the polyline with the given array of geographical points.
	setLatLngs(latlngs: LatLng[]): this {
		this._setLatLngs(latlngs);
		return this.redraw();
	}

	// Returns `true` if the Polyline has no LatLngs.
	isEmpty(): boolean {
		return !this._latlngs.length;
	}

	// Returns the point closest to `p` on the Polyline.
	closestLayerPoint(p: Point): Point | undefined {
		let
			minDistance = Infinity,
		    minPoint: Point | undefined,
		    p1,
			p2;

		const closest = GeomUtil._sqClosestPointOnSegment;

		for (let j = 0, jLen = this._parts.length; j < jLen; j++) {
			const points = this._parts[j];

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

		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}

		return minPoint;
	}

	// Returns the center ([centroid](https://en.wikipedia.org/wiki/Centroid)) of the polyline.
	getCenter(): LatLng {
		return GeogUtil.polylineCenter(
			this._defaultShape(),
			this._canvas._map.options.crs,
		);
	}

	// Adds a given point to the polyline. By default, adds to the first ring of
	// the polyline in case of a multi-polyline, but can be overridden by passing
	// a specific ring as a LatLng array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
	addLatLng(latlng: LatLng, latlngs = this._defaultShape()): this {
		latlngs.push(latlng);
		this._bounds.extend(latlng);
		return this.redraw();
	}

	_setLatLngs(latlngs: LatLng[] | LatLng[][]): void {
		const bounds = new LatLngBounds();

		this._bounds = bounds;
		this._latlngs = latlngs;

		// Now extend the bounds to include every coordinate
		if (GeogUtil.isFlat(latlngs)) {
			for (const latlng of latlngs) {
				bounds.extend(latlng);
			}
		} else {
			for (const ring of latlngs) {
				for (const latlng of ring) {
					bounds.extend(latlng);
				}
			}
		}
	}

	_defaultShape(): LatLng[] {
		return GeogUtil.isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
	}

	_project(): void {
		const pxBounds = new Bounds();

		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings, pxBounds);

		if (this._bounds.isValid() && pxBounds.isValid()) {
			this._rawPxBounds = pxBounds;
			this._updateBounds();
		}
	}

	_updateBounds(): void {
		const
			w = this._clickTolerance(),
		    p = new Point(w, w);

		if (!this._rawPxBounds) {
			return;
		}

		this._pxBounds = new Bounds(
			this._rawPxBounds.min.subtract(p),
			this._rawPxBounds.max.add(p)
		);
	}

	// recursively turns latlngs into a set of rings with projected coordinates
	_projectLatlngs(latlngs: LatLng[] | LatLng[][], result: Point[][], projectedBounds: Bounds): void {
		if (!GeogUtil.isFlat(latlngs)) {
			for (let i = 0; i < latlngs.length; ++i) {
				this._projectLatlngs(latlngs[i], result, projectedBounds);
			}
			return;
		}

		const
			map = this._canvas._map,
			ring: Point[] = [];

		for (let i = 0; i < latlngs.length; ++i) {
			ring[i] = map.latLngToLayerPoint(latlngs[i]);
			projectedBounds.extend(ring[i]);
		}

		result.push(ring);
	}

	// clip polyline by renderer bounds so that we have less to render for performance
	_clipPoints() {
		const bounds = this._canvas!._bounds!; // TODO: null safety

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		const parts = this._parts;
		let
			i: number,
			j: number,
			k: number,
			len: number,
			len2: number,
			segment: Point[] | undefined,
			points: Point[];

		for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
			points = this._rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = GeomUtil.clipSegment(points[j], points[j + 1], bounds, j as any, true); // TODO

				if (!segment) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	}

	// simplify each clipped part of the polyline for performance
	_simplifyPoints(): void {
		const
			parts = this._parts,
		    tolerance = this.options.smoothFactor;

		for (let i = 0, len = parts.length; i < len; i++) {
			parts[i] = GeomUtil.simplify(parts[i], tolerance);
		}
	}

	_update(): void {
		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	}

	_updatePath(): void {
		this._canvas._updatePoly(this);
	}

}
