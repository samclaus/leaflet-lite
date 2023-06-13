import { Util } from '../core';
import { Earth } from './crs';
import { LatLngBounds } from './LatLngBounds.js';

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
		const margin = Math.max(
			Math.abs(this.lat - other.lat),
			Math.abs(this.lng - other.lng),
		);
		return margin <= maxMargin;
	}

	// Returns the distance (in meters) to the given `LatLng` calculated using the [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
	distanceTo(other: LatLng): number {
		return Earth.distance(this, other);
	}

	// Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees.
	wrap(): LatLng {
		return Earth.wrapLatLng(this);
	}

	// Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
	toBounds(sizeInMeters: number): LatLngBounds {
		const latAccuracy = 180 * sizeInMeters / 40075017;
		const lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return new LatLngBounds(
			new LatLng(this.lat - latAccuracy, this.lng - lngAccuracy),
			new LatLng(this.lat + latAccuracy, this.lng + lngAccuracy),
		);
	}

	clone(): LatLng {
		return new LatLng(this.lat, this.lng, this.alt);
	}

	// Returns a string representation of the point (for debugging purposes).
	toString(precision?: number): string {
		return `LatLng(${Util.formatNum(this.lat, precision)}, ${Util.formatNum(this.lng, precision)})`;
	}

}
