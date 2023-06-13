
import { LatLng, LatLngBounds } from '..';
import { Util } from '../../core';
import { Bounds, type Point, type Transformation } from '../../geometry';
import { type Projection } from '../projection';

interface HasProjection {
	projection: Projection;
}

interface CRSLike extends HasProjection {
	transformation: Transformation;
	infinite?: boolean;

	scale(zoom: number): number;
}

interface HasWrappingProperties {
	/**
	 * An array of two numbers defining whether the longitude (horizontal) coordinate
	 * axis wraps around a given range and how. Defaults to `[-180, 180]` in most
	 * geographical CRSs. If `undefined`, the longitude axis does not wrap around.
	 */
	wrapLng?: readonly [number, number];
	/**
	 * Like `wrapLng`, but for the latitude (vertical) axis.
	 */
	wrapLat?: readonly [number, number];
}

interface CanWrapLatLng {
	/**
	 * Returns a `LatLng` where lat and lng has been wrapped according to the
	 * CRS's `wrapLat` and `wrapLng` properties, if they are outside the CRS's bounds.
	 */
	wrapLatLng(latlng: LatLng): LatLng;
}

/**
 * Object that defines coordinate reference systems for projecting
 * geographical points into pixel (screen) coordinates and back (and to
 * coordinates in other units for [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services). See
 * [spatial reference system](https://en.wikipedia.org/wiki/Spatial_reference_system).
 *
 * Leaflet defines the most usual CRSs by default. If you want to use a
 * CRS not defined by default, take a look at the
 * [Proj4Leaflet](https://github.com/kartena/Proj4Leaflet) plugin.
 *
 * Note that the CRS instances do not inherit from Leaflet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.
 */
export interface CRS extends HasWrappingProperties, CanWrapLatLng {
	/**
	 * If true, the coordinate space will be unbounded (infinite in both axes).
	 */
	readonly infinite: boolean;
	/**
	 * Standard code name of the CRS passed into WMS services (e.g. `'EPSG:3857'`)
	 */
	readonly code: string;

	/**
	 * Projects geographical coordinates into pixel coordinates for a given zoom.
	 */
	latLngToPoint(latlng: LatLng, zoom: number): Point;
	
	/**
	 * The inverse of `latLngToPoint`. Projects pixel coordinates on a given
	 * zoom into geographical coordinates.
	 */
	pointToLatLng(point: Point, zoom: number): LatLng;
	
	/**
	 * Projects geographical coordinates into coordinates in units accepted for
	 * this CRS (e.g. meters for EPSG:3857, for passing it to WMS services).
	 */
	project(latlng: LatLng): Point;

	/**
	 * Given a projected coordinate returns the corresponding LatLng. The inverse of `project`.
	 */
	unproject(point: Point): LatLng;
	
	/**
	 * Returns the scale used when transforming projected coordinates into
	 * pixel coordinates for a particular zoom. For example, it returns
	 * `256 * 2^zoom` for Mercator-based CRS.
	 */
	scale(zoom: number): number;

	/**
	 * Inverse of `scale()`, returns the zoom level corresponding to a scale factor of `scale`.
	 */
	zoom(scale: number): number;

	/**
	 * Returns the projection's bounds scaled and transformed for the provided `zoom`.
	 */
	getProjectedBounds(zoom: number): Bounds | undefined;

	/**
	 * Returns the distance between two geographical coordinates.
	 */
	distance(latlng1: LatLng, latlng2: LatLng): number;
	
	/**
	 * Returns a `LatLngBounds` with the same size as the given one, ensuring
	 * that its center is within the CRS's bounds.
	 */
	wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds;
}

/**
 * Most of the CRSs provided by Leaflet share the majority of their implementation. This
 * object provides most of the method implementations, with TypeScript making sure the final
 * CRSs implement the remaining functionality required for these base methods to work.
 */
export const CRS_BASE = {

	infinite: false,

	latLngToPoint(this: CRSLike, latlng: LatLng, zoom: number): Point {
		const
			projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	pointToLatLng(this: CRSLike, point: Point, zoom: number): LatLng {
		const
			scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	project(this: HasProjection, latlng: LatLng): Point {
		return this.projection.project(latlng);
	},

	unproject(this: HasProjection, point: Point): LatLng {
		return this.projection.unproject(point);
	},

	scale(zoom: number): number {
		return 256 * Math.pow(2, zoom);
	},

	zoom(scale: number): number {
		return Math.log(scale / 256) / Math.LN2;
	},

	getProjectedBounds(this: CRSLike, zoom: number): Bounds | undefined {
		if (this.infinite) { return; }

		const
			b = this.projection.bounds,
		    s = this.scale(zoom),
		    min = this.transformation.transform(b.min, s),
		    max = this.transformation.transform(b.max, s);

		return new Bounds(min, max);
	},

	wrapLatLng(this: HasWrappingProperties, latlng: LatLng): LatLng {
		const
			lng = this.wrapLng ? Util.wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
		    lat = this.wrapLat ? Util.wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat,
		    alt = latlng.alt;

		return new LatLng(lat, lng, alt);
	},

	wrapLatLngBounds(this: CanWrapLatLng, bounds: LatLngBounds): LatLngBounds {
		const
			center = bounds.getCenter(),
		    newCenter = this.wrapLatLng(center),
		    latShift = center.lat - newCenter.lat,
		    lngShift = center.lng - newCenter.lng;

		if (latShift === 0 && lngShift === 0) {
			return bounds;
		}

		const
			sw = bounds.getSouthWest(),
		    ne = bounds.getNorthEast(),
		    newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift),
		    newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);

		return new LatLngBounds(newSw, newNe);
	},

} as const;
