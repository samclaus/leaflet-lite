import { LatLng, LatLngBounds } from "../geog";
import type { Map } from "../map";

/**
 * Takes coordinates from the browser-standard
 * [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
 * and computes a nice zoom level for the map according to the accuracy of the
 * geolocation coordinates.
 * 
 * This is a pretty niche function and is mostly intended as an example that most
 * applications will probably just reimplement with different parameters.
 */
export function getCenterAndZoomForGeolocation(
    map: Map,
    coords: GeolocationCoordinates,
): [LatLng, number] {
    const
        center = new LatLng(coords.latitude, coords.longitude),
        bounds = LatLngBounds.fromCenter(center, coords.accuracy /* meters */ * 2);

    return [center, map.getBoundsZoom(bounds)];
}