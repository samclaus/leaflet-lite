import { Layer, type LayerOptions } from '..';
import { Browser, Util, type HandlerMap } from '../../core';
import { DomUtil } from '../../dom';
import { LatLng, LatLngBounds } from '../../geog';
import { Bounds, Point } from '../../geom';
import type { Map } from '../../map';

export interface GridLayerOptions extends LayerOptions {
	/**
	 * Width/height of tiles in the grid. You may pass a simple number if width = height.
	 */
	tileSize: number | Point;
	/**
	 * Opacity of the tiles. Can be used in the `createTile()` function.
	 */
	opacity: number;
	/**
	 * Load new tiles only when panning ends. True by default on mobile browsers, in order
	 * to avoid too many requests and keep smooth navigation. False otherwise in order to
	 * display new tiles _during_ panning, since it is easy to pan outside the
	 * [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
	 */
	updateWhenIdle: boolean;
	/**
	 * By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a
	 * [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting
	 * this option to false will update the grid layer only when the smooth animation ends.
	 */
	updateWhenZooming: boolean;
	/**
	 * Tiles will not update more than once every `updateInterval` milliseconds when panning.
	 */
	updateInterval: 200;
	/**
	 * The explicit zIndex of the tile layer. 1 by default.
	 */
	zIndex: number;
	/** If set, tiles will only be loaded inside these bounds. */
	bounds: LatLngBounds | undefined;
	/**
	 * The minimum zoom level down to which this layer will be displayed (inclusive).
	 * 0 by default.
	 */
	minZoom: number;
	/**
	 * If set, the maximum zoom level up to which this layer will be displayed
	 * (inclusive).
	 */
	maxZoom: number | undefined;
	/**
	 * Maximum zoom number the tile source has available. If it is specified,
	 * the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
	 * from `maxNativeZoom` level and auto-scaled.
	 */
	maxNativeZoom: number | undefined;
	/**
	 * Minimum zoom number the tile source has available. If it is specified,
	 * the tiles on all zoom levels lower than `minNativeZoom` will be loaded
	 * from `minNativeZoom` level and auto-scaled.
	 */
	minNativeZoom: number | undefined;
	/**
	 * Whether the layer is wrapped around the antimeridian. If `true`, the
	 * GridLayer will only be displayed once at low zoom levels. Has no
	 * effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
	 * in combination with [`bounds`](#gridlayer-bounds) to prevent requesting
	 * tiles outside the CRS limits. False by default.
	 */
	noWrap: boolean;
	/** Map pane where the grid layer will be added. 'tile' by default. */
	pane: string;
	/** A custom class name to assign to the tile layer. Empty by default. */
	className: string;
	/**
	 * When panning the map, keep this many rows and columns of tiles before unloading
	 * them. 2 by default.
	 */
	keepBuffer: 2;
}

/** @deprecated TODO: figure out the types for the various 'done' callback parameters throughout codebase */
export type DoneFn = (err: any, tile: HTMLElement) => void;

export interface TileModel {
	el: HTMLElement;
	coords: Point;
	current: boolean;
	loaded: number; // UNIX millis timestamp, 0 if not loaded yet
	active: boolean;
	retain: boolean;
}

export interface LevelModel {
	el: HTMLElement;
	origin: Point;
	zoom: number;
}

/**
 * Generic class for handling a tiled grid of HTML elements. This is the base class for all tile layers and replaces `TileLayer.Canvas`.
 * GridLayer can be extended to create a tiled grid of HTML elements like `<canvas>`, `<img>` or `<div>`. GridLayer will handle creating and animating these DOM elements for you.
 *
 * To create a custom layer, extend GridLayer and implement the `createTile()` method, which will be
 * passed a `Point` object with the `x`, `y`, and `z` (zoom level) coordinates to draw your tile.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords){
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // get a canvas context and draw something on it using coords.x, coords.y and coords.z
 *         var ctx = tile.getContext('2d');
 *
 *         // return the tile so it can be rendered on screen
 *         return tile;
 *     }
 * });
 * ```
 *
 * Tile creation can also be asynchronous, this is useful when using a third-party drawing library.
 * Once the tile is finished drawing it can be passed to the `done()` callback.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords, done){
 *         var error;
 *
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // draw something asynchronously and pass the tile to the done() callback
 *         setTimeout(function() {
 *             done(error, tile);
 *         }, 1000);
 *
 *         return tile;
 *     }
 * });
 * ```
 */
