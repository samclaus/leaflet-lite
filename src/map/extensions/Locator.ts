import { Evented } from "../../core";
import type { Map } from "..";
import { LatLng } from "../../geog";

export interface LocateOptions extends PositionOptions {
	watch?: boolean;
	setView?: boolean;
	maxZoom?: number;
}

export class Locator extends Evented {

	_locateOptions: LocateOptions | undefined;
	_locationWatchId = 0; // from navigator.geolocation.watchPosition()

    constructor(
        public _map: Map,
    ) {
        super();
    }
    
	// Tries to locate the user using the Geolocation API, firing a [`locationfound`](#map-locationfound)
	// event with location data on success or a [`locationerror`](#map-locationerror) event on failure,
	// and optionally sets the map view to the user's location with respect to
	// detection accuracy (or to the world view if geolocation failed).
	// Note that, if your page doesn't use HTTPS, this method will fail in
	// modern browsers ([Chrome 50 and newer](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins))
	// See `Locate options` for more details.
	locate(options?: LocateOptions): this {
		options = Object.assign<LocateOptions, LocateOptions | undefined>({
			timeout: 10000,
			watch: false,
			// setView: false
			// maxZoom: <Number>
			// maximumAge: 0
			// enableHighAccuracy: false
		}, options);
		
		this._locateOptions = options;

		if (!('geolocation' in navigator)) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.',
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			});
			return this;
		}

		const
			onResponse = this._handleGeolocationResponse.bind(this),
		    onError = this._handleGeolocationError.bind(this);

		if (options.watch) {
			this._locationWatchId = navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	}

	// Stops watching location previously initiated by `map.locate({watch: true})`
	// and aborts resetting the map view if map.locate was called with
	// `{setView: true}`.
	stopLocate(): this {
		if (navigator.geolocation && navigator.geolocation.clearWatch) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	}

	_handleGeolocationError(error: GeolocationPositionError): void {
        const map = this._map;

		if (!map._container._leaflet_id) { return; }

		const
            c = error.code,
		    message = error.message ||
                (c === 1 ? 'permission denied' :
                (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions?.setView && !map._loaded) {
			map.fitWorld();
		}

		// @section Location events
		// @event locationerror: ErrorEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method) failed.
		this.fire('locationerror', {
			code: c,
			message: `Geolocation error: ${message}.`
		});
	}

	_handleGeolocationResponse(pos: GeolocationPosition): void {
        const map = this._map;

		if (!map._container._leaflet_id) { return; }

		const
			lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy * 2),
		    options = this._locateOptions;

		if (options?.setView) {
			const zoom = map.getBoundsZoom(bounds);
			map.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
		}

		// @event locationfound: LocationEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method)
		// went successfully.
		this.fire('locationfound', {
			latlng,
			bounds,
			timestamp: pos.timestamp
		});
	}

}