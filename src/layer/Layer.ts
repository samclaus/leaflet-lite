import type { LatLng, LatLngBounds } from '../Leaflet.js';
import { Evented, type HandlerMap } from '../core/Events.js';
import * as Util from '../core/Util.js';
import { Map } from '../map/Map.js';
import type { LayerGroup } from './LayerGroup.js';

export interface LayerOptions {
	// @option pane: String = 'overlayPane'
	// By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
	pane: string;

	// @option attribution: String = undefined
	// String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
	attribution: string | undefined;

	// TODO: document
	bubblingMouseEvents: boolean;
}

export const DEFAULT_LAYER_OPTIONS: Readonly<LayerOptions> = {
	// @option pane: String = 'overlayPane'
	// By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
	pane: 'overlayPane',

	// @option attribution: String = undefined
	// String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
	attribution: undefined,
	bubblingMouseEvents: true,
};

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

	getBounds?(): LatLngBounds;
	getLatLng?(): LatLng;

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

	// From DivOverlay

	_initOverlay(OverlayClass: any, old: any, content: any, options?: any): any {
		let overlay = content;
		if (overlay instanceof OverlayClass) {
			Util.setOptions(overlay, options);
			overlay._source = this;
		} else {
			overlay = (old && !options) ? old : new OverlayClass(options, this);
			overlay.setContent(content);
		}
		return overlay;
	}

// From Tooltip


	// @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
	// Binds a tooltip to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindTooltip(content, options): this {

		if (this._tooltip && this.isTooltipOpen()) {
			this.unbindTooltip();
		}

		this._tooltip = this._initOverlay(Tooltip, this._tooltip, content, options);
		this._initTooltipInteractions();

		if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
			this.openTooltip();
		}

		return this;
	}

	// @method unbindTooltip(): this
	// Removes the tooltip previously bound with `bindTooltip`.
	unbindTooltip(): this {
		if (this._tooltip) {
			this._initTooltipInteractions(true);
			this.closeTooltip();
			this._tooltip = null;
		}
		return this;
	}

	_initTooltipInteractions(remove): void {
		if (!remove && this._tooltipHandlersAdded) { return; }
		const onOff = remove ? 'off' : 'on',
		    events = {
			remove: this.closeTooltip,
			move: this._moveTooltip
		  };
		if (!this._tooltip.options.permanent) {
			events.mouseover = this._openTooltip;
			events.mouseout = this.closeTooltip;
			events.click = this._openTooltip;
			if (this._map) {
				this._addFocusListeners();
			} else {
				events.add = this._addFocusListeners;
			}
		} else {
			events.add = this._openTooltip;
		}
		if (this._tooltip.options.sticky) {
			events.mousemove = this._moveTooltip;
		}
		this[onOff](events);
		this._tooltipHandlersAdded = !remove;
	}

	// Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
	openTooltip(latlng?: LatLng): this {
		if (this._tooltip) {
			if (!(this instanceof FeatureGroup)) {
				this._tooltip._source = this;
			}
			if (this._tooltip._prepareOpen(latlng)) {
				// open the tooltip on the map
				this._tooltip.openOn(this._map);

				if (this.getElement) {
					this._setAriaDescribedByOnLayer(this);
				} else if (this.eachLayer) {
					this.eachLayer(this._setAriaDescribedByOnLayer, this);
				}
			}
		}
		return this;
	}

	// Closes the tooltip bound to this layer if it is open.
	closeTooltip(): this {
		if (this._tooltip) {
			this._tooltip.close();
		}
		return this;
	}

	// Opens or closes the tooltip bound to this layer depending on its current state.
	toggleTooltip(): this {
		if (this._tooltip) {
			this._tooltip.toggle(this);
		}
		return this;
	}

	// Returns `true` if the tooltip bound to this layer is currently open.
	isTooltipOpen(): boolean {
		return !!this._tooltip && this._tooltip.isOpen();
	}

	// @method setTooltipContent(content: String|HTMLElement|Tooltip): this
	// Sets the content of the tooltip bound to this layer.
	setTooltipContent(content): this {
		if (this._tooltip) {
			this._tooltip.setContent(content);
		}
		return this;
	}

	// Returns the tooltip bound to this layer.
	getTooltip(): Tooltip | undefined {
		return this._tooltip;
	}

	_addFocusListeners(): void {
		if (this.getElement) {
			this._addFocusListenersOnLayer(this);
		} else if (this.eachLayer) {
			this.eachLayer(this._addFocusListenersOnLayer, this);
		}
	}

	_addFocusListenersOnLayer(layer): void {
		const el = typeof layer.getElement === 'function' && layer.getElement();
		if (el) {
			DomEvent.on(el, 'focus', function () {
				this._tooltip._source = layer;
				this.openTooltip();
			}, this);
			DomEvent.on(el, 'blur', this.closeTooltip, this);
		}
	}

	_setAriaDescribedByOnLayer(layer): void {
		const el = typeof layer.getElement === 'function' && layer.getElement();
		if (el) {
			el.setAttribute('aria-describedby', this._tooltip._container.id);
		}
	}

	_openTooltip(e): void {
		if (!this._tooltip || !this._map) {
			return;
		}

		// If the map is moving, we will show the tooltip after it's done.
		if (this._map.dragging && this._map.dragging.moving() && !this._openOnceFlag) {
			this._openOnceFlag = true;
			this._map.on('moveend', () => {
				this._openOnceFlag = false;
				this._openTooltip(e);
			}, undefined, true);
			return;
		}

		this._tooltip._source = e.layer || e.target;

		this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
	}

	_moveTooltip(e): void {
		let latlng = e.latlng, containerPoint, layerPoint;
		if (this._tooltip.options.sticky && e.originalEvent) {
			containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
			layerPoint = this._map.containerPointToLayerPoint(containerPoint);
			latlng = this._map.layerPointToLatLng(layerPoint);
		}
		this._tooltip.setLatLng(latlng);
	}

}
