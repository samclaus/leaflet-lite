import { Evented, Util, type HandlerMap } from '../core';
import type { LatLng, LatLngBounds } from '../geog';
import type { Map } from '../map';
// import { Tooltip } from './Tooltip.js';

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

	/**
	 * Optional method. Called on [`map.addLayer(layer)`](#map-addlayer), before the layer is
	 * added to the map, before events are initialized, without waiting until the map is in a
	 * usable state. Use for early initialization only.
	 */
	beforeAdd?(map: Map): void;

	getBounds?(): LatLngBounds;
	getLatLng?(): LatLng;
	getElement?(): HTMLElement;

	// Returns the `HTMLElement` representing the named pane on the map.
	getPane(): HTMLElement | undefined {
		return this._map?._panes[this.options.pane];
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

	// From Tooltip

	// _tooltip: Tooltip | undefined;
	_tooltipHandlersAdded = false;
	_openOnceFlag = false;

	// Binds a tooltip to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	// bindTooltip(content: string | HTMLElement | Tooltip, options?: any /* TODO: tooltip options */): this {
	// 	// IMPORTANT: only unbind the tooltip if it is currently open; otherwise we can reuse the
	// 	// Tooltip instance and set new options without creating a brand new instance
	// 	if (this._tooltip?.isOpen()) {
	// 		this.unbindTooltip();
	// 	}

	// 	let newTooltip: Tooltip;

	// 	if (content instanceof Tooltip) {
	// 		Util.setOptions(content, options);
	// 		content._source = this;
	// 		newTooltip = content;
	// 	} else {
	// 		newTooltip = (this._tooltip && !options) ? this._tooltip : new Tooltip(options, this);
	// 		newTooltip.setContent(content);
	// 	}

	// 	this._tooltip = newTooltip;
	// 	this._initTooltipInteractions();

	// 	if (newTooltip.options.permanent && this._map?.hasLayer(this)) {
	// 		this.openTooltip();
	// 	}

	// 	return this;
	// }

	// closeTooltip(): void {
	// 	this._tooltip?.close();
	// }

	// // Removes the tooltip previously bound with `bindTooltip`.
	// unbindTooltip(): this {
	// 	if (this._tooltip) {
	// 		this._initTooltipInteractions(true);
	// 		this._tooltip.close();
	// 		this._tooltip = undefined;
	// 	}
	// 	return this;
	// }

	// _initTooltipInteractions(remove?: boolean): void {
	// 	if (!remove === this._tooltipHandlersAdded) { return; }

	// 	const
	// 		tooltip = this._tooltip!, // TODO: null safety
	// 		onOff = remove ? 'off' : 'on',
	// 		events: HandlerMap = {
	// 			remove: this.closeTooltip,
	// 			move: this._moveTooltip
	// 		};

	// 	if (tooltip.options.permanent) {
	// 		events.add = this._openTooltip;
	// 	} else {
	// 		events.mouseover = this._openTooltip;
	// 		events.mouseout = this.closeTooltip;
	// 		events.click = this._openTooltip;

	// 		if (this._map) {
	// 			this._addFocusListeners();
	// 		} else {
	// 			events.add = this._addFocusListeners;
	// 		}
	// 	}
	// 	if (tooltip.options.sticky) {
	// 		events.mousemove = this._moveTooltip;
	// 	}
	// 	this[onOff](events);
	// 	this._tooltipHandlersAdded = !remove;
	// }

	/**
	 * @deprecated TODO: this is just a hideous hack because some of the code in here is not
	 * truly abstract and needs to know about subclasses, which caused circular dependencies.
	 */
	_isLayerGroup?: boolean;

	// Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
	// openTooltip(latlng?: LatLng): this {
	// 	if (this._tooltip) {
	// 		if (!this._isLayerGroup) {
	// 			this._tooltip._source = this;
	// 		}
	// 		if (this._tooltip._prepareOpen(latlng)) {
	// 			// open the tooltip on the map
	// 			this._tooltip.openOn(this._map);
	// 			this._setAriaDescribedBy();
	// 		}
	// 	}
	// 	return this;
	// }

	_addFocusListeners(): void {
		this._addFocusListenersOnLayer(this);
	}

	_setAriaDescribedBy(): void {
		this._setAriaDescribedByOnLayer(this);
	}

	_addFocusListenersOnLayer(layer: Layer): void {
		// const el = layer.getElement?.();

		// if (el) {
		// 	DomEvent.on(el, 'focus', () => {
		// 		// TODO: null safety
		// 		this._tooltip!._source = layer;
		// 		this.openTooltip();
		// 	});
		// 	DomEvent.on(el, 'blur', this.closeTooltip, this);
		// }
	}

	_setAriaDescribedByOnLayer(layer: Layer): void {
		// const el = layer.getElement?.();

		// if (el) {
		// 	// TODO: null safety
		// 	el.setAttribute('aria-describedby', this._tooltip!._container.id);
		// }
	}

	// _openTooltip(e: any): void {
	// 	if (!this._tooltip || !this._map) {
	// 		return;
	// 	}

	// 	// If the map is moving, we will show the tooltip after it's done.
	// 	if (this._map.dragging?.moving() && !this._openOnceFlag) {
	// 		this._openOnceFlag = true;
	// 		this._map.on('moveend', () => {
	// 			this._openOnceFlag = false;
	// 			this._openTooltip(e);
	// 		}, this, true);
	// 		return;
	// 	}

	// 	this._tooltip._source = e.layer || e.target;

	// 	this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
	// }

	// _moveTooltip(e: any): void {
	// 	const
	// 		map = this._map!, // TODO: null safety
	// 		tooltip = this._tooltip!; // TODO: null safety

	// 	let latlng = e.latlng;

	// 	if (tooltip.options.sticky && e.originalEvent) {
	// 		const containerPoint = map.mouseEventToContainerPoint(e.originalEvent);
	// 		const layerPoint = map.containerPointToLayerPoint(containerPoint);
	// 		latlng = map.layerPointToLatLng(layerPoint);
	// 	}

	// 	tooltip.setLatLng(latlng);
	// }

}
