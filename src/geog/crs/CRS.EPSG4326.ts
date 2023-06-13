import { Transformation } from '../../geom';
import { LonLat } from '../projection';
import { Earth } from './CRS.Earth.js';

/**
 * A common CRS among GIS enthusiasts. Uses simple Equirectangular projection.
 *
 * Leaflet 1.0.x complies with the [TMS coordinate scheme for EPSG:4326](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic),
 * which is a breaking change from 0.7.x behaviour.  If you are using a `TileLayer`
 * with this CRS, ensure that there are two 256x256 pixel tiles covering the
 * whole earth at zoom level zero, and that the tile coordinate origin is (-180,+90),
 * or (-180,-90) for `TileLayer`s with [the `tms` option](#tilelayer-tms) set.
 */
export const EPSG4326 = {
	...Earth,

	code: 'EPSG:4326',
	projection: LonLat,
	transformation: new Transformation(1 / 180, 1, -1 / 180, 0.5),
} as const;
