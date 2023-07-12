import { Browser, Util } from '../../core';
import { DomEvent } from '../../dom';
import type { Point } from '../../geom';
import { GridLayer, type DoneFn, type GridLayerOptions } from './GridLayer.js';

export interface TileLayerOptions extends GridLayerOptions {
	/**
	 * Subdomains of the tile service. Can be passed in the form of one
	 * string (where each letter is a subdomain name) or an array of
	 * strings. 'abc' by default.
	 */
	subdomains: string | string[];
	/**
	 * If specified, URL to the tile image to show in place of the tile
	 * that failed to load.
	 */
	errorTileUrl: string;
	/**
	 * The zoom number used in tile URLs will be offset with this value.
	 * 0 by default.
	 */
	zoomOffset: number;
	/**
	 * If `true`, inverses Y axis numbering for tiles (turn this on for
	 * [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) services).
	 * False by default.
	 */
	tms: boolean;
	/**
	 * If set to true, the zoom number used in tile URLs will be reversed
	 * (`maxZoom - zoom` instead of `zoom`). False by default.
	 */
	zoomReverse: boolean;
	/**
	 * If `true` and user is on a retina display, it will request four tiles
	 * of half the specified size and a bigger zoom level in place of one to
	 * utilize the high resolution. False by default.
	 */
	detectRetina: boolean;
	/**
	 * Whether the crossOrigin attribute will be added to the tiles. If a
	 * string is provided, all tiles will have their crossOrigin attribute set
	 * to the string provided. This is needed if you want to access tile pixel
	 * data. Refer to
	 * [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)
	 * for possible values.
	 */
	crossOrigin: string | undefined;
	/**
	 * Whether the referrerPolicy attribute will be added to the tiles. If a
	 * string is provided, all tiles will have their referrerPolicy attribute
	 * set to the string provided. This may be needed if your map's rendering
	 * context has a strict default but your tile provider expects a valid
	 * referrer (e.g. to validate an API token). Refer to
	 * [HTMLImageElement.referrerPolicy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy)
	 * for possible values.
	 */
	referrerPolicy: string | undefined;
}

/**
 * Used to load and display tile layers on the map. Note that most tile servers require attribution!
 * Extends `GridLayer`.
 *
 * ```js
 * // REMEMBER: your application would need to attribute Open Street Map for this example!
 * L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}').addTo(map);
 * ```
 *
 * A string of the following form:
 *
 * ```
 * 'https://{s}.somedomain.com/blabla/{z}/{x}/{y}{r}.png'
 * ```
 *
 * `{s}` means one of the available subdomains (used sequentially to help with browser parallel requests per domain limitation; subdomain values are specified in options; `a`, `b` or `c` by default, can be omitted), `{z}` — zoom level, `{x}` and `{y}` — tile coordinates. `{r}` can be used to add "&commat;2x" to the URL to load retina tiles.
 *
 * You can use custom keys in the template, which will be [evaluated](#util-template) from TileLayer options, like this:
 *
 * ```
 * L.tileLayer('https://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
 * ```
 */
export class TileLayer extends GridLayer {

	declare options: TileLayerOptions;

	constructor(
		public _url: string,
		options?: Partial<TileLayerOptions>,
	) {
		super(options);

		const opts = Util.setOptions(this, options, {
			minZoom: 0,
			maxZoom: 18,
			subdomains: 'abc',
			errorTileUrl: '',
			zoomOffset: 0,
			tms: false,
			zoomReverse: false,
			detectRetina: false,
			crossOrigin: undefined,
			referrerPolicy: undefined,
		}) as any; // TODO

		// detecting retina displays, adjusting tileSize and zoom levels
		if (opts.detectRetina && Browser.retina && opts.maxZoom > 0) {

			opts.tileSize = Math.floor(opts.tileSize / 2);

			if (!opts.zoomReverse) {
				opts.zoomOffset++;
				opts.maxZoom = Math.max(opts.minZoom, opts.maxZoom - 1);
			} else {
				opts.zoomOffset--;
				opts.minZoom = Math.min(opts.maxZoom, opts.minZoom + 1);
			}

			opts.minZoom = Math.max(0, opts.minZoom);
		} else if (!opts.zoomReverse) {
			// make sure maxZoom is gte minZoom
			opts.maxZoom = Math.max(opts.minZoom, opts.maxZoom);
		} else {
			// make sure minZoom is lte maxZoom
			opts.minZoom = Math.min(opts.maxZoom, opts.minZoom);
		}

		if (typeof opts.subdomains === 'string') {
			opts.subdomains = opts.subdomains.split('');
		}

		this.on('tileunload', this._onTileRemove);
	}

	// Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
	// If the URL does not change, the layer will not be redrawn unless
	// the noRedraw parameter is set to false.
	setUrl(url: string, noRedraw?: boolean): this {
		if (this._url === url && noRedraw === undefined) {
			noRedraw = true;
		}

		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	}

	// Called only internally, overrides GridLayer's [`createTile()`](#gridlayer-createtile)
	// to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
	// callback is called when the tile has been loaded.
	createTile(coords: Point, done: DoneFn = Util.falseFn): HTMLImageElement {
		const tile = document.createElement('img');

		DomEvent.on(tile, 'load', this._tileOnLoad.bind(this, done, tile));
		DomEvent.on(tile, 'error', this._tileOnError.bind(this, done, tile));

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			tile.crossOrigin = this.options.crossOrigin;
		}

		// for this new option we follow the documented behavior
		// more closely by only setting the property when string
		if (typeof this.options.referrerPolicy === 'string') {
			tile.referrerPolicy = this.options.referrerPolicy;
		}

		// The alt attribute is set to the empty string,
		// allowing screen readers to ignore the decorative image tiles.
		// https://www.w3.org/WAI/tutorials/images/decorative/
		// https://www.w3.org/TR/html-aria/#el-img-empty-alt
		tile.alt = '';
		tile.src = this.getTileUrl(coords);

		return tile;
	}

	// Layers extending `TileLayer` might reimplement the following method.
	// Called only internally, returns the URL for a tile given its coordinates.
	// Classes extending `TileLayer` can override this function to provide custom tile URL naming schemes.
	getTileUrl(coords: Point): string {
		const data: Dict<any> = {
			r: Browser.retina ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: coords.y,
			z: this._getZoomForUrl()
		};
		if (this._map && !this._map.options.crs.infinite) {
			// TODO: null safety
			const invertedY = this._globalTileRange!.max.y - coords.y;
			if (this.options.tms) {
				data.y = invertedY;
			}
			data['-y'] = invertedY;
		}

		return Util.template(this._url, Object.assign(data, this.options));
	}

	_tileOnLoad(done: DoneFn, tile: HTMLImageElement): void {
		done(null, tile);
	}

	_tileOnError(done: DoneFn, tile: HTMLImageElement, e: any): void {
		const errorUrl = this.options.errorTileUrl;
		if (errorUrl && tile.src !== errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	}

	_onTileRemove(e: any): void {
		e.tile.onload = null;
	}

	_getZoomForUrl(): number {
		let zoom = this._tileZoom!; // TODO: null safety

		const {maxZoom, zoomReverse, zoomOffset} = this.options;

		if (zoomReverse) {
			// TODO: null safety
			zoom = maxZoom! - zoom;
		}

		return zoom + zoomOffset;
	}

	_getSubdomain(tilePoint: Point): string {
		const index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	}

	// stops loading all tiles in the background layer
	_abortLoading(): void {
		let i, tile;
		for (i in this._tiles) {
			if (this._tiles[i].coords.z !== this._tileZoom) {
				tile = this._tiles[i].el as HTMLImageElement;

				tile.onload = Util.falseFn;
				tile.onerror = Util.falseFn;

				if (!tile.complete) {
					tile.src = Util.emptyImageUrl;
					const coords = this._tiles[i].coords;
					tile.remove();
					delete this._tiles[i];
					// @event tileabort: TileEvent
					// Fired when a tile was loading but is now not wanted.
					this.fire('tileabort', {
						tile,
						coords
					});
				}
			}
		}
	}

	_removeTile(key: string): void {
		const tile = this._tiles[key];
		if (!tile) { return; }

		// Cancels any pending http requests associated with the tile
		tile.el.setAttribute('src', Util.emptyImageUrl);

		return GridLayer.prototype._removeTile.call(this, key);
	}

	_tileReady(coords: Point, err: unknown /* TODO */, tile?: HTMLImageElement): void {
		if (!this._map || (tile && tile.src === Util.emptyImageUrl)) {
			return;
		}

		return GridLayer.prototype._tileReady.call(this, coords, err, tile);
	}

}
