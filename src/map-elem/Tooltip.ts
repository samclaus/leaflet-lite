import { Layer, type LayerOptions } from '.';
import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import { LatLng } from '../geog';
import { Point } from '../geom';
import type { Map } from '../map';

export interface TooltipOptions extends LayerOptions {
	/**
	 * If true, the tooltip will listen to the mouse events.
	 */
	interactive: boolean;
	/**
	 * The offset of the overlay position. (0, 0) by default.
	 */
	offset: Point;
	/**
	 * A custom CSS class name to assign to the overlay.
	 */
	className: string | undefined;
	/**
	 * Sets the HTML content of the overlay while initializing.
	 */
	content: string | HTMLElement;
	/**
	 * Direction where to open the tooltip. Possible values are: `right`, `left`,
	 * `top`, `bottom`, `center`, and `auto`. `auto` (the default) will dynamically
	 * switch between `right` and `left` according to the tooltip position on the map.
	 */
	direction: 'right' | 'left' | 'top' | 'bottom' | 'center' | 'auto';
	/**
	 * Whether to open the tooltip permanently or only on mouseover. False by default.
	 */
	permanent: boolean;
	/**
	 * If true, the tooltip will follow the mouse instead of being fixed at the feature
	 * center. False by default.
	 */
	sticky: boolean;
	/**
	 * Tooltip container opacity, in range [0, 1]. 0.9 by default.
	 */
	opacity: number;
}

/**
 * Used to display small texts on top of map layers.
 *
 * If you want to just bind a tooltip to marker:
 *
 * ```js
 * marker.bindTooltip("my tooltip text").openTooltip();
 * ```
 * Path overlays like polylines also have a `bindTooltip` method.
 *
 * A tooltip can be also standalone:
 *
 * ```js
 * const tooltip = L.tooltip()
 * 	.setLatLng(latlng)
 * 	.setContent('Hello world!<br />This is a nice tooltip.');
 * 
 * map.addLayer(tooltip);
 * ```
 * or
 * ```js
 * const tooltip = L.tooltip(latlng, {
 *     content: 'Hello world!<br />This is a nice tooltip.',
 * });
 * 
 * map.addLayer(tooltip);
 * ```
 *
 *
 * Note about tooltip offset. Leaflet takes two options in consideration
 * for computing tooltip offsetting:
 * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
 *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
 *   move it to the bottom. Negatives will move to the left and top.
 * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
 *   should adapt this value if you use a custom icon.
 */
export class Tooltip extends Layer {

	declare options: TooltipOptions;
	
	_latlng: LatLng | undefined;
	_source: any; // TODO
	_content: string | HTMLElement;
	_container = DomUtil.create('div');
	_contentNode = this._container;
	_removeTimeout: number | undefined;

	constructor(latlng?: LatLng, options?: Partial<TooltipOptions>)
	constructor(options?: Partial<TooltipOptions>, source?: any /* TODO */)
	constructor(latlngOrOptions?: LatLng | Partial<TooltipOptions>, optionsOrSource?: any /* TODO */) {
		super();

		const optionDefaults = {
			interactive: false,
			offset: new Point(0, 0),
			className: '',
			pane: undefined,
			content: ''
		};

		if (latlngOrOptions instanceof LatLng) {
			this._latlng = latlngOrOptions;
			Util.setOptions(this, optionsOrSource, optionDefaults);
		} else {
			Util.setOptions(this, latlngOrOptions, optionDefaults);
			this._source = optionsOrSource;
		}

		this._content = this.options.content;

		Util.setOptions(
			this,
			(!(latlngOrOptions instanceof LatLng) && latlngOrOptions) || optionsOrSource,
			{
				pane: 'tooltip',
				offset: new Point(0, 0),
				direction: 'auto',
				permanent: false,
				sticky: false,
				opacity: 0.9
			},
		);
	}

	onAdd(map: Map): this {
		if (!this._container) {
			this._initLayout();
		}

		if (map.options.fadeAnimation) {
			this._container.style.opacity = 0 as any; // will coerce to string
		}

		clearTimeout(this._removeTimeout);
		this.getPane()!.appendChild(this._container); // TODO: null safety
		this.update();

		if (map.options.fadeAnimation) {
			this._container.style.opacity = 1 as any; // will coerce to string
		}

		this.bringToFront();

		if (this.options.interactive) {
			this._container.classList.add('leaflet-interactive');
		}

		this.setOpacity(this.options.opacity);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipopen: TooltipEvent
		// Fired when a tooltip is opened in the map.
		map.fire('tooltipopen', {tooltip: this});

		if (this._source) {
			this.addEventParent(this._source);

			// @namespace Layer
			// @section Tooltip events
			// @event tooltipopen: TooltipEvent
			// Fired when a tooltip bound to this layer is opened.
			this._source.fire('tooltipopen', {tooltip: this}, true);
		}

		return this;
	}

