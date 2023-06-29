import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import { LatLng } from '../geog';
import { Point } from '../geom';
import type { Map } from '../map';
import { Layer, type LayerOptions } from './Layer.js';

export interface DivOverlayOptions extends LayerOptions {
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
	 * If a function is passed the source layer will be passed
	 * to the function. The function should return a string or
	 * element to be used in the overlay. Empty string by default.
	 */
	content: string | HTMLElement | ((layer: Layer) => string | HTMLElement);
}

/**
 * Base model for L.Tooltip. Inherit from it for custom overlays like plugins.
 */
export abstract class DivOverlay extends Layer {

	declare options: DivOverlayOptions;

	_latlng: LatLng | undefined;
	_source: any; // TODO
	_content: any; // TODO
	_container: any; // TODO
	_contentNode: HTMLElement | undefined;
	_removeTimeout: number | undefined;

	constructor(latlng?: LatLng, options?: Partial<DivOverlayOptions>)
	constructor(options?: Partial<DivOverlayOptions>, source?: any /* TODO */)
	constructor(latlngOrOptions?: LatLng | Partial<DivOverlayOptions>, optionsOrSource?: any /* TODO */) {
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
		if (this.options.content) {
			this._content = this.options.content;
		}
	}

	abstract _initLayout(): void;
	abstract _updateLayout(): void;
	abstract _updatePosition(): void;
	abstract _adjustPan(): void;
	abstract _animateZoom(ev: any): void;

	// Adds the overlay to the map.
	openOn(map: Map = this._source._map): this {
		if (!map.hasLayer(this)) {
			map.addLayer(this);
		}
		return this;
	}

	// Closes the overlay. Alternative to `layer.closeTooltip()`.
	close(): this {
		if (this._map) {
			this._map.removeLayer(this);
		}
		return this;
	}

	// Opens or closes the overlay bound to layer depending on its current state.
	// Argument may be omitted only for overlay bound to layer.
	// Alternative to `.toggleTooltip()`.
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

	onAdd(map: Map): this {
		this._zoomAnimated = map._zoomAnimated;

		if (!this._container) {
			this._initLayout();
		}

		if (map.options.fadeAnimation) {
			this._container.style.opacity = 0;
		}

		clearTimeout(this._removeTimeout);
		this.getPane()!.appendChild(this._container); // TODO: null safety
		this.update();

		if (map.options.fadeAnimation) {
			this._container.style.opacity = 1;
		}

		this.bringToFront();

		if (this.options.interactive) {
			this._container.classList.add('leaflet-interactive');
			this.addInteractiveTarget(this._container);
		}

		return this;
	}

	onRemove(map: Map): void {
		if (map.options.fadeAnimation) {
			this._container.style.opacity = 0;
			this._removeTimeout = setTimeout(() => this._container.remove(), 200);
		} else {
			this._container.remove();
		}

		if (this.options.interactive) {
			this._container.classList.remove('leaflet-interactive');
			this.removeInteractiveTarget(this._container);
		}
	}

	// Returns the geographical point of the overlay.
	getLatLng(): LatLng {
		return this._latlng!; // TODO: null safety
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

	// Returns the content of the overlay.
	getContent(): string | HTMLElement | Function {
		return this._content;
	}

	// Sets the HTML content of the overlay. If a function is passed the source layer will be passed to the function.
	// The function should return a `String` or `HTMLElement` to be used in the overlay.
	setContent(content: string | HTMLElement | Function): this {
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

	getEvents(): HandlerMap {
		const events: HandlerMap = {
			zoom: this._updatePosition,
			viewreset: this._updatePosition
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		return events;
	}

	// Returns `true` when the overlay is visible on the map.
	isOpen(): boolean {
		return !!this._map && this._map.hasLayer(this);
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

	// prepare bound overlay to open: update latlng pos / content source (for FeatureGroup)
	_prepareOpen(latlng?: LatLng): boolean {
		let source = this._source;

		if (!source._map) { return false; }

		// TODO: this code is all coupled, base classes should not know about higher-level classes
		if (source._isFeatureGroup) {
			// Find the first layer in the feature group that is registered with a map
			source = Object
				.values<any>(source._layers)
				.find(layer => layer._map);

			// None of the feature group layers were registered with a map
			if (!source) { return false; }

			// set overlay source to this layer
			this._source = source;
		}

		if (!latlng) {
			if (source.getCenter) {
				latlng = source.getCenter();
			} else if (source.getLatLng) {
				latlng = source.getLatLng();
			} else if (source.getBounds) {
				latlng = source.getBounds().getCenter();
			} else {
				throw new Error('Unable to get source layer LatLng.');
			}
		}
		this.setLatLng(latlng!); // TODO: null safety

		if (this._map) {
			// update the overlay (content, layout, etc...)
			this.update();
		}

		return true;
	}

	_updateContent(): void {
		if (!this._content) { return; }

		const node = this._contentNode!; // TODO: null safety
		const content = (typeof this._content === 'function')
			? this._content(this._source || this)
			: this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else {
			while (node.hasChildNodes()) {
				// TODO: just check firstChild as loop condition and remove non-null assertion?
				node.removeChild(node.firstChild!);
			}
			node.appendChild(content);
		}

		// @namespace DivOverlay
		// @section DivOverlay events
		// @event contentupdate: Event
		// Fired when the content of the overlay is updated
		this.fire('contentupdate');
	}

	_getAnchor(): Point {
		return new Point(0, 0);
	}

}
