import { Layer, type LayerOptions } from '..';
import { Util, type HandlerMap } from '../../core';
import { DomEvent, DomUtil } from '../../dom';
import { LatLng } from '../../geog';
import { Point } from '../../geom';
import type { Map, ZoomAnimationEvent } from '../../map';
import type { Icon } from './Icon.js';
import { MarkerDrag } from './Marker.Drag.js';
import { defaultIcon } from './default-icon.js';

export interface MarkerOptions extends LayerOptions {
	/**
	 * Icon instance to use for rendering the marker.
	 * See [Icon documentation](#L.Icon) for details on how to customize the marker icon.
	 * If not specified, an icon is created using `defaultIcon()`.
	 */
	icon: Icon;
	/**
	 * Whether the user can interact with this marker, e.g., by dragging. True by default.
	 */
	interactive: boolean;
	/**
	 * Whether the marker can be tabbed to with a keyboard and clicked by pressing enter.
	 * True by default.
	 */
	keyboard: boolean;
	/**
	 * Text for the browser tooltip that appear on marker hover (no tooltip by default).
	 * [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
	 */
	title: string;
	/**
	 * Text for the `alt` attribute of the icon image.
	 * [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
	 */
	alt: string;
	/**
	 * By default, marker images zIndex is set automatically based on its latitude. Use
	 * this option if you want to put the marker on top of all others (or below), specifying
	 * a high value like `1000` (or high negative value, respectively).
	 */
	zIndexOffset: number;
	/**
	 * The opacity of the marker, in range [0, 1]. 1 by default.
	 */
	opacity: number;
	/**
	 * If true, the marker will get on top of others when you hover the mouse over it. False
	 * by default.
	 * 
	 * @deprecated TODO: just set riseOffset to 0 (and make 0 the default) to disable rising.
	 */
	riseOnHover: boolean;
	/**
	 * The z-index offset used for the `riseOnHover` feature. 250 by default.
	 */
	riseOffset: number;
	/**
	 * When true, the map will pan whenever the marker is focused (via
	 * e.g. pressing `tab` on the keyboard) to ensure the marker is
	 * visible within the map's bounds. True by default.
	 */
	autoPanOnFocus: boolean;
	/**
	 * Whether the marker is draggable with mouse/touch or not. False by default.
	 */
	draggable: boolean;
	/**
	 * Whether to pan the map when dragging this marker near its edge or not.
	 * False by default.
	 * 
	 * @deprecated TODO: merge this with autoPanPadding option, and just don't
	 * pass a point to disable auto panning.
	 */
	autoPan: boolean;
	/**
	 * Distance (in pixels to the left/right and to the top/bottom) of the
	 * map edge to start panning the map. (50, 50) by default.
	 */
	autoPanPadding: Point;
	/**
	 * Number of pixels the map should pan by. TODO: each second? 10 by default.
	 */
	autoPanSpeed: number;
}

/**
 * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 *
 * ```js
 * L.marker([50.5, 30.5]).addTo(map);
 * ```
 */
export class Marker extends Layer {

	declare options: MarkerOptions;

	_icon: HTMLElement | undefined;
	_zIndex = 0; // TODO: safe to make it a number from the get-go?
	dragging: MarkerDrag | undefined;

	constructor(
		public _latlng: LatLng,
		options?: any,
	) {
		super();

		Util.setOptions(this, options, {
			icon: defaultIcon(),
			interactive: true,
			keyboard: true,
			title: '',
			alt: 'Marker',
			zIndexOffset: 0,
			opacity: 1,
			riseOnHover: false,
			riseOffset: 250,
			pane: 'markerPane',
			bubblingMouseEvents: false,
			autoPanOnFocus: true,
			draggable: false,
			autoPan: false,
			autoPanPadding: new Point(50, 50),
			autoPanSpeed: 10
		});
	}

	onAdd(map: Map): this {
		this._zoomAnimated &&= map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._initIcon();
		this.update();

		return this;
	}

	onRemove(map: Map): this {
		if (this.dragging?.enabled()) {
			this.options.draggable = true;
			this.dragging.removeHooks();
		}
		
		this.dragging = undefined;

		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		this._removeIcon();

		return this;
	}

