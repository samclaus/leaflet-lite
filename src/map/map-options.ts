import type { LatLng } from "../geog";
import type { CRS } from "../geog/crs";

export type ZoomOptions = any;

export type PanOptions = any;
// {
// 	// TODO

// 	noMoveStart?: boolean;
// 	animate?: boolean;
// 	duration?: number;
// 	easeLinearity?: number;
// }

export type ZoomPanOptions = any
// {
// 	zoom?: ZoomOptions | undefined;
// 	pan?: boolean;
// 	animate?: boolean | undefined;
// 	debounceMoveend?: boolean;
// 	reset?: boolean;
// }

export type FitBoundsOptions = any;
// {
// 	padding?: Point;
// 	paddingTopLeft?: Point;
// 	paddingBottomRight?: Point;
// 	maxZoom?: number;
// }

export type ZoomAnimationEvent = any;
// {
// 	center: LatLng,
// 	zoom: number,
// 	noUpdate: boolean | undefined;
// }

export interface MapOptions {
    /**
     * The [Coordinate Reference System](#crs) to use. Don't change this if you're not
     * sure what it means. EPSG3857 (Spherical Mercator projection) by default.
     */
    crs: CRS;
    /**
     * Initial geographic center of the map.
     */
    center: LatLng | undefined;
    /**
     * Initial map zoom level.
     */
    zoom: number | undefined;
    /**
     * Minimum zoom level of the map. 0 by default.
     */
    minZoom: number;
    /**
     * Maximum zoom level of the map. Infinity by default.
     */
    maxZoom: number;
    /**
     * Array of layers that will be added to the map initially.
     */
    layers: Layer[];
    /**
     * Handlers that should be added to the map initially.
     */
    handlers: Dict<Constructor<Handler>>;
    /**
     * When this option is set, the map restricts the view to the given
     * geographical bounds, bouncing the user back if the user tries to pan
     * outside the view. To set the restriction dynamically, use
     * [`setMaxBounds`](#map-setmaxbounds) method.
     */
    maxBounds: LatLngBounds | undefined;
    /**
     * The default method for drawing vector layers on the map. `L.SVG`
     * or `L.Canvas` by default depending on browser support.
     */
    renderer: Renderer;
    /**
     * The map will not animate a zoom operation if the zoom delta is greater
     * than this value. Set to 0 to disable zoom animations entirely. 4 by
     * default.
     */
    zoomAnimationThreshold: number;
    /**
     * Whether the tile fade animation is enabled. Enabled (true) by default.
     */
    fadeAnimation: boolean;
    /**
     * Whether markers animate their zoom with the zoom animation, if disabled
     * they will disappear for the length of the animation. Enabled (true) by
     * default.
     */
    markerZoomAnimation: boolean;
    /**
     * Defines the maximum size of a CSS translation transform. The default
     * value, which is the maximum integer a 32-bit float can hold (2^23),
     * should not be changed unless a web browser positions layers in the
     * wrong place after doing a large `panBy`.
     */
    transform3DLimit: number; // Precision limit of a 32-bit float
    /**
     * Forces the map's zoom level to always be a multiple of this, particularly
     * right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
     * By default, the zoom level snaps to the nearest integer; lower values
     * (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
     * means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
     * 1 by default.
     */
    zoomSnap: number;
    /**
     * Centralized/federated preference for the amount the map should zoom in/out by
     * when interacted with by the user. Zoom +/- buttons and keyboard controls
     * should use this value, but the map itself does not use it internally in order
     * to keep the API surface small and straightforward.
     */
    zoomDelta: number;
    /**
     * Whether `Path`s should be rendered on a `Canvas` renderer.
     * By default (false), all `Path`s are rendered in a `SVG` renderer.
     */
    preferCanvas: boolean;
}
