import { Canvas, SVG, type Control, type Handler, type Layer, Renderer } from '../Leaflet.js';
import type { ControlPosition } from '../control/Control.js';
import Browser from '../core/Browser.js';
import { Evented, type HandlerFn } from '../core/Events.js';
import * as Util from '../core/Util.js';
import * as DomEvent from '../dom/DomEvent.js';
import * as DomUtil from '../dom/DomUtil.js';
import { PosAnimation } from '../dom/PosAnimation.js';
import { LatLng } from '../geo/LatLng.js';
import { LatLngBounds } from '../geo/LatLngBounds.js';
import { EPSG3857 } from '../geo/crs/CRS.EPSG3857.js';
import { Bounds } from '../geometry/Bounds.js';
import { Point } from '../geometry/Point.js';

export interface LocateOptions extends PositionOptions {
	watch?: boolean;
	setView?: boolean;
	maxZoom?: number;
}

export interface ZoomOptions {

}

export interface PanOptions {
	// TODO

	noMoveStart?: boolean;
	animate?: boolean;
	duration?: number;
	easeLinearity?: number;
}

export interface ZoomPanOptions {
	zoom?: ZoomOptions | undefined;
	pan?: boolean;
	animate?: boolean | undefined;
	debounceMoveend?: boolean;
}

export interface FitBoundsOptions {
	padding?: Point;
	paddingTopLeft?: Point;
	paddingBottomRight?: Point;
	maxZoom?: number;
}

export interface ZoomAnimationEvent {
	center: LatLng,
	zoom: number,
	noUpdate: boolean | undefined;
}

/**
 * The central class of the API — it is used to create a map on a page and manipulate it.
 *
 * ```js
 * // initialize the map on the "map" div with a given center and zoom
 * var map = L.map('map', {
 * 	center: [51.505, -0.09],
 * 	zoom: 13
 * });
 * ```
 */
export class Map extends Evented {

	// TODO: these are the static/default options which get overridden
	// for each instance by passing options to the constructor
	options = {
		// @section Map State Options
		// @option crs: CRS = L.CRS.EPSG3857
		// The [Coordinate Reference System](#crs) to use. Don't change this if you're not
		// sure what it means.
		crs: EPSG3857,

		// @option center: LatLng = undefined
		// Initial geographic center of the map
		center: undefined,

		// @option zoom: Number = undefined
		// Initial map zoom level
		zoom: undefined,

		// @option minZoom: Number = *
		// Minimum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the lowest of their `minZoom` options will be used instead.
		minZoom: undefined,

		// @option maxZoom: Number = *
		// Maximum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the highest of their `maxZoom` options will be used instead.
		maxZoom: undefined as (number | undefined),

		// @option layers: Layer[] = []
		// Array of layers that will be added to the map initially
		layers: [],

		// @option maxBounds: LatLngBounds = undefined
		// When this option is set, the map restricts the view to the given
		// geographical bounds, bouncing the user back if the user tries to pan
		// outside the view. To set the restriction dynamically, use
		// [`setMaxBounds`](#map-setmaxbounds) method.
		maxBounds: undefined,

		// @option renderer: Renderer = *
		// The default method for drawing vector layers on the map. `L.SVG`
		// or `L.Canvas` by default depending on browser support.
		renderer: undefined,


		// @section Animation Options
		// @option zoomAnimation: Boolean = true
		// Whether the map zoom animation is enabled. By default it's enabled
		// in all browsers that support CSS Transitions except Android.
		zoomAnimation: true,

		// @option zoomAnimationThreshold: Number = 4
		// Won't animate zoom if the zoom difference exceeds this value.
		zoomAnimationThreshold: 4,

		// @option fadeAnimation: Boolean = true
		// Whether the tile fade animation is enabled. By default it's enabled
		// in all browsers that support CSS Transitions except Android.
		fadeAnimation: true,

		// @option markerZoomAnimation: Boolean = true
		// Whether markers animate their zoom with the zoom animation, if disabled
		// they will disappear for the length of the animation. By default it's
		// enabled in all browsers that support CSS Transitions except Android.
		markerZoomAnimation: true,

		// @option transform3DLimit: Number = 2^23
		// Defines the maximum size of a CSS translation transform. The default
		// value should not be changed unless a web browser positions layers in
		// the wrong place after doing a large `panBy`.
		transform3DLimit: 8388608, // Precision limit of a 32-bit float

		// @section Interaction Options
		// @option zoomSnap: Number = 1
		// Forces the map's zoom level to always be a multiple of this, particularly
		// right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
		// By default, the zoom level snaps to the nearest integer; lower values
		// (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
		// means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
		zoomSnap: 1,

		// @option zoomDelta: Number = 1
		// Controls how much the map's zoom level will change after a
		// [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
		// or `-` on the keyboard, or using the [zoom controls](#control-zoom).
		// Values smaller than `1` (e.g. `0.5`) allow for greater granularity.
		zoomDelta: 1,

		// @option trackResize: Boolean = true
		// Whether the map automatically handles browser window resize to update itself.
		trackResize: true,
	
		// @option keyboardPanDelta: Number = 80
		// Amount of pixels to pan when pressing an arrow key.
		keyboardPanDelta: 80,

		// @option doubleClickZoom: Boolean|String = true
		// Whether the map can be zoomed in by double clicking on it and
		// zoomed out by double clicking while holding shift. If passed
		// `'center'`, double-click zoom will zoom to the center of the
		//  view regardless of where the mouse was.
		doubleClickZoom: true,

		// @section Mouse wheel options
		// @option scrollWheelZoom: Boolean|String = true
		// Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
		// it will zoom to the center of the view regardless of where the mouse was.
		scrollWheelZoom: true,
	
		// @option wheelDebounceTime: Number = 40
		// Limits the rate at which a wheel can fire (in milliseconds). By default
		// user can't zoom via wheel more often than once per 40 ms.
		wheelDebounceTime: 40,
	
		// @option wheelPxPerZoomLevel: Number = 60
		// How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
		// mean a change of one full zoom level. Smaller values will make wheel-zooming
		// faster (and vice versa).
		wheelPxPerZoomLevel: 60,
		
		// @option boxZoom: Boolean = true
		// Whether the map can be zoomed to a rectangular area specified by
		// dragging the mouse while pressing the shift key.
		boxZoom: true,
	
		// @section Touch interaction options
		// @option tapHold: Boolean
		// Enables simulation of `contextmenu` event, default is `true` for mobile Safari.
		tapHold: Browser.touchNative && Browser.safari && Browser.mobile,
	
		// @option tapTolerance: Number = 15
		// The max number of pixels a user can shift his finger during touch
		// for it to be considered a valid tap.
		tapTolerance: 15,
	};

