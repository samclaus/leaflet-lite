import { Layer, type LayerOptions } from '..';
import { Util, type HandlerMap } from '../../core';
import { DomEvent, DomUtil } from '../../dom';
import { LatLng } from '../../geog';
import { Point } from '../../geom';
import type { Map, ZoomAnimationEvent } from '../../map';
import type { Icon } from './Icon';

export interface MarkerOptions extends LayerOptions {
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
	 * By default, marker images zIndex is set automatically based on its latitude. Use
	 * this option if you want to put the marker on top of all others (or below), specifying
	 * a high value like `1000` (or high negative value, respectively).
	 */
	zIndexOffset: number;
	/**
	 * If greater than 0, the marker's z-index will be raised by this amount when hovered, so
	 * that it shows on top of other markers. 0 by default.
	 */
	riseOnHoverOffset: number;
	/**
	 * When true, the map will pan whenever the marker is focused (via
	 * e.g. pressing `tab` on the keyboard) to ensure the marker is
	 * visible within the map's bounds. True by default.
	 */
	autoPanOnFocus: boolean;
}

/**
 * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 *
 * ```js
 * map.addLayer(L.marker([50.5, 30.5]));
 * ```
 */
export class Marker extends Layer {

	declare options: MarkerOptions;

	_zIndex = 0; // TODO: safe to make it a number from the get-go?
	_icon: HTMLElement;

	constructor(
		public _latlng: LatLng,
		public _iconInfo: Icon,
		options?: Partial<MarkerOptions>,
	) {
		super();

		Util.setOptions(this, options, {
			interactive: true,
			keyboard: true,
			zIndexOffset: 0,
			riseOnHoverOffset: 0,
			pane: 'marker',
			bubblingMouseEvents: false,
			autoPanOnFocus: true,
		});

		this._icon = _iconInfo.el;
	}

	onAdd(map: Map): this {
		// TODO: _zoomAnimated is set by the map whenever it adds the layer--this whole dance
		// is kinda janky and concerning.
		this._zoomAnimated &&= map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		const
			options = this.options,
			icon = this._icon;

		// TODO: need to remove later?
		icon.classList.add(`leaflet-zoom-${this._zoomAnimated ? 'animated' : 'hide'}`);

		if (options.keyboard) {
			icon.tabIndex = 0;
			icon.setAttribute('role', 'button');
		}

		if (options.riseOnHoverOffset > 0) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			DomEvent.on(icon, 'focus', this._panOnFocus, this);
		}

		this.getPane()!.appendChild(icon);
		
		if (options.interactive) {
			icon.classList.add('leaflet-interactive');
			this.addInteractiveTarget(icon);
		}

		this.update();

		return this;
	}

	onRemove(map: Map): void {
		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		if (this.options.riseOnHoverOffset > 0) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			DomEvent.off(this._icon, 'focus', this._panOnFocus, this);
		}

		this._icon.remove();
		this.removeInteractiveTarget(this._icon);
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

	getElement(): HTMLElement {
		return this._icon;
	}

	update(): this {
		if (this._map) {
			const pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}
		return this;
	}

	_setPos(pos: Point): void {
		DomUtil.setPosition(this._icon, pos);

		this._zIndex = pos.y + this.options.zIndexOffset;
		this._resetZIndex();
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

	_updateZIndex(offset: number): void {
		// Make TypeScript shut up here--number automatically gets converted to string
		this._icon.style.zIndex = (this._zIndex + offset) as any;
	}

	_bringToFront(): void {
		this._updateZIndex(this.options.riseOnHoverOffset);
	}

	_resetZIndex(): void {
		this._updateZIndex(0);
	}

	_panOnFocus(): void {
		const
			map = this._map,
			{ size, anchor } = this._iconInfo;

		if (map) {
			map.panInside(this._latlng, {
				paddingTopLeft: anchor,
				paddingBottomRight: size.subtract(anchor),
			});
		}
	}

}
