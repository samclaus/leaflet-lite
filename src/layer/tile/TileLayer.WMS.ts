import { Browser, Util } from '../../core';
import { EPSG4326 } from '../../geog/crs';
import { Bounds, type Point } from '../../geom';
import type { Map } from '../../map';
import { TileLayer } from './TileLayer.js';

/**
 * Used to display [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services as
 * tile layers on the map. Extends `TileLayer`.
 *
 * ```js
 * // Don't forget you would need to show an attribution like 'Weather data © 2012 IEM Nexrad'
 * // near or within the map UI of your application!
 * var nexrad = L.tileLayer.wms('http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
 * 	layers: 'nexrad-n0r-900913',
 * 	format: 'image/png',
 * 	transparent: true,
 * });
 * ```
 */
export class TileLayerWMS extends TileLayer {

	// @section
	// @aka TileLayer.WMS options
	// If any custom options not documented here are used, they will be sent to the
	// WMS server as extra parameters in each request URL. This can be useful for
	// [non-standard vendor WMS parameters](https://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
	defaultWmsParams = {
		service: 'WMS',
		request: 'GetMap',

		// @option layers: String = ''
		// **(required)** Comma-separated list of WMS layers to show.
		layers: '',

		// @option styles: String = ''
		// Comma-separated list of WMS styles.
		styles: '',

		// @option format: String = 'image/jpeg'
		// WMS image format (use `'image/png'` for layers with transparency).
		format: 'image/jpeg',

		// @option transparent: Boolean = false
		// If `true`, the WMS service will return images with transparency.
		transparent: false,

		// @option version: String = '1.1.1'
		// Version of the WMS service to use
		version: '1.1.1'
	};

	options = {
		// @option crs: CRS = null
		// Coordinate Reference System to use for the WMS requests, defaults to
		// map CRS. Don't change this if you're not sure what it means.
		crs: null,

		// @option uppercase: Boolean = false
		// If `true`, WMS request parameter keys will be uppercase.
		uppercase: false
	};

	_crs: any; // TODO
	wmsParams: any; // TODO
	_wmsVersion: any; // TODO

	// TODO: type for the options
	constructor(url: string, options?: any) {
		super(url, options);

		const wmsParams: any = { ...this.defaultWmsParams };

		// all keys that are not TileLayer options go to WMS params
		for (const i in options) {
			if (!(i in this.options)) {
				wmsParams[i] = options[i];
			}
		}

		options = Util.setOptions(this, options);

		const realRetina = options.detectRetina && Browser.retina ? 2 : 1;
		const tileSize = this.getTileSize();
		wmsParams.width = tileSize.x * realRetina;
		wmsParams.height = tileSize.y * realRetina;

		this.wmsParams = wmsParams;
	}

	onAdd(map: Map): this {
		this._crs = this.options.crs || map.options.crs;
		this._wmsVersion = parseFloat(this.wmsParams.version);

		const projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		TileLayer.prototype.onAdd.call(this, map);

		return this;
	}

	getTileUrl(coords: Point): string {
		const
			tileBounds = this._tileCoordsToNwSe(coords),
		    crs = this._crs,
		    bounds = new Bounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])),
		    min = bounds.min,
		    max = bounds.max,
		    bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
		    [min.y, min.x, max.y, max.x] :
		    [min.x, min.y, max.x, max.y]).join(','),
		    url = TileLayer.prototype.getTileUrl.call(this, coords);

		return url +
			Util.getParamString(this.wmsParams, url, this.options.uppercase) +
			(this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
	}

	// Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
	setParams(params: any /* TODO */, noRedraw?: boolean): this {
		Object.assign(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}

}