	onRemove(map: Map): void {
		if (map.options.fadeAnimation) {
			this._container.style.opacity = 0 as any; // will coerce to string
			this._removeTimeout = setTimeout(() => this._container.remove(), 200);
		} else {
			this._container.remove();
		}

		if (this.options.interactive) {
			this._container.classList.remove('leaflet-interactive');
		}

		// @namespace Map
		// @section Tooltip events
		// @event tooltipclose: TooltipEvent
		// Fired when a tooltip in the map is closed.
		map.fire('tooltipclose', {tooltip: this});

		if (this._source) {
			this.removeEventParent(this._source);

			// @namespace Layer
			// @section Tooltip events
			// @event tooltipclose: TooltipEvent
			// Fired when a tooltip bound to this layer is closed.
			this._source.fire('tooltipclose', {tooltip: this}, true);
		}
	}

	getEvents(): HandlerMap {
		const events: HandlerMap = {
			zoom: this._updatePosition,
			viewreset: this._updatePosition
		};

		if (this._map!._zoomAnimated) { // TODO: null safety
			events.zoomanim = this._animateZoom;
		}
		if (!this.options.permanent) {
			events.preclick = this.close;
		}

		return events;
	}

	// BEGINNING OF STUFF RIPPED FROM DIVOVERLAY

	// Adds the overlay to the map.
	openOn(map: Map = this._source?._map): this {
		map.addLayer(this);
		return this;
	}

	close(): this {
		if (this._map) {
			this._map.removeLayer(this);
		}
		return this;
	}

	// Opens or closes the overlay bound to layer depending on its current state.
	// Argument may be omitted only for overlay bound to layer.
	toggle(layer?: Layer): this {
		if (this._map) {
			this.close();
		} else {
			if (layer) {
				this._source = layer;
			} else {
				layer = this._source;
			}
			this._prepareOpen();

			// open the overlay on the map
			this.openOn(layer!._map); // TODO: null safety
		}
		return this;
	}

	// Sets the geographical point where the overlay will open.
	setLatLng(latlng: LatLng): this {
		this._latlng = latlng;

		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}

