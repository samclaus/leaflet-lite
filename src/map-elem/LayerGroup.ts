import { Util } from '../core';
import { LatLngBounds } from '../geog';
import { Layer } from '.';
import type { PathOptions } from './vector';
import type { Map } from '../map';

/**
 * Used to group several layers and handle them as one. If you add it to the map,
 * any layers added or removed from the group will be added/removed on the map as
 * well. Extends `Layer`.
 *
 *  - [`bindTooltip`](#layer-bindtooltip) binds a tooltip to all of the layers at once
 *  - Events are propagated to the `LayerGroup`, so if the group has an event
 * handler, it will handle events from any of the layers. This includes mouse events
 * and custom events.
 *  - Has `layeradd` and `layerremove` events
 *
 * ```js
 * const lg = new LayerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.bindTooltip('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); });
 * 
 * map.addLayer(lg);
 * ```
 * @event layeradd: LayerEvent
 * Fired when a layer is added to this `LayerGroup`
 * 
 * @event layerremove: LayerEvent
 * Fired when a layer is removed from this `LayerGroup`
 */
export class LayerGroup extends Layer {

	_layers: { [leafletID: string]: Layer } = {};

	constructor(layers: Layer[], options?: any) {
		super();

		Util.setOptions(this, options);

		this._isLayerGroup = true;

		for (const layer of layers) {
			this._layers[Util.stamp(layer)] = layer;
		}
	}

	onAdd(map: Map): this {
		return this.eachLayer(map.addLayer, map);
	}

	onRemove(map: Map): void {
		this.eachLayer(map.removeLayer, map);
	}

	_addFocusListeners(): void {
		this.eachLayer(this._addFocusListenersOnLayer, this);
	}

	_setAriaDescribedBy(): void {
		this.eachLayer(this._setAriaDescribedByOnLayer, this);
	}

	/**
	 * Adds the given layer to the group. Does nothing if the layer is already
	 * a member of this group.
	 */
	addLayer(layer: Layer): this {
		const id = Util.stamp(layer);

		if (id in this._layers) {
			return this;
		}

		layer.addEventParent(this);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this.fire('layeradd', { layer });
	}

	/**
	 * Removes the given layer (or layer ID) from the group. Does nothing if the
	 * given layer is not a member of this group.
	 */
	removeLayer(layerOrID: number | Layer): this {
		const
			id = typeof layerOrID === 'number' ? layerOrID : Util.stamp(layerOrID),
			layer = this._layers[id];

		// NOTE: we care that the layer was registered in this LayerGroup's map,
		// not just that we can get ahold of a proper Layer object
		if (!layer) {
			return this;
		}

		layer.removeEventParent(this);

		if (this._map) {
			this._map.removeLayer(layer);
		}

		delete this._layers[id];

		return this.fire('layerremove', { layer });
	}

	// Returns `true` if the given layer (or layer ID) is currently added to the group.
	hasLayer(layer: number | Layer): boolean {
		const id = typeof layer === 'number' ? layer : Util.stamp(layer);
		return id in this._layers;
	}

	// Removes all the layers from the group.
	clearLayers(): this {
		return this.eachLayer(this.removeLayer, this);
	}

	/**
	 * Iterates over the layers of the group, optionally specifying context
	 * of the iterator function.
	 *
	 * ```
	 * group.eachLayer(function(layer){
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

	// Returns the layer with the given internal ID.
	getLayer(id: number): Layer | undefined {
		return this._layers[id];
	}

	// Returns an array of all the layers added to the group.
	getLayers(): Layer[] {
		return Object.values(this._layers);
	}

	// Calls `methodName` on every layer contained in this group, passing any
	// additional parameters. Has no effect if the layers contained do not
	// implement `methodName`.
	invoke(methodName: string, ...args: readonly any[]): this {
		for (const layer of Object.values(this._layers)) {
			(layer as any)[methodName]?.apply(layer, args);
		}
		return this;
	}

	// Calls `setZIndex` on every layer contained in this group, passing the z-index.
	setZIndex(zIndex: number): this {
		return this.invoke('setZIndex', zIndex);
	}

	// Sets the given path options to each layer of the group that has a `setStyle` method.
	setStyle(style: Partial<PathOptions>): this {
		return this.invoke('setStyle', style);
	}

	// Brings the layer group to the top of all other layers
	bringToFront(): this {
		return this.invoke('bringToFront');
	}

	// Brings the layer group to the back of all other layers
	bringToBack(): this {
		return this.invoke('bringToBack');
	}

	// Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
	getBounds(): LatLngBounds {
		const bounds = new LatLngBounds();

		for (
			const layer of Object.values(this._layers)
		) {
			if (layer.getBounds) {
				bounds.extend(layer.getBounds());
			} else if (layer.getLatLng) {
				bounds.extend(layer.getLatLng());
			}
		}

		return bounds;
	}

}