export abstract class GridLayer extends Layer {

	declare options: GridLayerOptions;

	/** DOM element that contains the tiles for this layer. */
	_container: HTMLElement | undefined;
	_tileZoom: number | undefined;
	_levels: Dict<LevelModel> = {};
	_tiles: Dict<TileModel> = {};
	_onOpaqueTile: (tile: TileModel) => void = Util.falseFn;
	_onUpdateLevel: (levelID: number) => void = Util.falseFn;
	_onRemoveLevel: (levelID: number) => void = Util.falseFn;
	_onCreateLevel: (level: LevelModel) => void = Util.falseFn;
	_noPrune = false;
	_loading = false;
	_onMove: (() => void) | undefined;
	_fadeFrame = 0;
	_globalTileRange: Bounds | undefined;
	_level: any; // TODO
	_wrapX: any; // TODO
	_wrapY: any; // TODO

	constructor(options?: Partial<GridLayerOptions>) {
		super();

		Util.setOptions(this, options, {
			tileSize: 256,
			opacity: 1,
			updateWhenIdle: Browser.mobile,
			updateWhenZooming: true,
			updateInterval: 200,
			zIndex: 1,
			bounds: undefined,
			minZoom: 0,
			maxZoom: undefined,
			maxNativeZoom: undefined,
			minNativeZoom: undefined,
			noWrap: false,
			pane: 'tile',
			className: '',
			keepBuffer: 2
		});
	}

	// Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
	// is specified, it must be called when the tile has finished loading and drawing.
	abstract createTile(_coords: Point, done?: DoneFn): HTMLElement;

	_abortLoading?(): void;

	onAdd(_map: Map): this {
		this._initContainer();
		this._levels = {};
		this._tiles = {};
		this._resetView(); // implicit _update() call

		return this;
	}

	onRemove(map: Map): void {
		this._removeAllTiles();
		this._container!.remove(); // TODO: null safety
		this._container = undefined;
		this._tileZoom = undefined;
	}

	// Brings the tile layer to the top of all tile layers.
	bringToFront(): this {
		if (this._map) {
			DomUtil.toFront(this._container!); // TODO: null safety
			this._setAutoZIndex(Math.max);
		}
		return this;
	}

	// Brings the tile layer to the bottom of all tile layers.
	bringToBack(): this {
		if (this._map) {
			DomUtil.toBack(this._container!); // TODO: null safety
			this._setAutoZIndex(Math.min);
		}
		return this;
	}

	// Returns the HTML element that contains the tiles for this layer.
	getContainer(): HTMLElement | undefined {
		return this._container;
	}

	// Changes the [opacity](#gridlayer-opacity) of the grid layer.
	setOpacity(opacity: number): this {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	}

	// Changes the [zIndex](#gridlayer-zindex) of the grid layer.
	setZIndex(zIndex: number): this {
		this.options.zIndex = zIndex;
		this._updateZIndex();
		return this;
	}

	// Returns `true` if any tile in the grid layer has not finished loading.
	isLoading(): boolean {
		return this._loading;
	}

	// Causes the layer to clear all the tiles and request them again.
	redraw(): this {
		if (this._map) {
			this._removeAllTiles();
			const tileZoom = this._clampZoom(this._map._zoom);
			if (tileZoom !== this._tileZoom) {
				this._tileZoom = tileZoom;
				this._updateLevels();
			}
			this._update();
		}
		return this;
	}

	getEvents(): HandlerMap {
		const events: HandlerMap = {
			viewprereset: this._invalidateAll,
			viewreset: this._resetView,
			zoom: this._resetView,
			moveend: this._onMoveEnd
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			this._onMove ||= Util.throttle(this._onMoveEnd, this.options.updateInterval, this);

			events.move = this._onMove;
		}

		if (this._map!._zoomAnimated) { // TODO: null safety
			events.zoomanim = this._animateZoom;
		}

		return events;
	}

	// Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
	getTileSize(): Point {
		const s = this.options.tileSize;
		return s instanceof Point ? s : new Point(s, s);
	}

	_updateZIndex(): void {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex as any; // automatically coerced to string
		}
	}

	_setAutoZIndex(compare: (a: number, b: number) => number): void {
		// go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)
		const layers = this.getPane()!.children; // TODO: null safety

		let edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (let i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = (layers[i] as HTMLElement).style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	}

	_updateOpacity(): void {
		if (!this._map) { return; }

		// TODO: null safety
		this._container!.style.opacity = this.options.opacity as any; // automatically coerced to string

		const now = Date.now();
		let nextFrame = false,
		    willPrune = false;

		for (const tile of Object.values(this._tiles)) {
			if (!tile.current || !tile.loaded) { continue; }

			const fade = Math.min(1, (now - tile.loaded) / 200);

			tile.el.style.opacity = fade as any; // automatically coerced to string

			if (fade < 1) {
				nextFrame = true;
			} else {
				if (tile.active) {
					willPrune = true;
				} else {
					this._onOpaqueTile(tile);
				}
				tile.active = true;
			}
		}

		if (willPrune && !this._noPrune) { this._pruneTiles(); }

		if (nextFrame) {
			cancelAnimationFrame(this._fadeFrame);
			this._fadeFrame = requestAnimationFrame(() => this._updateOpacity());
		}
	}

	_initContainer(): void {
		if (this._container) { return; }

		this._container = DomUtil.create('div', `leaflet-layer ${this.options.className || ''}`);
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		// TODO: null safety
		this.getPane()!.appendChild(this._container);
	}

	_updateLevels() { // TODO: return type?
		const
			zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		if (zoom === undefined) { return undefined; }

		for (let [_z, level] of Object.entries(this._levels)) {
			const z = Number(_z);
	
			if (level.el.children.length || z === zoom) {
				// TODO: null safety for maxZoom
				level.el.style.zIndex = (maxZoom! - Math.abs(zoom - z)) as any; // automatically coerced to string
				this._onUpdateLevel(z);
			} else {
				level.el.remove();
				this._removeTilesAtZoom(z);
				this._onRemoveLevel(z);
				delete this._levels[z];
			}
		}

		let level = this._levels[zoom];
		const map = this._map!; // TODO: null safety

		if (!level) {
			level = this._levels[zoom] = {
				el: DomUtil.create('div', 'leaflet-tile-container leaflet-zoom-animated', this._container),
				origin: map.project(map.unproject(map.getPixelOrigin()), zoom).round(),
				zoom,
			};
			level.el.style.zIndex = maxZoom as any; // will be coerced to string safely

			this._setZoomTransform(level, map.getCenter(), map._zoom);

			// force reading offsetWidth so the browser considers the newly added element for transition
			(Util.falseFn as any)(level.el.offsetWidth);

			this._onCreateLevel(level);
		}

		this._level = level;

		return level;
	}

	_pruneTiles(): void {
		if (!this._map) {
			return;
		}

		const zoom = this._map._zoom;
		if (zoom > this.options.maxZoom! || // TODO: null safety
			zoom < this.options.minZoom) {
			this._removeAllTiles();
			return;
		}

		for (const tile of Object.values(this._tiles)) {
			tile.retain = tile.current;
		}

		for (const tile of Object.values(this._tiles)) {
			if (tile.current && !tile.active) {
				const coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z!, coords.z! - 5)) { // TODO: null safety
					this._retainChildren(coords.x, coords.y, coords.z!, coords.z! + 2); // TODO: null safety
				}
			}
		}

		for (const [key, tile] of Object.entries(this._tiles)) {
			if (!tile.retain) {
				this._removeTile(key);
			}
		}
	}

	_removeTilesAtZoom(zoom: number): void {
		for (const key in this._tiles) {
			if (this._tiles[key].coords.z !== zoom) {
				continue;
			}
			this._removeTile(key);
		}
	}

	_removeAllTiles(): void {
		for (const key of Object.keys(this._tiles)) {
			this._removeTile(key);
		}
	}

	_invalidateAll(): void {
		for (const [z, level] of Object.entries(this._levels)) {
			level.el.remove();
			this._onRemoveLevel(Number(z));
			delete this._levels[z];
		}

		this._removeAllTiles();
		this._tileZoom = undefined;
	}

	_retainParent(x: number, y: number, z: number, minZoom: number): boolean {
		const x2 = Math.floor(x / 2),
		    y2 = Math.floor(y / 2),
		    z2 = z - 1,
		    coords2 = new Point(+x2, +y2);
		coords2.z = +z2;

		const
			key = this._tileCoordsToKey(coords2),
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, minZoom);
		}

		return false;
	}

	_retainChildren(x: number, y: number, z: number, maxZoom: number): void {
		for (let i = 2 * x; i < 2 * x + 2; i++) {
			for (let j = 2 * y; j < 2 * y + 2; j++) {

				const coords = new Point(i, j);
				coords.z = z + 1;

				const key = this._tileCoordsToKey(coords),
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, maxZoom);
				}
			}
		}
	}

	_resetView(e?: any): void {
		const animating = e && (e.pinch || e.flyTo);
		// TODO: null safety
		this._setView(this._map!.getCenter(), this._map!._zoom, animating, animating);
	}

	_animateZoom(e: any): void {
		this._setView(e.center, e.zoom, true, e.noUpdate);
	}

	_clampZoom(zoom: number): number {
		const options = this.options;

		if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
			return options.minNativeZoom;
		}

		if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
			return options.maxNativeZoom;
		}

		return zoom;
	}

	_setView(center: LatLng, zoom: number, noPrune?: boolean, noUpdate?: boolean): void {
		let tileZoom: number | undefined = Math.round(zoom);
		if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
		    (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
			tileZoom = undefined;
		} else {
			tileZoom = this._clampZoom(tileZoom);
		}

		const tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

		if (!noUpdate || tileZoomChanged) {

			this._tileZoom = tileZoom;

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._updateLevels();
			this._resetGrid();

			if (tileZoom !== undefined) {
				this._update(center);
			}

			if (!noPrune) {
				this._pruneTiles();
			}

			// Flag to prevent _updateOpacity from pruning tiles during
			// a zoom anim or a pinch gesture
			this._noPrune = !!noPrune;
		}

		this._setZoomTransforms(center, zoom);
	}

	_setZoomTransforms(center: LatLng, zoom: number) {
		for (const level of Object.values(this._levels)) {
			this._setZoomTransform(level, center, zoom);
		}
	}

	_setZoomTransform(level: LevelModel, center: LatLng, zoom: number): void {
		const
			scale = this._map!.getZoomScale(zoom, level.zoom), // TODO: null safety
		    translate = level.origin.multiplyBy(scale).subtract(
				this._map!._getNewPixelOrigin(center, zoom) // TODO: null safety
			).round();

		DomUtil.setTransform(level.el, translate, scale);
	}

	_resetGrid() {
		const
			map = this._map!, // TODO: null safety
		    crs = map.options.crs,
		    tileSize = this.getTileSize(),
		    tileZoom = this._tileZoom,
			bounds = map.getPixelWorldBounds(this._tileZoom);

		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && !this.options.noWrap && [
			Math.floor(map.project(new LatLng(0, crs.wrapLng[0]), tileZoom).x / tileSize.x),
			Math.ceil(map.project(new LatLng(0, crs.wrapLng[1]), tileZoom).x / tileSize.y)
		];
		this._wrapY = crs.wrapLat && !this.options.noWrap && [
			Math.floor(map.project(new LatLng(crs.wrapLat[0], 0), tileZoom).y / tileSize.x),
			Math.ceil(map.project(new LatLng(crs.wrapLat[1], 0), tileZoom).y / tileSize.y)
		];
	}

	_onMoveEnd(): void {
		if (!this._map || this._map._animatingZoom) { return; }

		this._update();
	}

	_getTiledPixelBounds(center: LatLng): Bounds {
		const
			map = this._map!, // TODO: null safety
		    mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map._zoom) : map._zoom,
		    scale = map.getZoomScale(mapZoom, this._tileZoom),
		    pixelCenter = map.project(center, this._tileZoom).floor(),
		    halfSize = map.getSize().divideBy(scale * 2);

		return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
	}

	// Private method to load tiles in the grid's active zoom level according to map bounds
	_update(center?: LatLng): void {
		const map = this._map;
		if (!map) { return; }
		const zoom = this._clampZoom(map._zoom);

		center ||= map.getCenter();
		if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		const
			pixelBounds = this._getTiledPixelBounds(center),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    tileCenter = tileRange.getCenter(),
		    queue = [],
		    margin = this.options.keepBuffer,
		    noPruneRange = new Bounds(
				tileRange.getBottomLeft().subtract(new Point(margin, -margin)),
				tileRange.getTopRight().add(new Point(margin, -margin)),
			);

		// Sanity check: panic if the tile range contains Infinity somewhere.
		if (!(isFinite(tileRange.min.x) &&
		      isFinite(tileRange.min.y) &&
		      isFinite(tileRange.max.x) &&
		      isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		for (const tile of Object.values(this._tiles)) {
			const c = tile.coords;
			
			if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
				tile.current = false;
			}
		}

		// _update just loads more tiles. If the tile zoom level differs too much
		// from the map's, let _setView reset levels and prune old tiles.
		if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		// create a queue of coordinates to load tiles from
		for (let j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (let i = tileRange.min.x; i <= tileRange.max.x; i++) {
				const coords = new Point(i, j);
				coords.z = this._tileZoom;

				if (!this._isValidTile(coords)) { continue; }

				const tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tile) {
					tile.current = true;
				} else {
					queue.push(coords);
				}
			}
		}

		// sort tile queue to load tiles in order of their distance to center
		queue.sort((a, b) => a.distanceTo(tileCenter) - b.distanceTo(tileCenter));

		if (queue.length !== 0) {
			// if it's the first batch of tiles to load
			if (!this._loading) {
				this._loading = true;
				// @event loading: Event
				// Fired when the grid layer starts loading tiles.
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			const fragment = document.createDocumentFragment();

			for (let i = 0; i < queue.length; i++) {
				this._addTile(queue[i], fragment);
			}

			this._level.el.appendChild(fragment);
		}
	}

	_isValidTile(coords: Point): boolean {
		const crs = this._map!.options.crs; // TODO: null safety

		if (!crs.infinite) {
			// don't load tile if it's out of bounds and not wrapped
			const bounds = this._globalTileRange!; // TODO: null safety
			if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
			    (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
		}

		if (!this.options.bounds) { return true; }

		// don't load tile if it doesn't intersect the bounds in options
		const tileBounds = this._tileCoordsToBounds(coords);

		// TODO: fix types and remove type assertion
		return (this.options.bounds as LatLngBounds).overlaps(tileBounds);
	}

	_keyToBounds(key: string): LatLngBounds {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	}

	_tileCoordsToNwSe(coords: Point): [LatLng, LatLng] {
		const
			map = this._map!, // TODO: null safety
		    tileSize = this.getTileSize(),
		    nwPoint = coords.scaleBy(tileSize),
		    sePoint = nwPoint.add(tileSize),
		    nw = map.unproject(nwPoint, coords.z),
		    se = map.unproject(sePoint, coords.z);
		return [nw, se];
	}

	// converts tile coordinates to its geographical bounds
	_tileCoordsToBounds(coords: Point): LatLngBounds {
		const bp = this._tileCoordsToNwSe(coords);
		let bounds = new LatLngBounds(bp[0], bp[1]);

		if (!this.options.noWrap) {
			// TODO: null safety
			bounds = this._map!.wrapLatLngBounds(bounds);
		}

		return bounds;
	}

	// converts tile coordinates to key for the tile cache
	_tileCoordsToKey(coords: Point): string {
		return `${coords.x}:${coords.y}:${coords.z}`;
	}

	// converts tile cache key to coordinates
	_keyToTileCoords(key: string) {
		const
			[x, y, z] = key.split(':'),
		    coords = new Point(+x, +y);
		coords.z = +z;
		return coords;
	}

	_removeTile(key: string): void {
		const tile = this._tiles[key];
		if (!tile) { return; }

		tile.el.remove();

		delete this._tiles[key];

		// @event tileunload: TileEvent
		// Fired when a tile is removed (e.g. when a tile goes off the screen).
		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	}

	_initTile(tile: HTMLElement): void {
		const tileSize = this.getTileSize();

		tile.classList.add('leaflet-tile');
		tile.style.width = `${tileSize.x}px`;
		tile.style.height = `${tileSize.y}px`;
		tile.onselectstart = Util.falseFn;
		tile.onmousemove = Util.falseFn;
	}

	_addTile(coords: Point, container: Node): void {
		const
			tilePos = this._getTilePos(coords),
		    key = this._tileCoordsToKey(coords),
			tile = this.createTile(this._wrapCoords(coords), this._tileReady.bind(this, coords));

		this._initTile(tile);

		// if createTile is defined with a second argument ("done" callback),
		// we know that tile is async and will be ready later; otherwise
		if (this.createTile.length < 2) {
			// mark tile as ready, but delay one frame for opacity animation to happen
			requestAnimationFrame(() => this._tileReady(coords, null, tile));
		}

		DomUtil.setPosition(tile, tilePos);

		// save tile in cache
		this._tiles[key] = {
			el: tile,
			coords,
			current: true,
			loaded: 0,
			active: false,
			retain: false,
		};

		container.appendChild(tile);

		// @event tileloadstart: TileEvent
		// Fired when a tile is requested and starts loading.
		this.fire('tileloadstart', {
			tile,
			coords
		});
	}

	_tileReady(coords: Point, err: unknown /* TODO */, _tile?: HTMLElement): void {
		if (err) {
			// @event tileerror: TileErrorEvent
			// Fired when there is an error loading a tile.
			this.fire('tileerror', {
				error: err,
				tile: _tile,
				coords
			});
		}

		const key = this._tileCoordsToKey(coords);
		const tile = this._tiles[key];

		if (!tile) { return; }

		tile.loaded = Date.now();

		// TODO: null safety
		if (this._map!.options.fadeAnimation) {
			tile.el.style.opacity = 0 as any; // automatically coerced to string
			cancelAnimationFrame(this._fadeFrame);
			this._fadeFrame = requestAnimationFrame(() => this._updateOpacity());
		} else {
			tile.active = true;
			this._pruneTiles();
		}

		if (!err) {
			tile.el.classList.add('leaflet-tile-loaded');

			// @event tileload: TileEvent
			// Fired when a tile loads.
			this.fire('tileload', {
				tile: tile.el,
				coords
			});
		}

		if (this._noTilesToLoad()) {
			this._loading = false;
			// @event load: Event
			// Fired when the grid layer loaded all visible tiles.
			this.fire('load');

			if (!this._map!.options.fadeAnimation) { // TODO: null safety
				requestAnimationFrame(() => this._pruneTiles());
			} else {
				// Wait a bit more than 0.2 secs (the duration of the tile fade-in)
				// to trigger a pruning.
				setTimeout(this._pruneTiles.bind(this), 250);
			}
		}
	}

	_getTilePos(coords: Point): Point {
		return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
	}

	_wrapCoords(coords: Point): Point {
		const newCoords = new Point(
			this._wrapX ? Util.wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? Util.wrapNum(coords.y, this._wrapY) : coords.y,
		);
		newCoords.z = coords.z;
		return newCoords;
	}

	_pxBoundsToTileRange(bounds: Bounds): Bounds {
		const tileSize = this.getTileSize();
		return new Bounds(
			bounds.min.unscaleBy(tileSize).floor(),
			bounds.max.unscaleBy(tileSize).ceil().subtract(new Point(1, 1)),
		);
	}

	_noTilesToLoad(): boolean {
		// TODO: use for-in for less memory consumption?
		return Object.values(this._tiles).every(tile => tile.loaded);
	}

}
