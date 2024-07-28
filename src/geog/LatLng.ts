import { Util } from '../core';

/**
 * Represents a geographical point with a certain latitude and longitude,
 * and, optionally, an altitude.
 */
export class LatLng {

	constructor(
		public lat: number,
		public lng: number,
		public alt: number | undefined = undefined,
	) {}

	// Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
	equals(other: LatLng, maxMargin = 1.0E-9): boolean {
		return Math.max(
			Math.abs(this.lat - other.lat),
			Math.abs(this.lng - other.lng),
		) <= maxMargin;
	}

	clone(): LatLng {
		return new LatLng(this.lat, this.lng, this.alt);
	}

	// Returns a string representation of the point (for debugging purposes).
	toString(precision?: number): string {
		return `LatLng(${Util.formatNum(this.lat, precision)}, ${Util.formatNum(this.lng, precision)})`;
	}

}
