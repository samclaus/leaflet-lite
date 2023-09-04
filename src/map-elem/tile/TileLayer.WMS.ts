import { Browser, Util } from '../../core';
import { EPSG4326, type CRS } from '../../geog/crs';
import { Bounds, type Point } from '../../geom';
import type { Map } from '../../map';
import { TileLayer, type TileLayerOptions } from './TileLayer.js';

export interface WMSParams {
	/**
	 * TODO: figure out what this is. 'WMS' by default.
	 */
	service: string;
	/**
	 * TODO: figure out what this is. 'GetMap' by default.
	 */
	request: string;
	/**
	 * Comma-separated list of WMS layers to show. REQUIRED.
	 */
	layers: string;
	/**
	 * Comma-separated list of WMS styles.
	 */
	styles: string;
	/**
	 * WMS image format (use 'image/png' for layers with transparency).
	 * 'image/jpeg' by default.
	 */
	format: 'image/jpeg',
	/**
	 * If `true`, the WMS service will return images with transparency.
	 */
	transparent: boolean;
	/**
	 * Version of the WMS service to use. '1.1.1' by default.
	 */
	version: string;
	/**
	 * If any custom options not documented here are used, they will be sent to the
	 * WMS server as extra parameters in each request URL. This can be useful for
	 * [non-standard vendor WMS parameters](https://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
	 */
	[param: string]: any;
}

export interface TileLayerWMSOptions extends TileLayerOptions {
	/**
	 * Coordinate Reference System to use for the WMS requests, defaults to
	 * map CRS. Don't change this if you're not sure what it means.
	 */
	crs: CRS | undefined;
	/**
	 * If true, WMS request parameter keys will be uppercase. False by default.
	 */
	uppercase: boolean;
	/**
	 * Parameters to be used when communicating with the Web Map Service (WMS).
	 */
	wmsParams: WMSParams | undefined;
}

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

	declare options: TileLayerWMSOptions;

	_crs!: CRS; // TODO
	wmsParams: WMSParams; // TODO
	_wmsVersion: any; // TODO

	// TODO: type for the options
	constructor(
		url: string,
		options?: Partial<TileLayerWMSOptions>,
	) {
		super(url, options);

		const wmsParams: WMSParams = {
			service: 'WMS',
			request: 'GetMap',
			layers: '',
			styles: '',
			format: 'image/jpeg',
			transparent: false,
			version: '1.1.1',
			...options?.wmsParams,
		};

		options = Util.setOptions(this, options, {
			crs: undefined,
			uppercase: false,
		});

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
	setParams(params: Partial<WMSParams>, noRedraw?: boolean): this {
		Object.assign(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}

}
