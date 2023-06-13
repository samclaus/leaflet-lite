import { LatLng } from '..';
import { Bounds, Point } from '../../geometry';

/**
 * Equirectangular, or Plate Carree projection — the most simple projection,
 * mostly used by GIS enthusiasts. Directly maps `x` as longitude, and `y` as
 * latitude. Also suitable for flat worlds, e.g. game maps. Used by the
 * `EPSG:4326` and `Simple` CRS.
 */
export const LonLat = {

	bounds: new Bounds(new Point(-180, -90), new Point(180, 90)),

	project(latlng: LatLng): Point {
		return new Point(latlng.lng, latlng.lat);
	},

	unproject(point: Point): LatLng {
		return new LatLng(point.y, point.x);
	},

} as const;