	_handlers: Handler[] = [];
	_targets: { [leafletID: string]: Evented } = {};
	_layers: { [leafletID: string]: Layer } = {};
	_zoomBoundLayers: { [leafletID: string]: Layer } = {};
	_layersMaxZoom: number | undefined;
	_layersMinZoom: number | undefined;
	_container!: HTMLElement; // TODO: null safety?
	_containerId: number | undefined;
	_proxy: HTMLElement | undefined; // animation proxy element
	_size: Point | undefined;
	_sizeChanged = true;
	_zoom!: number; // TODO: null safety?
	_zoomAnimated: boolean;
	_panAnim: PosAnimation | undefined;
	_mapPane: HTMLElement | undefined;
	_panes: { [name: string]: HTMLElement } = {};
	_lastCenter: LatLng | undefined;
	_loaded = false;
	_enforcingBounds = false;
	_resizeRequest = 0; // requestAnimationFrame handle
	_flyToFrame = 0; // requestAnimationFrame handle
	_tempFireZoomEvent = false;
	_resizeObserver = new ResizeObserver(this._onResize.bind(this));
	_locateOptions: LocateOptions | undefined;
	_locationWatchId = 0; // from navigator.geolocation.watchPosition()
	_sizeTimer: number | undefined;
	_pixelOrigin: Point | undefined;

	_animatingZoom = false;
	_animateToCenter: LatLng | undefined;
	_animateToZoom = 0;

	_controlContainer: HTMLElement | undefined;
	_controlCorners: { readonly [Pos in ControlPosition]: HTMLElement } | undefined;

	constructor(
		id: string | HTMLElement,
		options: any, // TODO
	) {
		super();

		options = Util.setOptions(this, options);

		this._initContainer(id);
		this._initLayout();
		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(options.center, options.zoom, { reset: true });
		}

		// TODO: NEED TO ALLOW PASSING HANDLERS VIA OPTIONS, WHICH WILL BE TREE-SHAKING-FRIENDLY,
		// RATHER THAN BUNDLING ALL OF THE HANDLERS (BOX ZOOM, ETC) EVERY TIME AND HAVING THEM
		// ADD JANKY INIT HOOKS TO MAP CLASS (used to have a call to this.callInitHooks() here);
		// TO REPRODUCE EXISTING PREVIOUS AUTOMATIC BEHAVIOR, PASS:
		//
		//	handlers: {
		// 		boxZoom: BoxZoom,
		// 		doubleClickZoom: DoubleClickZoom,
		// 		dragging: Drag,
		// 		keyboard: Keyboard,
		// 		scrollWheelZoom: ScrollWheelZoom,
		// 		tapHold: TapHold,
		// 		touchZoom: TouchZoom,
		//	}
		//
		for (const [name, HandlerClass] of options.handlers) {
			const handler = this[name] = new HandlerClass(this);
			this._handlers.push(handler);
			handler.enable();
		}

		// TODO: NEED TO ALLOW PASSING CONTROLS VIA OPTIONS, WHICH WILL BE TREE SHAKING FRIENDLY
		// (Zoom and Attribution used to register themselves automatically by default using init
		// hooks); TO REPRODUCE PREVIOUS AUTOMATIC BEHAVIOR, PASS:
		//
		// 	controls: [
		//		new Attribution(),
		//		new Zoom(),
		// 	]
		//
		for (const control of options.controls) {
			control.addTo(this);
		}

		// don't animate on browsers without hardware-accelerated transitions or old Android
		this._zoomAnimated = this.options.zoomAnimation;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {
			this._createAnimProxy();
			DomEvent.on(this._proxy, 'transitionend', this._catchTransitionEnd, this);
		}