	getEvents(): HandlerMap {
		return {
			zoom: this.update,
			viewreset: this.update
		};
	}

	// Returns the current geographical position of the marker.
	getLatLng(): LatLng {
		return this._latlng;
	}

	// Changes the marker position to the given point.
	setLatLng(latlng: LatLng): this {
		const oldLatLng = this._latlng;

		this._latlng = latlng;
		this.update();

		// @event move: Event
		// Fired when the marker is moved via [`setLatLng`](#marker-setlatlng) or by [dragging](#marker-dragging). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
		return this.fire('move', { oldLatLng, latlng: this._latlng });
	}

	// Changes the [zIndex offset](#marker-zindexoffset) of the marker.
	setZIndexOffset(offset: number): this {
		this.options.zIndexOffset = offset;
		return this.update();
	}

	// Returns the current icon used by the marker
	getIcon(): Icon {
		return this.options.icon;
	}

	// Changes the marker icon.
	setIcon(icon: Icon): this {
		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		return this;
	}

	getElement(): HTMLElement {
		return this._icon!; // TODO: null safety
	}

	update(): this {
		if (this._icon && this._map) {
			const pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	}

	_initIcon(): void {
		const
			options = this.options,
		    classToAdd = `leaflet-zoom-${this._zoomAnimated ? 'animated' : 'hide'}`,
			icon = options.icon.createIcon(this._icon as any); // TODO: better types?

		let addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (icon.tagName === 'IMG') {
				icon.alt = options.alt || '';
			}
		}

		icon.classList.add(classToAdd);

		if (options.keyboard) {
			icon.tabIndex = 0;
			icon.setAttribute('role', 'button');
		}

		this._icon = icon;

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			DomEvent.on(icon, 'focus', this._panOnFocus, this);
		}

		if (options.opacity < 1) {
			this._updateOpacity();
		}

		if (addIcon) {
			// TODO: null safety?
			this.getPane()!.appendChild(this._icon!);
		}

		this._initInteraction();
	}

	_removeIcon(): void {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			// TODO: null safety
			DomEvent.off(this._icon!, 'focus', this._panOnFocus, this);
		}

		if (this._icon) {
			this._icon.remove();
			this.removeInteractiveTarget(this._icon);
			this._icon = undefined;
		}
	}

	_setPos(pos: Point): void {
		if (this._icon) {
			DomUtil.setPosition(this._icon, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;
		this._resetZIndex();
	}

	_updateZIndex(offset: number): void {
		if (this._icon) {
			// Make TypeScript shut up here--number automatically gets converted to string
			this._icon.style.zIndex = (this._zIndex + offset) as any;
		}
	}

	_animateZoom(ev: ZoomAnimationEvent): void {
		if (this._map) {
			this._setPos(
				this._map._latLngToNewLayerPoint(
					this._latlng,
					ev.zoom,
					ev.center,
				).round(),
			);
		}
	}

	_initInteraction(): void {
		if (!this.options.interactive) { return; }

		if (this._icon) {
			this._icon.classList.add('leaflet-interactive');
			this.addInteractiveTarget(this._icon);
		}

		if (this._map) {
			let draggable = this.options.draggable;

			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new MarkerDrag(this._map, this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	}

	// Changes the opacity of the marker.
	setOpacity(opacity: number): this {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}

		return this;
	}

	_updateOpacity(): void {
		const opacity = this.options.opacity;

		if (this._icon) {
			this._icon.style.opacity = opacity as any; // will be coerced to string
		}
	}

	_bringToFront(): void {
		this._updateZIndex(this.options.riseOffset);
	}

	_resetZIndex(): void {
		this._updateZIndex(0);
	}

	_panOnFocus(): void {
		const map = this._map;

		if (!map) { return; }

		const
			iconOpts = this.options.icon.options,
			size = iconOpts.iconSize || new Point(0, 0),
			anchor = iconOpts.iconAnchor || new Point(0, 0);

		map.panInside(this._latlng, {
			paddingTopLeft: anchor,
			paddingBottomRight: size.subtract(anchor)
		});
	}

	_getTooltipAnchor(): Point | undefined {
		return this.options.icon.options.tooltipAnchor;
	}

}
