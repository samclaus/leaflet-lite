import { Transformation } from '../../geom';
import { SphericalMercator } from '../projection';
import { Earth } from './CRS.Earth.js';

/**
 * The most common CRS for online maps, used by almost all free and commercial
 * tile providers. Uses Spherical Mercator projection. Set in by default in
 * Map's `crs` option.
 */
export const EPSG3857 = {
	...Earth,

	code: 'EPSG:3857',
	projection: SphericalMercator,
	transformation: (function () {
		const scale = 0.5 / (Math.PI * SphericalMercator.R);
		return new Transformation(scale, 0.5, -scale, 0.5);
	}()),
} as const;

// TODO: find out and document why there is an identical projection with a different code. Some sort
// of historical fumble for the spherical Mercator projection where it is known by multiple names?
export const EPSG900913 = {
	...EPSG3857,

	code: 'EPSG:900913'
} as const;
