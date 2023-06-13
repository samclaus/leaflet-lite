import { Transformation } from '../../geometry';
import { Mercator } from '../projection';
import { Earth } from './CRS.Earth.js';

/**
 * Rarely used by some commercial tile providers. Uses Elliptical Mercator projection.
 */
export const EPSG3395 = {
	...Earth,

	code: 'EPSG:3395',
	projection: Mercator,
	transformation: (function () {
		const scale = 0.5 / (Math.PI * Mercator.R);
		return new Transformation(scale, 0.5, -scale, 0.5);
	}()),
} as const;