		for (const layer of this.options.layers) {
			this.addLayer(layer);
		}
	}


	// @section Methods for modifying map state

	// Sets the view of the map (geographical center and zoom) with the given
	// animation options.
	setView(center: LatLng, zoom?: number, options: ZoomPanOptions = {}): this {
		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(center, zoom, this.options.maxBounds);
		options = options || {};

		this._stop();

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = Util.extend({animate: options.animate}, options.zoom);
				options.pan = Util.extend({animate: options.animate, duration: options.duration}, options.pan);
			}

			// try animating pan or zoom
			const moved = (this._zoom !== zoom) ?
				this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (moved) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom, options.pan?.noMoveStart);

		return this;
	}

	// Sets the zoom of the map.
	setZoom(zoom: number, options?: ZoomOptions): this {
		if (!this._loaded) {
			this._zoom = zoom;
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	}

	// Increases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomIn(delta = this.options.zoomDelta, options?: ZoomOptions): this {
		return this.setZoom(this._zoom + delta, options);
	}

	// Decreases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomOut(delta = this.options.zoomDelta, options?: ZoomOptions): this {
		return this.setZoom(this._zoom - delta, options);
	}

	// Zooms the map while keeping a specified geographical point OR pixel (relative to the
	// top-left corner) on the map stationary (e.g. used internally for scroll zoom and
	// double-click zoom).
	setZoomAround(latlngOrOffset: LatLng | Point, zoom: number, options?: ZoomOptions): this {
		const
			scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlngOrOffset instanceof Point ?
				latlngOrOffset :
				this.latLngToContainerPoint(latlngOrOffset),
		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	}

	_getBoundsCenterZoom(bounds: LatLngBounds, options: FitBoundsOptions = {}) {
		const
			paddingTL = options.paddingTopLeft || options.padding || new Point(0, 0),
			paddingBR = options.paddingBottomRight || options.padding || new Point(0, 0);

		let zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;

		if (zoom === Infinity) {
			return {
				center: bounds.getCenter(),
				zoom
			};
		}

		const
			paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),
		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return { center, zoom };
	}

	// Sets a map view that contains the given geographical bounds with the
	// maximum zoom level possible.
	fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): this {
		if (!bounds.isValid()) {
			// TODO: remove this?
			throw new Error('Bounds are not valid.');
		}

		const target = this._getBoundsCenterZoom(bounds, options);
		return this.setView(target.center, target.zoom, options);
	}

	// Sets a map view that mostly contains the whole world with the maximum
	// zoom level possible.
	fitWorld(options?: FitBoundsOptions): this {
		return this.fitBounds(
			// TODO: just make a worldBounds() function? I think these bounds are created
			// in several places
			new LatLngBounds(
				new LatLng(-90, -180),
				new LatLng(90, 180),
			),
			options,
		);
	}

	// Pans the map to a given center.
	panTo(center: LatLng, options?: PanOptions): this {
		return this.setView(center, this._zoom, {pan: options});
	}

	// Pans the map by a given number of pixels (animated).
	panBy(offset: Point, options: PanOptions = {}): this {
		offset = offset.round();

		if (!offset.x && !offset.y) {
			return this.fire('moveend');
		}

		// If we pan too far, Chrome gets issues with tiles
		// and makes them disappear or appear in the wrong place (slightly offset) #2602
		if (options.animate !== true && !this.getSize().contains(offset)) {
			this._resetView(
				this.unproject(this.project(this.getCenter()).add(offset)),
				this._zoom,
			);
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new PosAnimation();
			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			// TODO: null safety for map pane?
			this._mapPane!.classList.add('leaflet-pan-anim');

			const newPos = this._getMapPanePos().subtract(offset).round();
			// TODO: null safety for map pane?
			this._panAnim.run(this._mapPane!, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	}

	// @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
	// Sets the view of the map (geographical center and zoom) performing a smooth
	// pan-zoom animation.
	flyTo(targetCenter: LatLng, targetZoom?: number, options: any = {}): this {
		if (options.animate === false) {
			return this.setView(targetCenter, targetZoom, options);
		}

		this._stop();

		const from = this.project(this.getCenter()),
		    to = this.project(targetCenter),
		    size = this.getSize(),
		    startZoom = this._zoom;

		targetZoom ??= startZoom;

		const w0 = Math.max(size.x, size.y),
		    w1 = w0 * this.getZoomScale(startZoom, targetZoom),
		    u1 = (to.distanceTo(from)) || 1,
		    rho = 1.42,
		    rho2 = rho * rho;

		function r(i: number): number {
			const s1 = i ? -1 : 1,
			    s2 = i ? w1 : w0,
			    t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
			    b1 = 2 * s2 * rho2 * u1,
			    b = t1 / b1,
			    sq = Math.sqrt(b * b + 1) - b;

			// workaround for floating point precision bug when sq = 0, log = -Infinite,
			// thus triggering an infinite loop in flyTo
			const log = sq < 0.000000001 ? -18 : Math.log(sq);

			return log;
		}

		function sinh(n: number) { return (Math.exp(n) - Math.exp(-n)) / 2; }
		function cosh(n: number) { return (Math.exp(n) + Math.exp(-n)) / 2; }
		function tanh(n: number) { return sinh(n) / cosh(n); }

		const r0 = r(0);

		function w(s: number) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
		function u(s: number) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

		function easeOut(t: number) { return 1 - Math.pow(1 - t, 1.5); }

		const start = Date.now(),
		    S = (r(1) - r0) / rho,
		    duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

		function frame(this: Map): void {
			const t = (Date.now() - start) / duration,
			    s = easeOut(t) * S;

			if (t <= 1) {
				this._flyToFrame = requestAnimationFrame(frame.bind(this));

				this._move(
					this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
					this.getScaleZoom(w0 / w(s), startZoom),
					{flyTo: true},
				);

			} else {
				this
					._move(targetCenter, targetZoom)
					._moveEnd(true);
			}
		}

		this._moveStart(true, options.noMoveStart);

		frame.call(this);
		return this;
	}

	// Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
	// but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
	flyToBounds(bounds: LatLngBounds, options?: FitBoundsOptions): this {
		const target = this._getBoundsCenterZoom(bounds, options);
		return this.flyTo(target.center, target.zoom, options);
	}

	// Restricts the map view to the given bounds (see the [maxBounds](#map-maxbounds) option).
	setMaxBounds(bounds: LatLngBounds): this {
		if (this.listens('moveend', this._panInsideMaxBounds)) {
			this.off('moveend', this._panInsideMaxBounds);
		}

		if (!bounds.isValid()) {
			this.options.maxBounds = undefined;
			return this;
		}

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds);
	}

	// Sets the lower limit for the available zoom levels (see the [minZoom](#map-minzoom) option).
	setMinZoom(minZoom: number): this {
		if (this._loaded && minZoom !== this.options.minZoom) {
			this.options.minZoom = minZoom;
			this.fire('zoomlevelschange');

			if (this._zoom < minZoom) {
				this.setZoom(minZoom);
			}
		}

		return this;
	}

	// Sets the upper limit for the available zoom levels (see the [maxZoom](#map-maxzoom) option).
	setMaxZoom(maxZoom: number): this {
		if (this._loaded && maxZoom !== this.options.maxZoom) {
			this.options.maxZoom = maxZoom;
			this.fire('zoomlevelschange');

			if (this._zoom > maxZoom) {
				this.setZoom(maxZoom);
			}
		}

		return this;
	}

	// Pans the map to the closest view that would lie inside the given bounds (if
	// it's not already), controlling the animation using the options specific, if any.
	panInsideBounds(bounds: LatLngBounds, options?: PanOptions): this {
		this._enforcingBounds = true;

		const
			center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, bounds);

		if (!center.equals(newCenter)) {
			this.panTo(newCenter, options);
		}

		this._enforcingBounds = false;

		return this;
	}

	// Pans the map the minimum amount to make the `latlng` visible. Use
	// padding options to fit the display to more restricted bounds.
	// If `latlng` is already within the (optionally padded) display bounds,
	// the map will not be panned.
	panInside(latlng: LatLng, options: FitBoundsOptions & PanOptions = {}): this {
		const
			paddingTL = options.paddingTopLeft || options.padding || new Point(0, 0),
		    paddingBR = options.paddingBottomRight || options.padding || new Point(0, 0),
		    pixelCenter = this.project(this.getCenter()),
		    pixelPoint = this.project(latlng),
		    pixelBounds = this.getPixelBounds(),
		    paddedBounds = new Bounds(pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)),
		    paddedSize = paddedBounds.getSize();

		if (!paddedBounds.contains(pixelPoint)) {
			this._enforcingBounds = true;
			const centerOffset = pixelPoint.subtract(paddedBounds.getCenter());
			const offset = paddedBounds.extend(pixelPoint).getSize().subtract(paddedSize);
			pixelCenter.x += centerOffset.x < 0 ? -offset.x : offset.x;
			pixelCenter.y += centerOffset.y < 0 ? -offset.y : offset.y;
			this.panTo(this.unproject(pixelCenter), options);
			this._enforcingBounds = false;
		}

		return this;
	}

	// @method invalidateSize(options: Zoom/pan options): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default. If `options.pan` is `false`, panning will not occur.
	// If `options.debounceMoveend` is `true`, it will delay `moveend` event so
	// that it doesn't happen often even if the method is called many
	// times in a row.

	// @alternative
	// @method invalidateSize(animate: Boolean): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default.
	invalidateSize(options: ZoomPanOptions | boolean): this {
		if (!this._loaded) { return this; }

		options = Object.assign<ZoomPanOptions, ZoomPanOptions>({
			animate: false,
			pan: true
		}, typeof options === "boolean" ? { animate: options } : options);

		const oldSize = this.getSize();

		this._sizeChanged = true;
		this._lastCenter = undefined;

		const newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(this.fire.bind(this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		// @section Map state change events
		// @event resize: ResizeEvent
		// Fired when the map is resized.
		return this.fire('resize', {
			oldSize,
			newSize
		});
	}

	// @section Methods for modifying map state

	// Stops the currently running `panTo` or `flyTo` animation, if any.
	stop(): this {
		this.setZoom(this._limitZoom(this._zoom));
		if (!this.options.zoomSnap) {
			this.fire('viewreset');
		}
		return this._stop();
	}

	// @section Geolocation methods
	// @method locate(options?: Locate options): this
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

	// @method stopLocate(): this
	// Stops watching location previously initiated by `map.locate({watch: true})`
	// and aborts resetting the map view if map.locate was called with
	// `{setView: true}`.
	stopLocate() {
		if (navigator.geolocation && navigator.geolocation.clearWatch) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	}

	_handleGeolocationError(error: GeolocationPositionError): void {
		if (!this._container._leaflet_id) { return; }

		const c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions?.setView && !this._loaded) {
			this.fitWorld();
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
		if (!this._container._leaflet_id) { return; }

		const
			lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy * 2),
		    options = this._locateOptions;

		if (options?.setView) {
			const zoom = this.getBoundsZoom(bounds);
			this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
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

	// Destroys the map and clears all related event listeners.
	remove(): this {
		this._initEvents(true);

		if (this.options.maxBounds) { this.off('moveend', this._panInsideMaxBounds); }

		if (this._containerId !== this._container._leaflet_id) {
			throw new Error('Map container is being reused by another instance');
		}

		this._containerId = undefined;

		try {
			// throws error in IE6-8
			delete this._container._leaflet_id;
		} catch (e) {
			this._container._leaflet_id = undefined;
		}

		if (this._locationWatchId !== undefined) {
			this.stopLocate();
		}

		this._stop();

		this._mapPane!.remove(); // TODO: null safety?

		if (this._clearControlPos) {
			this._clearControlPos();
		}
		if (this._resizeRequest) {
			cancelAnimationFrame(this._resizeRequest);
			this._resizeRequest = 0;
		}

		for (let i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}

		if (this._loaded) {
			// @section Map state change events
			// @event unload: Event
			// Fired when the map is destroyed with [remove](#map-remove) method.
			this.fire('unload');
		}

		for (const layer of Object.values(this._layers)) {
			layer.remove();
		}

		for (const pane of Object.values(this._panes)) {
			pane.remove();
		}

		this._layers = [];
		this._panes = {};
		this._mapPane = undefined;
		this._renderer = undefined;

		return this;
	}

	// @section Other Methods

	// Creates a new [map pane](#map-pane) with the given name if it doesn't exist already,
	// then returns it. The pane is created as a child of `container`, or
	// as a child of the main map pane if not set.
	createPane(name: string, container?: HTMLElement): HTMLElement {
		const
			className = `leaflet-pane${name ? ` leaflet-${name.replace('Pane', '')}-pane` : ''}`,
		    pane = DomUtil.create('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}

		return pane;
	}

	// @section Methods for Getting Map State

	// Returns the geographical center of the map view
	getCenter(): LatLng {
		this._checkIfLoaded();

		if (this._lastCenter && !this._moved()) {
			return this._lastCenter.clone();
		}

		return this.layerPointToLatLng(this._getCenterLayerPoint());
	}

	// Returns the geographical bounds visible in the current map view
	getBounds(): LatLngBounds {
		const bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new LatLngBounds(sw, ne);
	}

	// Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
	getMinZoom(): number {
		return this.options.minZoom || this._layersMinZoom || 0;
	}

	// Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
	getMaxZoom(): number {
		return this.options.maxZoom ?? this._layersMaxZoom ?? Infinity;
	}

	// Returns the maximum zoom level on which the given bounds fit to the map
	// view in its entirety. If `inside` (optional) is set to `true`, the method
	// instead returns the minimum zoom level on which the map view fits into
	// the given bounds in its entirety.
	getBoundsZoom(
		bounds: LatLngBounds,
		inside?: boolean,
		padding = new Point(0, 0),
	): number {
		let zoom = this._zoom || 0; // TODO: this._zoom should always be defined, right?

		const
			min = this.getMinZoom(),
			max = this.getMaxZoom(),
			nw = bounds.getNorthWest(),
			se = bounds.getSouthEast(),
			size = this.getSize().subtract(padding),
			boundsSize = new Bounds(this.project(se, zoom), this.project(nw, zoom)).getSize(),
			snap = this.options.zoomSnap,
			scalex = size.x / boundsSize.x,
			scaley = size.y / boundsSize.y,
			scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);

		zoom = this.getScaleZoom(scale, zoom);

		if (snap) {
			zoom = Math.round(zoom / (snap / 100)) * (snap / 100); // don't jump if within 1% of a snap level
			zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
		}

		return Math.max(min, Math.min(max, zoom));
	}

	// Returns the current size of the map container (in pixels).
	getSize(): Point {
		if (!this._size || this._sizeChanged) {
			this._size = new Point(
				this._container.clientWidth || 0,
				this._container.clientHeight || 0,
			);
			this._sizeChanged = false;
		}
		return this._size.clone();
	}

	// Returns the bounds of the current map view in projected pixel
	// coordinates (sometimes useful in layer and overlay implementations).
	getPixelBounds(center?: LatLng, zoom?: number): Bounds {
		const topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	}

	// TODO: Check semantics - isn't the pixel origin the 0,0 coord relative to
	// the map pane? "left point of the map layer" can be confusing, specially
	// since there can be negative offsets.
	// Returns the projected pixel coordinates of the top left point of
	// the map layer (useful in custom layer and overlay implementations).
	getPixelOrigin(): Point | undefined {
		this._checkIfLoaded();
		return this._pixelOrigin;
	}

	// Returns the world's bounds in pixel coordinates for zoom level `zoom`.
	// If `zoom` is omitted, the map's current zoom level is used.
	getPixelWorldBounds(zoom = this._zoom): Bounds | undefined {
		return this.options.crs.getProjectedBounds(zoom);
	}

	// @section Other Methods

	// Returns a [map pane](#map-pane), given its name or its HTML element (its identity).
	getPane(pane: string | HTMLElement): HTMLElement | undefined {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	}

	// @method getPanes(): Object
	// Returns a plain object containing the names of all [panes](#map-pane) as keys and
	// the panes as values.
	getPanes() {
		return this._panes;
	}

	// @method getContainer: HTMLElement
	// Returns the HTML element that contains the map.
	getContainer() {
		return this._container;
	}

	// @section Conversion Methods

	// Returns the scale factor to be applied to a map transition from zoom level
	// `fromZoom` to `toZoom`. Used internally to help with zoom animations.
	getZoomScale(toZoom: number, fromZoom = this._zoom): number {
		// TODO replace with universal implementation after refactoring projections
		const crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	}

	// Returns the zoom level that the map would end up at, if it is at `fromZoom`
	// level and everything is scaled by a factor of `scale`. Inverse of
	// [`getZoomScale`](#map-getZoomScale).
	getScaleZoom(scale: number, fromZoom = this._zoom): number {
		const
			crs = this.options.crs,
			zoom = crs.zoom(scale * crs.scale(fromZoom));

		return isNaN(zoom) ? Infinity : zoom;
	}

	// Projects a geographical coordinate `LatLng` according to the projection
	// of the map's CRS, then scales it according to `zoom` and the CRS's
	// `Transformation`. The result is pixel coordinate relative to
	// the CRS origin.
	project(latlng: LatLng, zoom = this._zoom): Point {
		return this.options.crs.latLngToPoint(latlng, zoom);
	}

	// Inverse of [`project`](#map-project).
	unproject(point: Point, zoom = this._zoom): LatLng {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(point, zoom);
	}

	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding geographical coordinate (for the current zoom level).
	layerPointToLatLng(point: Point): LatLng {
		const projectedPoint = point.add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	}

	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the [origin pixel](#map-getpixelorigin).
	latLngToLayerPoint(latlng: LatLng): Point {
		const projectedPoint = this.project(latlng)._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	}

	// Returns a `LatLng` where `lat` and `lng` has been wrapped according to the
	// map's CRS's `wrapLat` and `wrapLng` properties, if they are outside the
	// CRS's bounds.
	// By default this means longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees.
	wrapLatLng(latlng: LatLng): LatLng {
		return this.options.crs.wrapLatLng(latlng);
	}

	// Returns a `LatLngBounds` with the same size as the given one, ensuring that
	// its center is within the CRS's bounds.
	// By default this means the center longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees, and the majority of the bounds
	// overlaps the CRS's bounds.
	wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds {
		return this.options.crs.wrapLatLngBounds(bounds);
	}

	// Returns the distance between two geographical coordinates according to
	// the map's CRS. By default this measures distance in meters.
	distance(latlng1: LatLng, latlng2: LatLng): number {
		return this.options.crs.distance(latlng1, latlng2);
	}

	// Given a pixel coordinate relative to the map container, returns the corresponding
	// pixel coordinate relative to the [origin pixel](#map-getpixelorigin).
	containerPointToLayerPoint(point: Point): Point {
		return point.subtract(this._getMapPanePos());
	}

	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding pixel coordinate relative to the map container.
	layerPointToContainerPoint(point: Point): Point {
		return point.add(this._getMapPanePos());
	}

	// Given a pixel coordinate relative to the map container, returns
	// the corresponding geographical coordinate (for the current zoom level).
	containerPointToLatLng(point: Point): LatLng {
		const layerPoint = this.containerPointToLayerPoint(point);
		return this.layerPointToLatLng(layerPoint);
	}

	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the map container.
	latLngToContainerPoint(latlng: LatLng): Point {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(latlng));
	}

	// Given a MouseEvent object, returns the pixel coordinate relative to the
	// map container where the event took place.
	mouseEventToContainerPoint(e: DomEvent.MouseEventLike): Point {
		return DomEvent.getMousePosition(e, this._container);
	}

	// Given a MouseEvent object, returns the pixel coordinate relative to
	// the [origin pixel](#map-getpixelorigin) where the event took place.
	mouseEventToLayerPoint(e: DomEvent.MouseEventLike): Point {
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	}

	// Given a MouseEvent object, returns geographical coordinate where the
	// event took place.
	mouseEventToLatLng(e: DomEvent.MouseEventLike): LatLng {
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	}

	// map initialization methods

	_initContainer(id: string | HTMLElement): void {
		const container = DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet_id) {
			throw new Error('Map container is already initialized.');
		}

		this._container = container;
		this._containerId = Util.stamp(container);

		DomEvent.on(container, 'scroll', this._onScroll, this);
	}

	_initLayout(): void {
		const container = this._container;

		this._fadeAnimated = this.options.fadeAnimation;

		const classes = ['leaflet-container'];

		if (Browser.touch) { classes.push('leaflet-touch'); }
		if (Browser.retina) { classes.push('leaflet-retina'); }
		if (Browser.safari) { classes.push('leaflet-safari'); }
		if (this._fadeAnimated) { classes.push('leaflet-fade-anim'); }

		container.classList.add(...classes);

		const {position} = getComputedStyle(container);

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed' && position !== 'sticky') {
			container.style.position = 'relative';
		}

		this._initPanes();
		this._initControlPos();
	}

	_initPanes(): void {
		const panes = this._panes = {};
		this._paneRenderers = {};

		// @section
		//
		// Panes are DOM elements used to control the ordering of layers on the map. You
		// can access panes with [`map.getPane`](#map-getpane) or
		// [`map.getPanes`](#map-getpanes) methods. New panes can be created with the
		// [`map.createPane`](#map-createpane) method.
		//
		// Every map has the following default panes that differ only in zIndex.
		//
		// @pane mapPane: HTMLElement = 'auto'
		// Pane that contains all other map panes

		this._mapPane = this.createPane('mapPane', this._container);
		DomUtil.setPosition(this._mapPane, new Point(0, 0));

		// @pane tilePane: HTMLElement = 200
		// Pane for `GridLayer`s and `TileLayer`s
		this.createPane('tilePane');
		// @pane overlayPane: HTMLElement = 400
		// Pane for vectors (`Path`s, like `Polyline`s and `Polygon`s), `ImageOverlay`s and `VideoOverlay`s
		this.createPane('overlayPane');
		// NOTE: previously there was 'shadowPane' (500) here until Sam removed it
		// @pane markerPane: HTMLElement = 600
		// Pane for `Icon`s of `Marker`s
		this.createPane('markerPane');
		// @pane tooltipPane: HTMLElement = 650
		// Pane for `Tooltip`s.
		this.createPane('tooltipPane');

		if (!this.options.markerZoomAnimation) {
			panes.markerPane.classList.add('leaflet-zoom-hide');
		}
	}

	// private methods that modify map state

	// @section Map state change events
	_resetView(center: LatLng, zoom: number, noMoveStart?: boolean): void {
		DomUtil.setPosition(this._mapPane, new Point(0, 0));

		const loading = !this._loaded;
		this._loaded = true;
		zoom = this._limitZoom(zoom);

		this.fire('viewprereset');

		const zoomChanged = this._zoom !== zoom;
		this
			._moveStart(zoomChanged, noMoveStart)
			._move(center, zoom)
			._moveEnd(zoomChanged);

		// @event viewreset: Event
		// Fired when the map needs to redraw its content (this usually happens
		// on map zoom or load). Very useful for creating custom overlays.
		this.fire('viewreset');

		// @event load: Event
		// Fired when the map is initialized (when its center and zoom are set
		// for the first time).
		if (loading) {
			this.fire('load');
		}
	}

	_moveStart(zoomChanged: boolean, noMoveStart?: boolean): this {
		// @event zoomstart: Event
		// Fired when the map zoom is about to change (e.g. before zoom animation).
		// @event movestart: Event
		// Fired when the view of the map starts changing (e.g. user starts dragging the map).
		if (zoomChanged) {
			this.fire('zoomstart');
		}
		if (!noMoveStart) {
			this.fire('movestart');
		}
		return this;
	}

	_move(
		center: LatLng,
		zoom = this._zoom,
		data?: any,
		supressEvent?: boolean,
	): this {
		const zoomChanged = this._zoom !== zoom;

		this._zoom = zoom;
		this._lastCenter = center;
		this._pixelOrigin = this._getNewPixelOrigin(center);

		if (!supressEvent) {
			// @event zoom: Event
			// Fired repeatedly during any change in zoom level,
			// including zoom and fly animations.
			if (zoomChanged || (data?.pinch)) {	// Always fire 'zoom' if pinching because #3530
				this.fire('zoom', data);
			}

			// @event move: Event
			// Fired repeatedly during any movement of the map,
			// including pan and fly animations.
			this.fire('move', data);
		} else if (data?.pinch) {	// Always fire 'zoom' if pinching because #3530
			this.fire('zoom', data);
		}
		return this;
	}

	_moveEnd(zoomChanged: boolean): this {
		// @event zoomend: Event
		// Fired when the map zoom changed, after any animations.
		if (zoomChanged) {
			this.fire('zoomend');
		}

		// @event moveend: Event
		// Fired when the center of the map stops changing
		// (e.g. user stopped dragging the map or after non-centered zoom).
		return this.fire('moveend');
	}

	_stop(): this {
		cancelAnimationFrame(this._flyToFrame);

		if (this._panAnim) {
			this._panAnim.stop();
		}

		return this;
	}

	_rawPanBy(offset: Point): void {
		DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	}

	_getZoomSpan(): number {
		return this.getMaxZoom() - this.getMinZoom();
	}

	_panInsideMaxBounds(): void {
		if (!this._enforcingBounds) {
			this.panInsideBounds(this.options.maxBounds);
		}
	}

	_checkIfLoaded(): void {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	}

	// DOM event handling

	// @section Interaction events
	_initEvents(remove?: boolean): void {
		this._targets = {};
		this._targets[Util.stamp(this._container)] = this;

		const onOff = remove ? DomEvent.off : DomEvent.on;

		// @event click: MouseEvent
		// Fired when the user clicks (or taps) the map.
		// @event dblclick: MouseEvent
		// Fired when the user double-clicks (or double-taps) the map.
		// @event mousedown: MouseEvent
		// Fired when the user pushes the mouse button on the map.
		// @event mouseup: MouseEvent
		// Fired when the user releases the mouse button on the map.
		// @event mouseover: MouseEvent
		// Fired when the mouse enters the map.
		// @event mouseout: MouseEvent
		// Fired when the mouse leaves the map.
		// @event mousemove: MouseEvent
		// Fired while the mouse moves over the map.
		// @event contextmenu: MouseEvent
		// Fired when the user pushes the right mouse button on the map, prevents
		// default browser context menu from showing if there are listeners on
		// this event. Also fired on mobile when the user holds a single touch
		// for a second (also called long press).
		// @event keypress: KeyboardEvent
		// Fired when the user presses a key from the keyboard that produces a character value while the map is focused.
		// @event keydown: KeyboardEvent
		// Fired when the user presses a key from the keyboard while the map is focused. Unlike the `keypress` event,
		// the `keydown` event is fired for keys that produce a character value and for keys
		// that do not produce a character value.
		// @event keyup: KeyboardEvent
		// Fired when the user releases a key from the keyboard while the map is focused.
		onOff(this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu keypress keydown keyup', this._handleDOMEvent, this);

		if (this.options.trackResize) {
			if (!remove) {
				this._resizeObserver.observe(this._container);
			} else {
				this._resizeObserver.disconnect();
			}
		}

		if (this.options.transform3DLimit) {
			(remove ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
		}
	}

	_onResize(): void {
		cancelAnimationFrame(this._resizeRequest);
		this._resizeRequest = requestAnimationFrame(() => this.invalidateSize({debounceMoveend: true}));
	}

	_onScroll(): void {
		this._container.scrollTop  = 0;
		this._container.scrollLeft = 0;
	}

	_onMoveEnd(): void {
		const pos = this._getMapPanePos();
		if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1203873 but Webkit also have
			// a pixel offset on very high values, see: https://jsfiddle.net/dg6r5hhb/
			this._resetView(this.getCenter(), this._zoom);
		}
	}

	_findEventTargets(e, type) {
		let targets = [],
		    target,
		    src = e.target || e.srcElement,
		    dragging = false;
		const isHover = type === 'mouseout' || type === 'mouseover';

		while (src) {
			target = this._targets[Util.stamp(src)];
			if (target && (type === 'click' || type === 'preclick') && this._draggableMoved(target)) {
				// Prevent firing click after you just dragged an object.
				dragging = true;
				break;
			}
			if (target && target.listens(type, true)) {
				if (isHover && !DomEvent.isExternalTarget(src, e)) { break; }
				targets.push(target);
				if (isHover) { break; }
			}
			if (src === this._container) { break; }
			src = src.parentNode;
		}
		if (!targets.length && !dragging && !isHover && this.listens(type, true)) {
			targets = [this];
		}
		return targets;
	}

	_isClickDisabled(el: HTMLElement): boolean {
		while (el && el !== this._container) {
			if (el._leaflet_disable_click) {
				return true;
			}
			el = el.parentNode as HTMLElement;
		}
		return false;
	}

	_handleDOMEvent(e: Event) {
		const el = (e.target || e.srcElement) as HTMLElement;

		if (
			!this._loaded ||
			el._leaflet_disable_events ||
			e.type === 'click' && this._isClickDisabled(el)
		) {
			return;
		}

		const type = e.type;

		if (type === 'mousedown') {
			// prevents outline when clicking on keyboard-focusable element
			DomUtil.preventOutline(el);
		}

		this._fireDOMEvent(e, type);
	}

	_mouseEvents = ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'];

	_fireDOMEvent(e: Event, type: string, canvasTargets?) {

		if (e.type === 'click') {
			// Fire a synthetic 'preclick' event which propagates up (mainly for closing tooltips).
			// @event preclick: MouseEvent
			// Fired before mouse click on the map (sometimes useful when you
			// want something to happen on click before any existing click
			// handlers start running).
			const synth = Util.extend({}, e);
			synth.type = 'preclick';
			this._fireDOMEvent(synth, synth.type, canvasTargets);
		}

		// Find the layer the event is propagating from and its parents.
		let targets = this._findEventTargets(e, type);

		if (canvasTargets) {
			const filtered = []; // pick only targets with listeners
			for (let i = 0; i < canvasTargets.length; i++) {
				if (canvasTargets[i].listens(type, true)) {
					filtered.push(canvasTargets[i]);
				}
			}
			targets = filtered.concat(targets);
		}

		if (!targets.length) { return; }

		if (type === 'contextmenu') {
			DomEvent.preventDefault(e);
		}

		const target = targets[0];
		const data: any = { // TODO: strong typing
			originalEvent: e
		};

		if (e.type !== 'keypress' && e.type !== 'keydown' && e.type !== 'keyup') {
			const isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
			data.containerPoint = isMarker ?
				this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
		}

		for (let i = 0; i < targets.length; i++) {
			targets[i].fire(type, data, true);
			if (data.originalEvent._stopped ||
				(targets[i].options.bubblingMouseEvents === false && this._mouseEvents.includes(type))) { return; }
		}
	}

	_draggableMoved(obj) {
		obj = obj.dragging && obj.dragging.enabled() ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom?._moved);
	}

	// @section Other Methods

	// Runs the given function `fn` when the map gets initialized with
	// a view (center and zoom) and at least one layer, or immediately
	// if it's already initialized, optionally passing a function context.
	whenReady(callback: HandlerFn, context: any = this): this {
		if (this._loaded) {
			callback.call(context, { target: this });
		} else {
			this.on('load', callback, context);
		}
		return this;
	}

	// private methods for getting map state

	_getMapPanePos(): Point {
		return DomUtil.getPosition(this._mapPane);
	}

	_moved(): boolean {
		const pos = this._getMapPanePos();
		return pos.x !== 0 || pos.y !== 0;
	}

	_getTopLeftPoint(center?: LatLng, zoom?: number): Point {
		const pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	}

	_getNewPixelOrigin(center: LatLng, zoom?: number): Point {
		const viewHalf = this.getSize()._divideBy(2);
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	}

	_latLngToNewLayerPoint(latlng: LatLng, zoom: number, center: LatLng): Point {
		const topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	}

	_latLngBoundsToNewLayerBounds(
		latLngBounds: LatLngBounds,
		zoom: number | undefined,
		center: LatLng,
	): Bounds {
		const topLeft = this._getNewPixelOrigin(center, zoom);

		return new Bounds(
			this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft),
		);
	}

	// layer point of the current center
	_getCenterLayerPoint(): Point {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	}

	// offset of the specified place to the current center in pixels
	_getCenterOffset(latlng: LatLng): Point {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	}

	// adjust center for view to get inside bounds
	_limitCenter(center: LatLng, zoom?: number, bounds?: LatLngBounds): LatLng {
		if (!bounds) { return center; }

		const centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		// If offset is less than a pixel, ignore.
		// This prevents unstable projections from getting into
		// an infinite loop of tiny offsets.
		if (Math.abs(offset.x) <= 1 && Math.abs(offset.y) <= 1) {
			return center;
		}

		return this.unproject(centerPoint.add(offset), zoom);
	}

	// adjust offset for view to get inside bounds
	_limitOffset(offset: Point, bounds?: LatLngBounds): Point {
		if (!bounds) { return offset; }

		const
			viewBounds = this.getPixelBounds(),
		    newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	}

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset(pxBounds: Bounds, maxBounds: LatLngBounds, zoom?: number): Point {
		const
			projectedMaxBounds = new Bounds(
		        this.project(maxBounds.getNorthEast(), zoom),
		        this.project(maxBounds.getSouthWest(), zoom)
		    ),
		    minOffset = projectedMaxBounds.min.subtract(pxBounds.min),
		    maxOffset = projectedMaxBounds.max.subtract(pxBounds.max),
		    dx = this._rebound(minOffset.x, -maxOffset.x),
		    dy = this._rebound(minOffset.y, -maxOffset.y);

		return new Point(dx, dy);
	}

	// TODO: this doesn't need to be a method
	_rebound(left: number, right: number): number {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	}

	_limitZoom(zoom: number): number {
		const
			min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    snap = this.options.zoomSnap;

		if (snap) {
			zoom = Math.round(zoom / snap) * snap;
		}

		return Math.max(min, Math.min(max, zoom));
	}

	_onPanTransitionStep(): void {
		this.fire('move');
	}

	_onPanTransitionEnd(): void {
		this._mapPane.classList.remove('leaflet-pan-anim');
		this.fire('moveend');
	}

	_tryAnimatedPan(center: LatLng, options?: PanOptions): boolean {
		// difference between the new and current centers in pixels
		const offset = this._getCenterOffset(center)._trunc();

		// don't animate too far unless animate: true specified in options
		if (options?.animate !== true && !this.getSize().contains(offset)) {
			return false;
		}

		this.panBy(offset, options);

		return true;
	}

	_createAnimProxy(): void {
		const proxy = DomUtil.create('div', 'leaflet-proxy leaflet-zoom-animated');
		this._proxy = proxy;
		this._panes.mapPane.appendChild(proxy);

		this.on('zoomanim', function (e) {
			const transform = this._proxy.style.transform;

			DomUtil.setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// workaround for case when transform is the same and so transitionend event is not fired
			if (transform === this._proxy.style.transform && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		}, this);

		this.on('load moveend', this._animMoveEnd, this);
		this._on('unload', this._destroyAnimProxy, this);
	}

	_destroyAnimProxy(): void {
		this._proxy?.remove(); // TODO: safe to wrap all of these in if-statement?
		this.off('load moveend', this._animMoveEnd, this);
		delete this._proxy;
	}

	_animMoveEnd(): void {
		if (this._proxy) {
			const
				c = this.getCenter(),
				z = this._zoom;

			DomUtil.setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
		}
	}

	_catchTransitionEnd(e: TransitionEvent): void {
		if (this._animatingZoom && e.propertyName.includes('transform')) {
			this._onZoomTransitionEnd();
		}
	}

	_nothingToAnimate(): boolean {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	}

	_tryAnimatedZoom(center: LatLng, zoom: number, options: PanOptions = {}): boolean {
		if (this._animatingZoom) {
			return true;
		}

		// don't animate if disabled, not supported or zoom difference is too large
		if (
			!this._zoomAnimated ||
			options.animate === false ||
			this._nothingToAnimate() ||
		    Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold
		) {
			return false;
		}

		// offset is the pixel coords of the zoom origin relative to the current center
		const
			scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		requestAnimationFrame(() => {
			this
			    ._moveStart(true, options.noMoveStart ?? false)
			    ._animateZoom(center, zoom, true);
		});

		return true;
	}

	_animateZoom(center: LatLng, zoom: number, startAnim: boolean, noUpdate?: boolean): void {
		if (!this._mapPane) { return; }

		if (startAnim) {
			this._animatingZoom = true;

			// remember what center/zoom to set after animation
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			this._mapPane.classList.add('leaflet-zoom-anim');
		}

		// @section Other Events
		// @event zoomanim: ZoomAnimEvent
		// Fired at least once per zoom animation. For continuous zoom, like pinch zooming, fired once per frame during zoom.
		this.fire('zoomanim', {
			center,
			zoom,
			noUpdate
		});

		this._tempFireZoomEvent ||= this._zoom !== this._animateToZoom;
		this._move(this._animateToCenter!, this._animateToZoom, undefined, true);

		// Work around webkit not firing 'transitionend', see https://github.com/Leaflet/Leaflet/issues/3689, 2693
		setTimeout(this._onZoomTransitionEnd.bind(this), 250);
	}

	_onZoomTransitionEnd(): void {
		if (!this._animatingZoom) { return; }

		if (this._mapPane) {
			this._mapPane.classList.remove('leaflet-zoom-anim');
		}

		this._animatingZoom = false;
		this._move(this._animateToCenter!, this._animateToZoom, undefined, true);

		if (this._tempFireZoomEvent) {
			this.fire('zoom');
			this._tempFireZoomEvent = false;
		}

		this.fire('move');
		this._moveEnd(true);
	}

	// Methods pertaining to layers

	// Adds the given layer to the map
	addLayer(layer: Layer): Map {
		const id = Util.stamp(layer);
		if (this._layers[id]) { return this; }
		this._layers[id] = layer;

		layer._mapToAdd = this;
		layer.beforeAdd?.(this);

		this.whenReady(layer._layerAdd, layer);

		return this;
	}

	// Removes the given layer from the map.
	removeLayer(layer: Layer): this {
		const id = Util.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer});
			layer.fire('remove');
		}

		layer._map = undefined;
		layer._mapToAdd = undefined;

		return this;
	}

	// Returns `true` if the given layer is currently added to the map
	hasLayer(layer: Layer): boolean {
		return Util.stamp(layer) in this._layers;
	}

	/**
	 * Iterates over the layers of the map, optionally specifying context of the iterator function.
	 * ```
	 * map.eachLayer(function(layer){
	 *     layer.bindTooltip('Hello');
	 * });
	 * ```
	 */
	eachLayer(method: (l: Layer) => void): this;
	eachLayer<This>(method: (this: This, l: Layer) => void, context: This): this;
	eachLayer(method: (l: Layer) => void, context?: any): this {
		for (const layer of Object.values(this._layers)) {
			method.call(context, layer);
		}
		return this;
	}

	_addZoomLimit(layer: Layer): void {
		if (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[Util.stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	}

	_removeZoomLimit(layer: Layer): void {
		const id = Util.stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	}

	_updateZoomLevels(): void {
		let
			minZoom = Infinity,
		    maxZoom = -Infinity;

		const oldZoomSpan = this._getZoomSpan();

		for (const {options} of Object.values(this._zoomBoundLayers)) {
			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		// @section Map state change events
		// @event zoomlevelschange: Event
		// Fired when the number of zoomlevels on the map is changed due
		// to adding or removing a layer.
		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}

		if (this.options.maxZoom === undefined && this._layersMaxZoom && this._zoom > this._layersMaxZoom) {
			this.setZoom(this._layersMaxZoom);
		}
		if (this.options.minZoom === undefined && this._layersMinZoom && this._zoom < this._layersMinZoom) {
			this.setZoom(this._layersMinZoom);
		}
	}

	// Methods for UI controls

	// Adds the given control to the map
	addControl(control: Control): this {
		control.addTo(this);
		return this;
	}

	// Removes the given control from the map
	removeControl(control: Control): this {
		control.remove();
		return this;
	}

	_initControlPos(): void {
		const
		    l = 'leaflet-',
		    container = DomUtil.create('div', `${l}control-container`, this._container);

		function createCorner(vSide: string, hSide: string) {
			return DomUtil.create('div', `${l + vSide} ${l + hSide}`, container);
		}

		this._controlContainer = container;
		this._controlCorners = {
			topleft: createCorner('top', 'left'),
			topright: createCorner('top', 'right'),
			bottomleft: createCorner('bottom', 'left'),
			bottomright: createCorner('bottom', 'right'),
		};
	}

	_clearControlPos(): void {
		if (this._controlContainer) {
			for (const corner of Object.values(this._controlCorners!)) {
				corner.remove();
			}
			this._controlContainer.remove();
			this._controlContainer = undefined;
			this._controlCorners = undefined;
		}
	}

	// @namespace Map; @method getRenderer(layer: Path): Renderer
	// Returns the instance of `Renderer` that should be used to render the given
	// `Path`. It will ensure that the `renderer` options of the map and paths
	// are respected, and that the renderers do exist on the map.
	getRenderer(layer): Renderer {
		// @namespace Path; @option renderer: Renderer
		// Use this specific instance of `Renderer` for this path. Takes
		// precedence over the map's [default renderer](#map-renderer).
		let renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			renderer = this._renderer = this._createRenderer();
		}

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	}

	_getPaneRenderer(name: string) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		// Fancy one-liner to 'create if not exists' and then return it
		return (this._paneRenderers[name] ||= this._createRenderer({pane: name}));
	}

	_createRenderer(options): Renderer {
		// @namespace Map; @option preferCanvas: Boolean = false
		// Whether `Path`s should be rendered on a `Canvas` renderer.
		// By default, all `Path`s are rendered in a `SVG` renderer.
		return this.options.preferCanvas ? new Canvas(options) : new SVG(options);
	}

}
