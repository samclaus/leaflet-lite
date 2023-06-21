import type { LatLng } from '..';
import { CRS_BASE } from './CRS.js';

/**
 * Serves as the base for CRSs that are global such that they cover the earth.
 * Can only be used as the base for other CRSs and cannot be used directly,
 * since it does not have a `code`, `projection` or `transformation`.
 *
 * `distance()` returns meters.
 */
export const Earth = {

	...CRS_BASE,

	wrapLng: [-180, 180],

	/**
	 * Mean Earth Radius, as recommended for use by
	 * the International Union of Geodesy and Geophysics,
	 * see https://rosettacode.org/wiki/Haversine_formula
	 */
	R: 6371000,

	/**
	 * Calculate the approximate distance (in meters) between two coordinates using the
	 * [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
	 */
	distance(latlng1: LatLng, latlng2: LatLng): number {
		const
			rad = Math.PI / 180,
		    lat1 = latlng1.lat * rad,
		    lat2 = latlng2.lat * rad,
		    sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
		    sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
		    a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
		    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return this.R * c;
	},

} as const;
