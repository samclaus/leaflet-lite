import { LatLng } from '../../geog';
import { Bounds, LineUtil, Point, PolyUtil } from '../../geom';
import { Polyline, type PolylineOptions } from './Polyline.js';

/**
 * A class for drawing polygon overlays on a map. Extends `Polyline`.
 *
 * Note that points you pass when creating a polygon shouldn't have an additional last point equal to the first one — it's better to filter out such points.
 *
 * ```js
 * // create a red polygon from an array of LatLng points
 * var latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
 *
 * var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polygon
 * map.fitBounds(polygon.getBounds());
 * ```
 *
 * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
 *
 * ```js
 * var latlngs = [
 *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 * ];
 * ```
 *
 * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
 *
 * ```js
 * var latlngs = [
 *   [ // first polygon
 *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 *   ],
 *   [ // second polygon
 *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
 *   ]
 * ];
 * ```
 */
export class Polygon extends Polyline {

	constructor(
		latlngs: LatLng[],
		options?: Partial<PolylineOptions>,
	) {
		super(latlngs, options);

		// Default path options set 'fill' to false if not provided explicitly,
		// but polygons should make it true by default
		this.options.fill = options?.fill ?? true;
		this._setLatLngs(latlngs);
	}

	isEmpty(): boolean {
		return !this._latlngs.length || !(this._latlngs[0] as any).length;
	}

	// Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the Polygon.
	getCenter(): LatLng {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}
		return PolyUtil.polygonCenter(this._defaultShape(), this._map.options.crs);
	}

	_setLatLngs(latlngs: LatLng[] | LatLng[][]): void {
		Polyline.prototype._setLatLngs.call(this, latlngs);
		latlngs = this._latlngs; // in case the Polyline method modified the coordinates

		if (LineUtil.isFlat(latlngs)) {
			// Remove the last point if it equals the first
			if (latlngs.length >= 2 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
				latlngs.pop();
			}

			this._latlngs = [latlngs];
		}
	}

	_defaultShape() {
		// TODO: does this class use even deeper nested coordinate arrays than Polyline does??
		return LineUtil.isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
	}

	_clipPoints(): void {
		// polygons need a different clipping algorithm so we redefine that

		// TODO: null safety
		let bounds = this._renderer!._bounds!;
		const
			w = this.options.weight,
		    p = new Point(w, w);

		// increase clip padding by stroke width to avoid stroke on clip edges
		bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		for (let i = 0, len = this._rings.length, clipped; i < len; i++) {
			clipped = PolyUtil.clipPolygon(this._rings[i], bounds, true);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	}

	_updatePath(): void {
		// TODO: null safety
		this._renderer!._updatePoly(this, true);
	}

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint(p: Point): boolean {
		let
			inside = false,
		    part, p1, p2, i, j, k, len, len2;

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// ray casting algorithm for detecting if point is in polygon
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		// also check if it's on polygon stroke
		return inside || Polyline.prototype._containsPoint.call(this, p, true);
	}

}
