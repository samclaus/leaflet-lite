import { Transformation } from '../../geom';
import { Mercator } from '../projection';
import { Earth } from './CRS.Earth.js';

const scale = 0.5 / (Math.PI * Mercator.R);

/**
 * Rarely used by some commercial tile providers. Uses Elliptical Mercator projection.
 */
export const EPSG3395 = {
	...Earth,

	code: 'EPSG:3395',
	projection: Mercator,
	transformation: new Transformation(scale, 0.5, -scale, 0.5),
} as const;
