import { LatLng, Point } from '../../Leaflet.js';
import { LatLngBounds } from '../../geo/LatLngBounds.js';
import { Earth } from '../../geo/crs/CRS.Earth.js';
import { CircleMarker, type CircleMarkerOptions } from './CircleMarker.js';
import { Path, type PathOptions } from './Path.js';

/**
 * A class for drawing circle overlays on a map. Extends `CircleMarker`.
 *
 * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion).
 *
 * ```js
 * L.circle([50.5, 30.5], {radius: 200}).addTo(map);
 * ```
 */
export class Circle extends CircleMarker {

	/** Radius of the circle in meters. */
	_mRadius: number;

	constructor(
		latlng: LatLng,
		options?: CircleMarkerOptions,
	) {
		super(latlng, options);

		if (isNaN(this.options.radius)) { throw new Error('Circle radius cannot be NaN'); }

		this._mRadius = this.options.radius;
	}

	// Sets the radius of a circle. Units are in meters.
	setRadius(radius: number): this {
		this._mRadius = radius;
		return this.redraw();
	}

	// Returns the current radius of a circle. Units are in meters.
	getRadius(): number {
		return this._mRadius;
	}

	// Returns the `LatLngBounds` of the path.
	getBounds(): LatLngBounds {
		const
			half = new Point(this._radius, this._radiusY || this._radius),
			map = this._map!, // TODO: null safety
			point = this._point!; // TODO: null safety

		return new LatLngBounds(
			map.layerPointToLatLng(point.subtract(half)),
			map.layerPointToLatLng(point.add(half)),
		);
	}

	setStyle(options: Partial<PathOptions>): this {
		Path.prototype.setStyle.call(this, options);
		return this;
	}

	_project(): void {
		const
			lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    map = this._map!, // TODO: null safety
		    crs = map.options.crs;

		if (crs.distance === Earth.distance) {
			const
				d = Math.PI / 180,
				latR = (this._mRadius / Earth.R) / d,
				top = map.project(new LatLng(lat + latR, lng)),
				bottom = map.project(new LatLng(lat - latR, lng)),
				p = top.add(bottom).divideBy(2),
				lat2 = map.unproject(p).lat;

			let lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			if (isNaN(lngR) || lngR === 0) {
				lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
			}

			this._point = p.subtract(map.getPixelOrigin()!); // TODO: null safety
			this._radius = isNaN(lngR) ? 0 : p.x - map.project(new LatLng(lat2, lng - lngR)).x;
			this._radiusY = p.y - top.y;

		} else {
			const latlng2 = crs.unproject(crs.project(this._latlng).subtract(new Point(this._mRadius, 0)));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._updateBounds();
	}

}
