import { LatLng, LatLngBounds } from '../../geog';
import { Earth } from '../../geog/crs';
import { Point } from '../../geom';
import type { Map } from '../../map';
import { CircleMarker } from './CircleMarker.js';

/**
 * A "physically sized" circle, with the radius specified in meters, that
 * will appear bigger/smaller depending on the current zoom of the map.
 *
 * It's an approximation and starts to become an ellipse closer
 * to poles (due to projection distortion).
 */
export class Circle extends CircleMarker {

	/** Radius of the circle in meters. */
	_mRadius: number;

	constructor(
		latlng: LatLng,
		radius?: number,
	) {
		super(latlng, radius);

		this._mRadius = this._radius;
	}

	project(map: Map, padding: number): void {
		const
			lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    crs = map.options.crs;

		if (crs.distance === Earth.distance) {
			const
				d = Math.PI / 180,
				latR = (this._mRadius / Earth.R) / d,
				top = map.project(new LatLng(lat + latR, lng)),
				bottom = map.project(new LatLng(lat - latR, lng)),
				p = top.add(bottom).divideBy(2),
				lat2 = map.unproject(p).lat;

			let lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			if (isNaN(lngR) || lngR === 0) {
				lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
			}

			this._point = p.subtract(map.getPixelOrigin());
			this._radius = isNaN(lngR) ? 0 : p.x - map.project(new LatLng(lat2, lng - lngR)).x;
			this._radiusY = p.y - top.y;
		} else {
			const latlng2 = crs.unproject(crs.project(this._latlng).subtract(new Point(this._mRadius, 0)));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point!.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._recomputeBounds(padding);
	}

}

/**
 * Get the geographical bounds of the physical circle, which may be stretched into an
 * ellipse depending on the CRS and zoom level. The circle MUST be projected according
 * to the current pan/zoom of the map FIRST, or this will return outdated/invalid
 * information, or even throw an error if the circle was never projected.
 */
export function computeCircleBounds(c: Circle, map: Map): LatLngBounds {
	const
		half = new Point(c._radius, c._radiusY || c._radius),
		point = c._point!; // TODO: null safety

	return new LatLngBounds(
		map.layerPointToLatLng(point.subtract(half)),
		map.layerPointToLatLng(point.add(half)),
	);
}
