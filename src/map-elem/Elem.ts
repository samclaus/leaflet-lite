import type { Disposable, HandlerMap } from '../core';
import type { Map, ZoomAnimationEvent } from '../map';

/**
 * @private Don't use this API. It is only intended to be used internally by Leaflet Lite
 * and may be removed in the near future.
 */
export abstract class Elem<El extends HTMLElement | SVGSVGElement> implements Disposable {

	/**
	 * This field exists purely for the application's use. Leaflet Lite does not use
	 * read or write to it. It should generally be used to associate app-specific IDs
	 * with Leaflet elements for the sake of event handling.
	 * 
	 * For example, let's say you load a list of restaurants from your server, as a
	 * JSON array. Each restaurant has a randomly generated string ID for referencing
	 * it in the database on the server. Your application JavaScript can loop over the
	 * array of restaurant objects (JSON), creating a marker on the map for each one,
	 * but also setting the 'data' field to the restaurant ID. Then, when Leaflet tells
	 * you that a marker was clicked, you can grab the restaurant ID from the 'data'
	 * field of the marker associated with the event, and pull some additional info
	 * about the restaurant from your server to show in a pop-up UI.
	 */
	data: any;

	_disposed = false;
	_events: HandlerMap | undefined;

	constructor(
		public _map: Map,
		public _el: El,
		pane: string,
		interactive: boolean,
	) {
		if (this._mapEvents) {
			this._events = this._mapEvents();
			_map.on(this._events, this);
		}
		if (_map._zoomAnimated) {
			_el.classList.add('leaflet-zoom-animated')
			_map.on('zoomanim', this._animateZoom, this);
		}
		if (interactive) {
			_el.classList.add('leaflet-interactive');
		}

		this._init();

		_map._targets.set(_el, this);
		_map.pane(pane).appendChild(_el);
	}

	/**
	 * This optional method should return an object like `{ viewreset: this._reset }` for
	 * [`on`](#evented-on). The event handlers in this object will be automatically added
	 * and removed from the map with your layer.
	 */
	_mapEvents?(): HandlerMap;

	/**
	 * Should contain code that creates DOM elements for the layer, adds them to `map panes`
	 * where they should belong and puts listeners on relevant map events. Called on
	 * [`map.addLayer(layer)`](#map-addlayer).
	 */
	abstract _init(): void;

	/**
	 * Should contain all clean up code that removes the layer's elements from the DOM and
	 * removes listeners previously added in [`onAdd`](#layer-onadd). Called on
	 * [`map.removeLayer(layer)`](#map-removelayer).
	 */
	_deinit?(): void;

	/**
	 * Handler for `'zoomanim'` events from the map. Will only be called if map zoom
	 * animations are enabled.
	 */
	abstract _animateZoom(ev: ZoomAnimationEvent): void;

	dispose(): void {
		if (!this._disposed) {
			const { _map, _el } = this;

			if (this._events) {
				_map.off(this._events, this);
			}
			if (_map._zoomAnimated) {
				_map.off('zoomanim', this._animateZoom, this);
			}

			_el.remove();
			_map._targets.delete(_el);
			this._deinit?.();
			this._map = undefined as any;
			this._el = undefined as any;
			this._events = undefined;
			this._disposed = true;
		}
	}

}
