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

/**
 * Unofficial alias code for Spherical Mercator (EPSG3857) used in OpenLayers.
 * 
 * @see https://epsg.io/900913
 */
export const EPSG900913 = {
	...EPSG3857,

	code: 'EPSG:900913'
} as const;
