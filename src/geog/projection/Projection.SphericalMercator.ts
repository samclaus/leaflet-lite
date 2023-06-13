import { LatLng } from '..';
import { Bounds, Point } from '../../geom';

const earthRadius = 6378137;

/**
 * Spherical Mercator projection — the most common projection for online maps,
 * used by almost all free and commercial tile providers. Assumes that Earth is
 * a sphere. Used by the `EPSG:3857` CRS.
 */
export const SphericalMercator = {

	R: earthRadius,
	MAX_LATITUDE: 85.0511287798,
	bounds: (function () {
		const d = earthRadius * Math.PI;
		return new Bounds(
			new Point(-d, -d),
			new Point(d, d),
		);
	})(),

	project(latlng: LatLng): Point {
		const
			d = Math.PI / 180,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    sin = Math.sin(lat * d);

		return new Point(
			this.R * latlng.lng * d,
			this.R * Math.log((1 + sin) / (1 - sin)) / 2,
		);
	},

	unproject(point: Point): LatLng {
		const d = 180 / Math.PI;

		return new LatLng(
			(2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
			point.x * d / this.R,
		);
	},

} as const;
