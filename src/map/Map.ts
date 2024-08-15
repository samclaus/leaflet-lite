import { Browser, Evented, type Disposable } from '../core';
import { DomUtil, EventSink, PosAnimation, getMousePosition, on, type MouseEventLike } from '../dom';
import { LatLng, LatLngBounds } from '../geog';
import { EPSG3857 } from '../geog/crs';
import { Bounds, Point } from '../geom';
import type { FitBoundsOptions, InvalidateSizeOptions, MapOptions, PanOptions, ZoomOptions, ZoomPanOptions } from './map-options';

/**
 * `Map` is the core class for the library and serves these main purposes:
 * 
 * - Given a DOM element, set up a particular DOM structure within it (which
 * is discussed in detail below) so that elements you add to the map can
 * easily position/stack themselves relative to each other.
 * - Keep all view-related state (current center, current zoom, coordinate
 * system details, etc.) in a central spot and emit events whenever they
 * change so that 'elements' you add to the map (i.e., other classes in this
 * library or maybe you roll your own) can listen for those events and
 * update the CSS for their corresponding DOM elements to keep them positioned
 * correctly. The map will also emit a 'dispose' event when it is disposed,
 * which elements should listen for and then dispose of themselves in a chain
 * reaction.
 * - Host a centralized key-value map (a WeakMap for the sake of easy garbage collection)
 * which links DOM elements to map elements (classes like `Node` or `Area`) so
 * DOM event targets can easily be translated to the class instances you care
 * about: "Ah, it was THIS marker on the map that was clicked, which corresponds
 * to THIS restaurant in my application's database!"
 * - Host centralized animation state so that only one animation function, such
 * as `flyTo()`, will be manipulating the map state (and therefore causing
 * events to be emitted that tell elements to update their CSS) at a given time.
 * 
 * ## Simple Example
 *
 * ```js
 * // When creating the Map, you MUST give it an initial center and zoom because
 * // that greatly simplifies state management and null safety within the library,
 * // and I don't believe it makes much sense to show a blank map in an 'unloaded'
 * // state on the page. If you need to figure out the center and zoom
 * // asynchronously, such as by loading the information from a server, you could
 * // show a loading indicator and then construct the map once the information is
 * // available.
 * const map = new Map(
 *     document.getElementById('my-map-div'),
 *     new LatLng(51.505, -0.09), // initial center for the map
 *     13, // initial zoom for the map
 *     {
 *         minZoom: 8,
 *         maxZoom: 16,
 *         // etc..
 *     }
 * );
 * 
 * // The Map class knows nothing of loading a grid of PNG map tiles--the TileLayer
 * // class simply listens for changes to the current map view and manages a bunch
 * // of <img> elements accordingly!
 * new TileLayer(map, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
 *     .init();
 * 
 * // Add behaviors to the map. They are all optional, you can roll your own, and
 * // they work in a straightforward manner by listening to DOM events and then
 * // telling the Map instance to update its view as necessary. That causes the
 * // Map to emit state change events, which in turn causes the TileLayer above
 * // (and any other elements added to the Map) to update their DOM elements!
 * new Drag(map);
 * enableScrollWheelZoom(map);
 * enableDoubleClickZoom(map);
 * new TouchZoom(map);
 * new BoxZoom(map);
 * new Keyboard(map);
 * new TapHold(map);
 * ```
 * 
 * ## DOM Structure of the Map
 * 
 * You know what grinds my gears? Libraries that don't document things like DOM
 * structure or their CSS, making all of that information a magical black box so
 * that it's difficult for application programmers to add their own CSS without
 * breaking things!
 * 
 * Here is the DOM structure any Leaflet Lite map will have, followed by an
 * explanation of 'why':
 * 
 * ```HTML
 * <!-- TODO -->
 * <div class="leaflet-container leaflet-touch leaflet-retina leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom" tabindex="0">
 *     <div class="leaflet-pane leaflet-root-pane">
 *         <div class="leaflet-pane leaflet-tile-pane"></div>
 *         <div class="leaflet-pane leaflet-overlay-pane"></div>
 *         <div class="leaflet-pane leaflet-marker-pane"></div>
 *         <div class="leaflet-zoom-animated"></div>
 *     </div>
 * </div>
 * ```
 *
 * Panes are DOM elements used to control the stacking of elements on the map. You
 * can access panes using the [`map.pane`](#map-pane) method, which will create a
 * pane if it doesn't already exist.
 *
 * Every map has the following default panes that differ only in zIndex
 *
 * @pane map ('auto'): Pane that contains all other map panes
 * @pane tile (200): Pane for `GridLayer`s and `TileLayer`s
 * @pane overlay (400): Pane for vectors (`Path`s, like `Polyline`s and `Polygon`s),
 * 						`ImageOverlay`s and `VideoOverlay`s
 * @pane marker (600): Pane for `Icon`s of `Marker`s
 * 
 * @event dispose: Event
 * Fired when the map is destroyed with the dispose() method.
 */
