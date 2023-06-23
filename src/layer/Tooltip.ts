import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import { LatLng } from '../geog';
import { Point } from '../geom';
import type { Map } from '../map';
import { DivOverlay, type DivOverlayOptions } from './DivOverlay.js';

export interface TooltipOptions extends DivOverlayOptions {
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
 * var tooltip = L.tooltip()
 * 	.setLatLng(latlng)
 * 	.setContent('Hello world!<br />This is a nice tooltip.')
 * 	.addTo(map);
 * ```
 * or
 * ```js
 * var tooltip = L.tooltip(latlng, {content: 'Hello world!<br />This is a nice tooltip.'})
 * 	.addTo(map);
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
export class Tooltip extends DivOverlay {

	declare options: TooltipOptions;

	constructor(latlng?: LatLng, options?: Partial<DivOverlayOptions>)
	constructor(options?: Partial<DivOverlayOptions>, source?: any /* TODO */)
	constructor(latlngOrOptions?: LatLng | Partial<DivOverlayOptions>, optionsOrSource?: any /* TODO */) {
		super(latlngOrOptions as any, optionsOrSource);

		Util.setOptions(
			this,
			(!(latlngOrOptions instanceof LatLng) && latlngOrOptions) || optionsOrSource,
			{
				pane: 'tooltipPane',
				offset: new Point(0, 0),
				direction: 'auto',
				permanent: false,
				sticky: false,
				opacity: 0.9
			},
		);
	}

	onAdd(map: Map): this {
		DivOverlay.prototype.onAdd.call(this, map);
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
		DivOverlay.prototype.onRemove.call(this, map);

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
		const events = DivOverlay.prototype.getEvents.call(this);

		if (!this.options.permanent) {
			events.preclick = this.close;
		}

		return events;
	}

	_initLayout(): void {
		const
			prefix = 'leaflet-tooltip',
		    className = `${prefix} ${(this.options as any /* TODO */).className || ''} leaflet-zoom-${this._zoomAnimated ? 'animated' : 'hide'}`;

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
			this._container.style.opacity = opacity;
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
