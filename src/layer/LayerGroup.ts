import { Util } from '../core';
import type { Map } from '../map';
import { Layer } from './Layer.js';

/**
 * Used to group several layers and handle them as one. If you add it to the map,
 * any layers added or removed from the group will be added/removed on the map as
 * well. Extends `Layer`.
 *
 * ```js
 * L.layerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.addTo(map);
 * ```
 */
export class LayerGroup extends Layer {

	_layers: { [leafletID: string]: Layer } = {};

	constructor(layers: Layer[], options?: any) {
		super();

		Util.setOptions(this, options);

		let i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	}

	// Adds the given layer to the group.
	addLayer(layer: Layer): this {
		const id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	}

	// Removes the given layer (or layer ID) from the group.
	removeLayer(layer: number | Layer): this {
		const id = typeof layer === 'number' ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	}

	// Returns `true` if the given layer (or layer ID) is currently added to the group.
	hasLayer(layer: number | Layer): boolean {
		const layerId = typeof layer === 'number' ? layer : this.getLayerId(layer);
		return layerId in this._layers;
	}

	// Removes all the layers from the group.
	clearLayers(): this {
		return this.eachLayer(this.removeLayer, this);
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

	onAdd(map: Map): this {
		return this.eachLayer(map.addLayer, map);
	}

	onRemove(map: Map): void {
		this.eachLayer(map.removeLayer, map);
	}

	/**
	 * Iterates over the layers of the group, optionally specifying context of the iterator function.
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

	// Calls `setZIndex` on every layer contained in this group, passing the z-index.
	setZIndex(zIndex: number): this {
		return this.invoke('setZIndex', zIndex);
	}

	// Returns the internal ID for a layer
	getLayerId(layer: Layer): number {
		return Util.stamp(layer);
	}

}
