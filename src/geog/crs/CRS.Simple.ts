import type { LatLng } from '..';
import { Transformation } from '../../geom';
import { LonLat } from '../projection';
import { CRS_BASE } from './CRS.js';

/**
 * A simple CRS that maps longitude and latitude into `x` and `y` directly.
 * May be used for maps of flat surfaces (e.g. game maps). Note that the `y`
 * axis should still be inverted (going from bottom to top). `distance()` returns
 * simple euclidean distance.
 */
export const Simple = {

	...CRS_BASE,

	projection: LonLat,
	transformation: new Transformation(1, 0, -1, 0),
	infinite: true,

	scale(zoom: number): number {
		return Math.pow(2, zoom);
	},

	zoom(scale: number): number {
		return Math.log(scale) / Math.LN2;
	},

	distance(latlng1: LatLng, latlng2: LatLng): number {
		const
			dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx*dx + dy*dy);
	},

} as const;