export class Map extends Evented implements Disposable {

	// Options, DOM elements, and other core properties that only get assigned up-front
	options: MapOptions;
	_container: HTMLElement;
	_containerEvents: EventSink;
	_panes: Dict<HTMLElement> = Object.create(null);
	_rootPane: HTMLElement;

	// Core mutable state for the current map view
	_zoom: number;
	_lastCenter: LatLng | undefined;
	_pixelOrigin: Point;

	_enforcingBounds = false;
	_tempFireZoomEvent = false;
	_animatingZoom = false;
	_animateToCenter: LatLng | undefined;
	_animateToZoom = 0;

	// Auto-resizing stuff
	_size: Point | undefined;
	_sizeChanged = true;
	_resizeFrame = 0;
	_resizeMoveendTimer: number | undefined;
	_resizeObserver = new ResizeObserver((): void => {
		cancelAnimationFrame(this._resizeFrame);
		this._resizeFrame = requestAnimationFrame(
			() => this.invalidateSize({ debounceMoveend: true }),
		);
	});

	/**
	 * @deprecated TODO: the map DOES need some sort of centralized animation state, but it needs to
	 * be a generic utility useable by all external animation code so that things are tree shakeable.
	 */
	_flyToFrame = 0;
	/**
	 * @deprecated TODO: the map DOES need some sort of centralized animation state, but it needs to
	 * be a generic utility useable by all external animation code so that things are tree shakeable.
	 */
	_panAnim: PosAnimation | undefined;

	constructor(
		container: HTMLElement,
		initialCenter: LatLng,
		initialZoom: number,
		options?: Partial<MapOptions>,
	) {
		super();

		const resolvedOpts: MapOptions = this.options = {
			crs: EPSG3857,
			minZoom: 0,
			maxZoom: Infinity,
			maxBounds: undefined,
			zoomAnimationThreshold: 4,
			fadeAnimation: true,
			transform3DLimit: 8388608,
			zoomSnap: 1,
			zoomDelta: 1,
			...options,
		};

		this._container = container;
	
		const classes = ['leaflet-container'];

		if (Browser.touch) { classes.push('leaflet-touch'); }
		if (Browser.retina) { classes.push('leaflet-retina'); }
		if (Browser.safari) { classes.push('leaflet-safari'); }
		if (resolvedOpts.fadeAnimation) { classes.push('leaflet-fade-anim'); }

		container.classList.add(...classes);

		const {position} = getComputedStyle(container);

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed' && position !== 'sticky') {
			container.style.position = 'relative';
		}

		this._rootPane = this.pane('root', this._container);
		DomUtil.setPosition(this._rootPane, new Point(0, 0));

		// Force eager creation of these map panes
		this.pane('tile');
		this.pane('overlay');
		this.pane('marker');

		this._containerEvents = on(container, 'scroll', this._onScroll, this);
		this._resizeObserver.observe(this._container);

		if (resolvedOpts.transform3DLimit) {
			this.on('moveend', this._onMoveEnd);
		}
		if (resolvedOpts.maxBounds) {
			this.setMaxBounds(resolvedOpts.maxBounds);
		}

		// Set up view state according to initial zoom and center
		initialZoom = this._limitZoom(initialZoom);
		initialCenter = this._limitCenter(initialCenter, initialZoom, resolvedOpts.maxBounds);
		this._zoom = initialZoom;
		this._lastCenter = initialCenter;
		this._pixelOrigin = this._getNewPixelOrigin(initialCenter);

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		const animProxy = DomUtil.create('div', 'leaflet-zoom-animated');
		this._rootPane.appendChild(animProxy);

