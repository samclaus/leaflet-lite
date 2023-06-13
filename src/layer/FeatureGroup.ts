import { LatLngBounds } from '../geog';
import type { Layer } from './Layer.js';
import { LayerGroup } from './LayerGroup.js';
import type { PathOptions } from './vector';

/**
 * Extended `LayerGroup` that makes it easier to do the same thing to all its member layers:
 *  - [`bindTooltip`](#layer-bindtooltip) binds a tooltip to all of the layers at once
 *  - Events are propagated to the `FeatureGroup`, so if the group has an event
 * handler, it will handle events from any of the layers. This includes mouse events
 * and custom events.
 *  - Has `layeradd` and `layerremove` events
 *
 * ```js
 * L.featureGroup([marker1, marker2, polyline])
 * 	.bindTooltip('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); })
 * 	.addTo(map);
 * ```
 */
export class FeatureGroup extends LayerGroup {

	addLayer(layer: Layer): this {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// Fired when a layer is added to this `FeatureGroup`
		return this.fire('layeradd', {layer});
	}

	removeLayer(layer: number | Layer): this {
		if (!this.hasLayer(layer)) {
			return this;
		}

		// NOTE: will not throw at runtime even if it's an object; I will not
		// add extra runtime typechecking code just to satisfy TypeScript
		if ((layer as number) in this._layers) {
			layer = this._layers[layer as number];
		}

		(layer as Layer).removeEventParent(this);

		LayerGroup.prototype.removeLayer.call(this, layer);

		// @event layerremove: LayerEvent
		// Fired when a layer is removed from this `FeatureGroup`
		return this.fire('layerremove', {layer});
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
