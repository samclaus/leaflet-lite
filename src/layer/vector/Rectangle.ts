import type { LatLng, LatLngBounds } from '../../Leaflet.js';
import { Polygon } from './Polygon.js';

function boundsToLatLngs(latLngBounds: LatLngBounds): LatLng[] {
	return [
		latLngBounds.getSouthWest(),
		latLngBounds.getNorthWest(),
		latLngBounds.getNorthEast(),
		latLngBounds.getSouthEast(),
	];
}

/**
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 *
 * ```js
 * // define rectangle geographical bounds
 * var bounds = [[54.559322, -5.767822], [56.1210604, -3.021240]];
 *
 * // create an orange rectangle
 * L.rectangle(bounds, {color: '#ff7800', weight: 1}).addTo(map);
 *
 * // zoom the map to the rectangle bounds
 * map.fitBounds(bounds);
 * ```
 */
export class Rectangle extends Polygon {

	constructor(latLngBounds: LatLngBounds, options) {
		super(boundsToLatLngs(latLngBounds), options);
	}

	// Redraws the rectangle with the passed bounds.
	setBounds(latLngBounds: LatLngBounds): this {
		return this.setLatLngs(boundsToLatLngs(latLngBounds));
	}

}