		this.on('zoomanim', (e: any): void => {
			const transform = animProxy.style.transform;

			DomUtil.setTransform(animProxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// workaround for case when transform is the same and so transitionend event is not fired
			if (transform === animProxy.style.transform && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		});
		this.on('moveend', (): void => {
			const
				c = this.getCenter(),
				z = this._zoom;

			DomUtil.setTransform(animProxy, this.project(c, z), this.getZoomScale(z, 1));
		});

		const catchTransitionEnd = (e: TransitionEvent): void => {
			if (this._animatingZoom && e.propertyName.includes('transform')) {
				this._onZoomTransitionEnd();
			}
		};

		animProxy.addEventListener('transitionend', catchTransitionEnd);

		// Handle all cleanup within a closure here so we do not need to add class properties
		// to reference the proxy element later
		this.on('dispose', (): void => {
			animProxy.removeEventListener('transitionend', catchTransitionEnd);
			animProxy.remove();
		});
	}

	// @section Methods for modifying map state

	// Sets the view of the map (geographical center and zoom) with the given
	// animation options.
	setView(center: LatLng, zoom?: number, options: ZoomPanOptions = {}): this {
		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(center, zoom, this.options.maxBounds);

		this._stop();

		if (options !== true) {

			if (options.animate !== undefined) {
				options.zoom = { animate: options.animate, ...options.zoom };
				options.pan = {
					animate: options.animate,
					duration: options.duration,
					...options.pan
				};
			}

			// try animating pan or zoom
			const moved = (this._zoom !== zoom) ?
				this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (moved) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._resizeMoveendTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	}

	// Sets the zoom of the map.
	setZoom(zoom: number, options?: ZoomOptions): this {
		return this.setView(this.getCenter(), zoom, {zoom: options});
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
				'end': this._onPanTransitionEnd,
			}, this);
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			this._rootPane.classList.add('leaflet-pan-anim');

			const newPos = this._getMapPanePos().subtract(offset).round();
			this._panAnim.run(this._rootPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
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
		this._panInsideMaxBounds();

		return this.on('moveend', this._panInsideMaxBounds);
	}

	/**
	 * Updates the minZoom option for the map, fires a 'zoomlimitschanged'
	 * event, and clamps the current zoom to the new limits as necessary.
	 * 
	 * Does nothing if the map is not initialized or minZoom is the same
	 * as before.
	 */
	setMinZoom(minZoom: number): this {
		if (minZoom !== this.options.minZoom) {
			this.options.minZoom = minZoom;
			this.fire('zoomlimitschanged');

			if (this._zoom < minZoom) {
				this.setZoom(minZoom);
			}
		}
		return this;
	}

	/**
	 * Updates the maxZoom option for the map, fires a 'zoomlimitschanged'
	 * event, and clamps the current zoom to the new limits as necessary.
	 * 
	 * Does nothing if the map is not initialized or maxZoom is the same
	 * as before.
	 */
	setMaxZoom(maxZoom: number): this {
		if (maxZoom !== this.options.maxZoom) {
			this.options.maxZoom = maxZoom;
			this.fire('zoomlimitschanged');

			if (this._zoom > maxZoom) {
				this.setZoom(maxZoom);
			}
		}
		return this;
	}

	// Pans the map to the closest view that would lie inside the given bounds (if
	// it's not already), controlling the animation using the options specific, if any.
	panInsideBounds(bounds?: LatLngBounds, options?: PanOptions): this {
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

	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default. If `options.pan` is `false`, panning will not occur.
	// If `options.debounceMoveend` is `true`, it will delay `moveend` event so
	// that it doesn't happen often even if the method is called many
	// times in a row.
	invalidateSize(options: InvalidateSizeOptions): this {
		options = {
			animate: false,
			pan: true,
			...options,
		};

		const oldSize = this.getSize();

		this._sizeChanged = true;
		this._lastCenter = undefined;

		const
			newSize = this.getSize(),
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
				clearTimeout(this._resizeMoveendTimer);
				this._resizeMoveendTimer = setTimeout(() => this.fire('moveend'), 200);
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

	/**
	 * Destroys the map and clears all related event listeners. The map must NOT be used again
	 * after calling remove()--assume that all of its state has been corrupted by the operation.
	 * 
	 * If you need to show another map, create a brand new instance. Do not hold on to references
	 * to the old map so that it can be garbage collected.
	 */
	dispose(): void {
		this._containerEvents.dispose();
		this._resizeObserver.disconnect();
		this._stop();
		this._rootPane.remove();

		if (this._resizeFrame) {
			cancelAnimationFrame(this._resizeFrame);
			this._resizeFrame = 0;
		}

		this.fire('dispose');

		for (const pane of Object.values(this._panes)) {
			pane.remove();
		}

		this.off();
	}

	// @section Other Methods

	/**
	 * Looks up the map pane with the given name, creating it if necessary. Panes are core to
	 * how layers work.
	 * 
	 * Essentially, a "pane" is just an HTML `<div>` element that can be transformed (e.g.,
	 * translated) with CSS as the map is panned, zoomed, etc. By transforming the pane, we do
	 * not need to position the--potentially thousands of--layers within that pane until the
	 * map settles down (we may have been animating it) and we reset the coordinate system.
	 * To be honest, I still don't fully understand the details behind how panes are managed,
	 * so this documentation comment is a work-in-progress.
	 */
	pane(name: string, container?: HTMLElement): HTMLElement {
		return this._panes[name] ||= DomUtil.create(
			'div',
			`leaflet-pane leaflet-${name}-pane`,
			container || this._rootPane,
		);
	}

	// @section Methods for Getting Map State

	// Returns the geographical center of the map view
	getCenter(): LatLng {
		return (this._lastCenter && !this._moved())
			? this._lastCenter.clone()
			: this.layerPointToLatLng(this._getCenterLayerPoint());
	}

	// Returns the geographical bounds visible in the current map view
	getBounds(): LatLngBounds {
		const
			bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new LatLngBounds(sw, ne);
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
		let zoom = this._zoom;

		const
			min = this.options.minZoom,
			max = this.options.maxZoom,
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
		if (this._sizeChanged || !this._size) {
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
	getPixelOrigin(): Point {
		return this._pixelOrigin;
	}

	// Returns the world's bounds in pixel coordinates for zoom level `zoom`.
	// If `zoom` is omitted, the map's current zoom level is used.
	getPixelWorldBounds(zoom = this._zoom): Bounds | undefined {
		return this.options.crs.getProjectedBounds(zoom);
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
	mouseEventToContainerPoint(e: MouseEventLike): Point {
		return getMousePosition(e, this._container);
	}

	// Given a MouseEvent object, returns the pixel coordinate relative to
	// the [origin pixel](#map-getpixelorigin) where the event took place.
	mouseEventToLayerPoint(e: MouseEventLike): Point {
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	}

	// Given a MouseEvent object, returns geographical coordinate where the
	// event took place.
	mouseEventToLatLng(e: MouseEventLike): LatLng {
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	}

	// private methods that modify map state

	// @section Map state change events
	_resetView(center: LatLng, zoom: number): void {
		DomUtil.setPosition(this._rootPane, new Point(0, 0));

		zoom = this._limitZoom(zoom);

		this.fire('viewprereset');

		const zoomChanged = this._zoom !== zoom;
		this
			._move(center, zoom)
			._moveEnd(zoomChanged);

		// @event viewreset: Event
		// Fired when the map needs to redraw its content (this usually happens
		// on map zoom). Very useful for creating custom overlays.
		this.fire('viewreset');
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
		DomUtil.setPosition(this._rootPane, this._getMapPanePos().subtract(offset));
	}

	_panInsideMaxBounds(): void {
		if (!this._enforcingBounds) {
			this.panInsideBounds(this.options.maxBounds);
		}
	}

	// DOM event handling

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

	// TODO: this code is pulled from the old _fireDOMEvent() method; the map was constantly
	// listening for all sorts of DOM events and computing the information for every single one,
	// rather than just providing a utility for computing relevant information ON DEMAND; this
	// API still needs work and consideration I'm sure
	wrapMouseEv(e: MouseEventLike): any { // TODO: type
		const
			containerPoint = this.mouseEventToContainerPoint(e),
			layerPoint = this.containerPointToLayerPoint(containerPoint),
			latlng = this.layerPointToLatLng(layerPoint);

		return {
			originalEvent: e,
			containerPoint,
			layerPoint,
			latlng,
		};
	}

	// private methods for getting map state

	_getMapPanePos(): Point {
		return DomUtil.getPosition(this._rootPane);
	}

	_moved(): boolean {
		const pos = this._getMapPanePos();
		return pos.x !== 0 || pos.y !== 0;
	}

	_getTopLeftPoint(center?: LatLng, zoom?: number): Point {
		const pixelOrigin = (center && zoom !== undefined)
			? this._getNewPixelOrigin(center, zoom)
			: this.getPixelOrigin();
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

		const
			centerPoint = this.project(center, zoom),
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
		const {
			minZoom,
		    maxZoom,
		    zoomSnap,
		} = this.options;

		if (zoomSnap) {
			zoom = Math.round(zoom / zoomSnap) * zoomSnap;
		}

		return Math.max(minZoom, Math.min(maxZoom, zoom));
	}

	_onPanTransitionStep(): void {
		this.fire('move');
	}

	_onPanTransitionEnd(): void {
		this._rootPane.classList.remove('leaflet-pan-anim');
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

	_tryAnimatedZoom(center: LatLng, zoom: number, options: PanOptions = {}): boolean {
		if (this._animatingZoom) {
			return true;
		}

		// don't animate if disabled or zoom difference is too large
		if (
			options.animate === false ||
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

		requestAnimationFrame(() => this._animateZoom(center, zoom, true));

		return true;
	}

	_animateZoom(center: LatLng, zoom: number, startAnim: boolean, noUpdate?: boolean): void {
		if (startAnim) {
			this._animatingZoom = true;

			// remember what center/zoom to set after animation
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			this._rootPane.classList.add('leaflet-zoom-anim');
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

		this._rootPane.classList.remove('leaflet-zoom-anim');
		this._animatingZoom = false;
		this._move(this._animateToCenter!, this._animateToZoom, undefined, true);

		if (this._tempFireZoomEvent) {
			this.fire('zoom');
			this._tempFireZoomEvent = false;
		}

		this.fire('move');
		this._moveEnd(true);
	}

}
