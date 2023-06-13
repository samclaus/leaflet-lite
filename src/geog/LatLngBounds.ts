import { LatLng } from './LatLng.js';

/**
 * Represents a rectangular geographical area on a map.
 *
 * ```js
 * var corner1 = L.latLng(40.712, -74.227),
 * corner2 = L.latLng(40.774, -74.125),
 * bounds = L.latLngBounds(corner1, corner2);
 * ```
 *
 * All Leaflet methods that accept LatLngBounds objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * map.fitBounds([
 * 	[40.712, -74.227],
 * 	[40.774, -74.125]
 * ]);
 * ```
 *
 * Caution: if the area crosses the antimeridian (often confused with the International Date Line), you must specify corners _outside_ the [-180, 180] degrees longitude range.
 *
 * Note that `LatLngBounds` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 * 
 * TODO International date line?
 */
export class LatLngBounds {

	_southWest!: LatLng; // assigned by extend() call in constructor
	_northEast!: LatLng; // assigned by extend() call in constructor

	constructor(...latlngs: readonly LatLng[]) {
		// TODO: need to enforce that enough points are passed, preferably without guarding here
		for (let i = 0, len = latlngs.length; i < len; i++) {
			this.extend(latlngs[i]);
		}
	}

	// Extend the bounds to contain the given bounds or point
	extend(obj: LatLng | LatLngBounds | undefined): this {
		const
			sw = this._southWest,
		    ne = this._northEast;

		let sw2, ne2;

		if (obj instanceof LatLng) {
			sw2 = obj;
			ne2 = obj;
		} else if (obj instanceof LatLngBounds) {
			sw2 = obj._southWest;
			ne2 = obj._northEast;

			// TODO: safe to remove this check?
			if (!sw2 || !ne2) { return this; }
		} else {
			// TODO: safe to remove this branch and disallow passing undefined as parameter?
			return this;
		}

		if (!sw || !ne) {
			this._southWest = new LatLng(sw2.lat, sw2.lng);
			this._northEast = new LatLng(ne2.lat, ne2.lng);
		} else {
			sw.lat = Math.min(sw2.lat, sw.lat);
			sw.lng = Math.min(sw2.lng, sw.lng);
			ne.lat = Math.max(ne2.lat, ne.lat);
			ne.lng = Math.max(ne2.lng, ne.lng);
		}

		return this;
	}

	// Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
	// For example, a ratio of 0.5 extends the bounds by 50% in each direction.
	// Negative values will retract the bounds.
	pad(bufferRatio: number): LatLngBounds {
		const
			sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new LatLngBounds(
			new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
			new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer),
		);
	}

	// Returns the center point of the bounds.
	getCenter(): LatLng {
		return new LatLng(
			(this._southWest.lat + this._northEast.lat) / 2,
			(this._southWest.lng + this._northEast.lng) / 2,
		);
	}

	// Returns the south-west point of the bounds.
	getSouthWest(): LatLng {
		return this._southWest;
	}

	// Returns the north-east point of the bounds.
	getNorthEast(): LatLng {
		return this._northEast;
	}

	// Returns the north-west point of the bounds.
	getNorthWest(): LatLng {
		return new LatLng(this.getNorth(), this.getWest());
	}

	// Returns the south-east point of the bounds.
	getSouthEast(): LatLng {
		return new LatLng(this.getSouth(), this.getEast());
	}

	// Returns the west longitude of the bounds
	getWest(): number {
		return this._southWest.lng;
	}

	// Returns the south latitude of the bounds
	getSouth(): number {
		return this._southWest.lat;
	}

	// Returns the east longitude of the bounds
	getEast(): number {
		return this._northEast.lng;
	}

	// Returns the north latitude of the bounds
	getNorth(): number {
		return this._northEast.lat;
	}

	// Returns true if these bounds contain the given point or bounds.
	contains(obj: LatLng | LatLngBounds): boolean {
		const
			sw = this._southWest,
			ne = this._northEast;

		let sw2, ne2;

		if (obj instanceof LatLngBounds) {
			sw2 = obj._southWest;
			ne2 = obj._northEast;
		} else {
			sw2 = ne2 = obj;
		}

		return (
			(sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
			(sw2.lng >= sw.lng) && (ne2.lng <= ne.lng)
		);
	}

	// Returns `true` if the rectangle intersects the given bounds. Two bounds intersect if they have at least one point in common.
	intersects(otherBounds: LatLngBounds): boolean {
		const
			sw = this._southWest,
		    ne = this._northEast,
		    sw2 = otherBounds.getSouthWest(),
		    ne2 = otherBounds.getNorthEast(),
		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	}

	// Returns `true` if the rectangle overlaps the given bounds. Two bounds overlap if their intersection is an area.
	overlaps(bounds: LatLngBounds): boolean {
		const
			sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),
		    latOverlaps = (ne2.lat > sw.lat) && (sw2.lat < ne.lat),
		    lngOverlaps = (ne2.lng > sw.lng) && (sw2.lng < ne.lng);

		return latOverlaps && lngOverlaps;
	}

	// Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format. Useful for sending requests to web services that return geo data.
	toBBoxString(): string {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	}

	// Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
	equals(otherBounds: LatLngBounds, maxMargin?: number): boolean {
		// TODO: safe to remove this check?
		if (!otherBounds) { return false; }

		return (
			this._southWest.equals(otherBounds._southWest, maxMargin) &&
			this._northEast.equals(otherBounds._northEast, maxMargin)
		);
	}

	// Returns `true` if the bounds are properly initialized.
	/** @deprecated Bounds should never be constructed with an "invalid" state-makes no sense */
	isValid(): boolean {
		return !!(this._southWest && this._northEast);
	}

}
