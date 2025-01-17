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
	 */
	content: string | HTMLElement;
}

/**
 * Base model for L.Tooltip. Inherit from it for custom overlays like plugins.
 * 
 * @event contentupdate: Event
 * Fired when the content of the overlay is updated
 */
export abstract class DivOverlay extends Layer {

	declare options: DivOverlayOptions;

	_latlng: LatLng | undefined;
	_source: any; // TODO
	_content: string | HTMLElement;
	_container = DomUtil.create('div');
	_contentNode = this._container;
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

		this._content = this.options.content;
	}

	abstract _initLayout(): void;
	abstract _updateLayout(): void;
	abstract _updatePosition(): void;
	abstract _adjustPan(): void;
	abstract _animateZoom(ev: any): void;

	// Adds the overlay to the map.
	openOn(map: Map = this._source._map): this {
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

	onAdd(map: Map): this {
		this._zoomAnimated = map._zoomAnimated;

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
			this.addInteractiveTarget(this._container);
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
		return !!(this._map?.hasLayer(this));
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
			source.getLatLng?.() ||
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

	_getAnchor(): Point {
		return new Point(0, 0);
	}

}
