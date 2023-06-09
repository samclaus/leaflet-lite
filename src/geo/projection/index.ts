import type { Bounds, Point } from '../../Leaflet.js';
import type { LatLng } from '../LatLng.js';
export { LonLat } from './Projection.LonLat.js';
export { Mercator } from './Projection.Mercator.js';
export { SphericalMercator } from './Projection.SphericalMercator.js';

/**
 * An object with methods for projecting geographical coordinates of the world onto
 * a flat surface (and back). See [Map projection](https://en.wikipedia.org/wiki/Map_projection).

 * Note that the projection instances do not inherit from Leaflet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.
 */
export interface Projection {
    /**
     * The bounds (specified in CRS units) where the projection is valid.
     */
    bounds: Bounds;
    /**
     * Projects geographical coordinates into a 2D point.
     */
    project(latlng: LatLng): Point;
    /**
     * The inverse of `project`. Projects a 2D point into a geographical location.
     */
    unproject(point: Point): LatLng
}