		return this;
	}

	// Sets the HTML content of the overlay.
	setContent(content: string | HTMLElement): this {
		this._content = content;
		this.update();
		return this;
	}

	// Returns the HTML container of the overlay.
	getElement(): HTMLElement { // TODO: was string | HTMLElement
		return this._container;
	}

	// Updates the overlay content, layout and position. Useful for updating the overlay after something inside changed, e.g. image loaded.
	update(): void {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	}

	// Returns `true` when the overlay is visible on the map.
	isOpen(): boolean {
		return !!this._map;
	}

	// Brings this overlay in front of other overlays (in the same map pane).
	bringToFront(): this {
		if (this._map) {
			DomUtil.toFront(this._container);
		}
		return this;
	}

	// Brings this overlay to the back of other overlays (in the same map pane).
	bringToBack(): this {
		if (this._map) {
			DomUtil.toBack(this._container);
		}
		return this;
	}

	// prepare bound overlay to open: update latlng pos / content source (for LayerGroup)
	_prepareOpen(latlng?: LatLng): boolean {
		let source = this._source;

		if (!source._map) { return false; }

		// TODO: this code is all coupled, base classes should not know about higher-level classes
		if (source._isLayerGroup) {
			// Find the first layer in the feature group that is registered with a map
			source = Object
				.values<any>(source._layers)
				.find(layer => layer._map);

			// None of the feature group layers were registered with a map
			if (!source) { return false; }

			// set overlay source to this layer
			this._source = source;
		}

		latlng ||= (
			source.getCenter?.() ||
			source._latlng ||
			source.getBounds?.()?.getCenter()
		);
	
		if (!latlng) {
			throw new Error('Unable to get source layer LatLng.');
		}

		this.setLatLng(latlng);
		this.update(); // update the overlay (content, layout, etc...)

		return true;
	}

	_updateContent(): void {
		const
			node = this._contentNode,
			content = this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else {
			DomUtil.removeAllChildren(node);
			node.appendChild(content);
		}

		this.fire('contentupdate');
	}

	// END OF STUFF RIPPED FROM DIVOVERLAY

	_initLayout(): void {
		const
			prefix = 'leaflet-tooltip',
		    className = `${prefix} ${this.options.className || ''} leaflet-zoom-${this._map!._zoomAnimated ? 'animated' : 'hide'}`; // TODO: null safety

		this._contentNode = this._container = DomUtil.create('div', className);
		this._container.setAttribute('role', 'tooltip');
		this._container.setAttribute('id', `leaflet-tooltip-${Util.stamp(this)}`);
	}

	_updateLayout(): void {}

	_adjustPan(): void {}

	_setPosition(pos: Point): void {
		let subX, subY, direction = this.options.direction;
		const
			map = this._map!, // TODO: null safety
			container = this._container,
			centerPoint = map.latLngToContainerPoint(map.getCenter()),
			tooltipPoint = map.layerPointToContainerPoint(pos),
			tooltipWidth = container.offsetWidth,
			tooltipHeight = container.offsetHeight,
			offset = this.options.offset,
			anchor = this._getAnchor();

		if (direction === 'top') {
			subX = tooltipWidth / 2;
			subY = tooltipHeight;
		} else if (direction === 'bottom') {
			subX = tooltipWidth / 2;
			subY = 0;
		} else if (direction === 'center') {
			subX = tooltipWidth / 2;
			subY = tooltipHeight / 2;
		} else if (direction === 'right') {
			subX = 0;
			subY = tooltipHeight / 2;
		} else if (direction === 'left') {
			subX = tooltipWidth;
			subY = tooltipHeight / 2;
		} else if (tooltipPoint.x < centerPoint.x) {
			direction = 'right';
			subX = 0;
			subY = tooltipHeight / 2;
		} else {
			direction = 'left';
			subX = tooltipWidth + (offset.x + anchor.x) * 2;
			subY = tooltipHeight / 2;
		}

		pos = pos.subtract(
			new Point(Math.round(subX), Math.round(subY)),
		).add(offset).add(anchor);

		container.classList.remove(
			'leaflet-tooltip-right',
			'leaflet-tooltip-left',
			'leaflet-tooltip-top',
			'leaflet-tooltip-bottom'
		);
		container.classList.add(`leaflet-tooltip-${direction}`);
		DomUtil.setPosition(container, pos);
	}

	_updatePosition(): void {
		// TODO: null safety
		const pos = this._map!.latLngToLayerPoint(this._latlng!);
		this._setPosition(pos);
	}

	setOpacity(opacity: number): void {
		this.options.opacity = opacity;

		if (this._container) {
			this._container.style.opacity = opacity as any; // will be coerced to string
		}
	}

	_animateZoom(ev: any): void {
		// TODO: null safety
		const pos = this._map!._latLngToNewLayerPoint(this._latlng!, ev.zoom, ev.center);
		this._setPosition(pos);
	}

	_getAnchor(): Point {
		// Where should we anchor the tooltip on the source layer?
		return (!this.options.sticky && this._source?._getTooltipAnchor?.()) || new Point(0, 0);
	}

}

// CODE BELOW USED TO BE PART OF LAYER CLASS
// extend class Layer {

	// _tooltip: Tooltip | undefined;
	// _tooltipHandlersAdded = false;
	// _openOnceFlag = false;

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
	// _isLayerGroup?: boolean;

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

	// _addFocusListeners(): void {
	// 	this._addFocusListenersOnLayer(this);
	// }

	// _setAriaDescribedBy(): void {
	// 	this._setAriaDescribedByOnLayer(this);
	// }

	// _addFocusListenersOnLayer(layer: Layer): void {
	// 	const el = layer.getElement?.();

	// 	if (el) {
	// 		DomEvent.on(el, 'focus', () => {
	// 			// TODO: null safety
	// 			this._tooltip!._source = layer;
	// 			this.openTooltip();
	// 		});
	// 		DomEvent.on(el, 'blur', this.closeTooltip, this);
	// 	}
	// }

	// _setAriaDescribedByOnLayer(layer: Layer): void {
	// 	const el = layer.getElement?.();

	// 	if (el) {
	// 		// TODO: null safety
	// 		el.setAttribute('aria-describedby', this._tooltip!._container.id);
	// 	}
	// }

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

// }