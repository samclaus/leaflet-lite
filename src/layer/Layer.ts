import { Evented, type HandlerMap } from '../core/Events.js';
import * as Util from '../core/Util.js';
import { Map } from '../map/Map.js';
import type { LayerGroup } from './LayerGroup.js';

/**
 * A set of methods from the Layer base class that all Leaflet layers use.
 * Inherits all methods, options and events from `L.Evented`.
 *
 * ```js
 * var layer = L.marker(latlng).addTo(map);
 * layer.addTo(map);
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

	// Classes extending `L.Layer` will inherit the following options:
	options = {
		// @option pane: String = 'overlayPane'
		// By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
		pane: 'overlayPane',

		// @option attribution: String = undefined
		// String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
		attribution: undefined,

		bubblingMouseEvents: true,
	};

	_mapToAdd: Map | undefined;
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
	abstract onRemove?(map: Map): this;

	setZIndex?(zIndex: number): void;

	/**
	 * This optional method should return an object like `{ viewreset: this._reset }` for
	 * [`on`](#evented-on). The event handlers in this object will be automatically added
	 * and removed from the map with your layer.
	 */
	getEvents?(): HandlerMap;

	/**
	 * Optional method. Called on [`map.addLayer(layer)`](#map-addlayer), before the layer is
	 * added to the map, before events are initialized, without waiting until the map is in a
	 * usable state. Use for early initialization only.
	 */
	beforeAdd?(map: Map): this;

	/**
	 * Adds the layer to the given map or layer group.
	 */
	addTo(map: Map | LayerGroup): this {
		map.addLayer(this);
		return this;
	}

	// Removes the layer from the map it is currently active on.
	remove(): this {
		return this.removeFrom(this._map || this._mapToAdd);
	}

	// Removes the layer from the given map or `LayerGroup`
	removeFrom(map: Map | LayerGroup | undefined): this {
		if (map) {
			map.removeLayer(this);
		}
		return this;
	}

	// Returns the `HTMLElement` representing the named pane on the map. If `name` is omitted, returns the pane for this layer.
	getPane(name?: string): HTMLElement | undefined {
		return this._map?.getPane(name ? ((this.options as any)[name] || name) : this.options.pane);
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

	// Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution).
	getAttribution(): string | undefined {
		return this.options.attribution;
	}

	_layerAdd(e: { readonly target: Map; }): void {
		const map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		if (this.getEvents) {
			const events = this.getEvents();
			map.on(events, this);
			this.on('remove', function () {
				map.off(events, this);
			}, this, true);
		}

		this.onAdd(map);
		this.fire('add');

		map.fire('layeradd', { layer: this });
	}

}
