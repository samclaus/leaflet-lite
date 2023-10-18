import { Evented, Util, type HandlerMap } from '../core';
import type { LatLng, LatLngBounds } from '../geog';
import type { Map } from '../map';

export interface LayerOptions {
	/**
	 * By default the layer will be added to the map's [overlay pane](#map-overlaypane).
	 * Overriding this option will cause the layer to be placed on another pane by default.
	 */
	pane: string;
	/**
	 * TODO: document this.
	 */
	bubblingMouseEvents: boolean;
}

/**
 * A set of methods from the Layer base class that all Leaflet layers use.
 * Inherits all methods, options and events from `L.Evented`.
 *
 * ```js
 * const layer = L.marker(latlng);
 * map.addLayer(layer);
 * layer.remove();
 * ```
 *
 * @event add: Event
 * Fired after the layer is added to a map
 *
 * @event remove: Event
 * Fired after the layer is removed from a map
 */
export abstract class Layer extends Evented {

	options: LayerOptions = {
		pane: 'overlay',
		bubblingMouseEvents: true,
	};
	_map: Map | undefined;
	_zoomAnimated = false;

	/**
	 * Should contain code that creates DOM elements for the layer, adds them to `map panes`
	 * where they should belong and puts listeners on relevant map events. Called on
	 * [`map.addLayer(layer)`](#map-addlayer).
	 */
	abstract onAdd(map: Map): this;

	/**
	 * Should contain all clean up code that removes the layer's elements from the DOM and
	 * removes listeners previously added in [`onAdd`](#layer-onadd). Called on
	 * [`map.removeLayer(layer)`](#map-removelayer).
	 */
	abstract onRemove?(map: Map): void;

	setZIndex?(zIndex: number): void;

	/**
	 * This optional method should return an object like `{ viewreset: this._reset }` for
	 * [`on`](#evented-on). The event handlers in this object will be automatically added
	 * and removed from the map with your layer.
	 */
	getEvents?(): HandlerMap;

	getBounds?(): LatLngBounds;
	getLatLng?(): LatLng;
	getElement?(): HTMLElement;

	// Returns the `HTMLElement` representing the named pane on the map.
	getPane(): HTMLElement | undefined {
		return this._map?.pane(this.options.pane);
	}

	addInteractiveTarget(targetEl: HTMLElement): this {
		if (this._map) {
			this._map._targets[Util.stamp(targetEl)] = this;
		}
		return this;
	}

	removeInteractiveTarget(targetEl: HTMLElement): this {
		if (this._map) {
			delete this._map._targets[Util.stamp(targetEl)];
		}
		return this;
	}

}
