import type { Map } from '../Leaflet.js';
import type { HandlerMap } from '../core/Events.js';
import * as Util from '../core/Util.js';
import * as DomUtil from '../dom/DomUtil.js';
import { Point } from '../geometry/Point.js';
import { DivOverlay } from './DivOverlay.js';

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

	options = {
		// @option pane: String = 'tooltipPane'
		// `Map pane` where the tooltip will be added.
		pane: 'tooltipPane',

		// @option offset: Point = Point(0, 0)
		// Optional offset of the tooltip position.
		offset: [0, 0],

		// @option direction: String = 'auto'
		// Direction where to open the tooltip. Possible values are: `right`, `left`,
		// `top`, `bottom`, `center`, `auto`.
		// `auto` will dynamically switch between `right` and `left` according to the tooltip
		// position on the map.
		direction: 'auto',

		// @option permanent: Boolean = false
		// Whether to open the tooltip permanently or only on mouseover.
		permanent: false,

		// @option sticky: Boolean = false
		// If true, the tooltip will follow the mouse instead of being fixed at the feature center.
		sticky: false,

		// @option opacity: Number = 0.9
		// Tooltip container opacity.
		opacity: 0.9
	};

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

	onRemove(map: Map): this {
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

		return this;
	}

	getEvents(): HandlerMap {
		const events = DivOverlay.prototype.getEvents.call(this);

		if (!this.options.permanent) {
			events.preclick = this.close;
		}

		return events;
	}

	_initLayout(): void {
		const prefix = 'leaflet-tooltip',
		    className = `${prefix} ${this.options.className || ''} leaflet-zoom-${this._zoomAnimated ? 'animated' : 'hide'}`;

		this._contentNode = this._container = DomUtil.create('div', className);

		this._container.setAttribute('role', 'tooltip');
		this._container.setAttribute('id', `leaflet-tooltip-${Util.stamp(this)}`);
	}

	_updateLayout(): void {}

	_adjustPan(): void {}

	_setPosition(pos) {
		let subX, subY, direction = this.options.direction;
		const map = this._map,
		      container = this._container,
		      centerPoint = map.latLngToContainerPoint(map.getCenter()),
		      tooltipPoint = map.layerPointToContainerPoint(pos),
		      tooltipWidth = container.offsetWidth,
		      tooltipHeight = container.offsetHeight,
		      offset = toPoint(this.options.offset),
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

		pos = pos.subtract(toPoint(subX, subY, true)).add(offset).add(anchor);

		container.classList.remove(
			'leaflet-tooltip-right',
			'leaflet-tooltip-left',
			'leaflet-tooltip-top',
			'leaflet-tooltip-bottom'
		);
		container.classList.add(`leaflet-tooltip-${direction}`);
		DomUtil.setPosition(container, pos);
	}

	_updatePosition() {
		const pos = this._map.latLngToLayerPoint(this._latlng);
		this._setPosition(pos);
	}

	setOpacity(opacity) {
		this.options.opacity = opacity;

		if (this._container) {
			this._container.style.opacity = opacity;
		}
	}

	_animateZoom(e) {
		const pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
		this._setPosition(pos);
	}

	_getAnchor(): Point {
		// Where should we anchor the tooltip on the source layer?
		return (!this.options.sticky && this._source?._getTooltipAnchor?.()) || new Point(0, 0);
	}

}
