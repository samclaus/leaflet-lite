import { Util, type HandlerMap } from '../core';
import { DomUtil } from '../dom';
import type { LatLng, LatLngBounds } from '../geog';
import { Bounds } from '../geom';
import { Layer } from './Layer.js';

/**
 * Used to load and display a single image over specific bounds of the map. Extends `Layer`.
 *
 * ```js
 * var imageUrl = 'https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
 * 	imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
 * L.imageOverlay(imageUrl, imageBounds).addTo(map);
 * ```
 */
export class ImageOverlay extends Layer {

	// @section
	// @aka ImageOverlay options
	options = {
		// @option opacity: Number = 1.0
		// The opacity of the image overlay.
		opacity: 1,

		// @option alt: String = ''
		// Text for the `alt` attribute of the image (useful for accessibility).
		alt: '',

		// @option interactive: Boolean = false
		// If `true`, the image overlay will emit [mouse events](#interactive-layer) when clicked or hovered.
		interactive: false,

		// @option crossOrigin: Boolean|String = false
		// Whether the crossOrigin attribute will be added to the image.
		// If a String is provided, the image will have its crossOrigin attribute set to the String provided. This is needed if you want to access image pixel data.
		// Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
		crossOrigin: false,

		// @option errorOverlayUrl: String = ''
		// URL to the overlay image to show in place of the overlay that failed to load.
		errorOverlayUrl: '',

		// @option zIndex: Number = 1
		// The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer.
		zIndex: 1,

		// @option className: String = ''
		// A custom class name to assign to the image. Empty by default.
		className: '',

		// @option decoding: String = 'auto'
		// Tells the browser whether to decode the image in a synchronous fashion,
		// as per the [`decoding` HTML attribute](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding).
		// If the image overlay is flickering when being added/removed, set
		// this option to `'sync'`.
		decoding: 'auto'
	};

	_image: HTMLImageElement | undefined;

	constructor(
		public _url: any, // TODO
		public _bounds: any, // TODO
		options: any, // TODO
	) {
		super();

		Util.setOptions(this, options);
	}

	onAdd(): this {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			this._image!.classList.add('leaflet-interactive'); // TODO: null safety
			this.addInteractiveTarget(this._image!); // TODO: null safety
		}

		this.getPane()!.appendChild(this._image!); // TODO: null safety
		this._reset();

		return this;
	}

	onRemove(): this {
		this._image!.remove(); // TODO: null safety

		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image!);
		}

		return this;
	}

	// Sets the opacity of the overlay.
	setOpacity(opacity: number): this {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	}

	setStyle(styleOpts: any): this {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	}

	// Brings the layer to the top of all overlays.
	bringToFront(): this {
		if (this._map) {
			DomUtil.toFront(this._image!); // TODO: null safety
		}
		return this;
	}

	// Brings the layer to the bottom of all overlays.
	bringToBack(): this {
		if (this._map) {
			DomUtil.toBack(this._image!); // TODO: null safety
		}
		return this;
	}

	// Changes the URL of the image.
	setUrl(url: string): this {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	}

	// Update the bounds that this ImageOverlay covers
	setBounds(bounds: LatLngBounds): this {
		this._bounds = bounds;

		if (this._map) {
			this._reset();
		}

		return this;
	}

	getEvents(): HandlerMap {
		const events: HandlerMap = {
			zoom: this._reset,
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	}

	// Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
	setZIndex(value: number): this {
		this.options.zIndex = value;
		this._updateZIndex();
		return this;
	}

	// Get the bounds that this ImageOverlay covers
	getBounds(): LatLngBounds {
		return this._bounds;
	}

	// Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
	// used by this overlay.
	getElement(): HTMLElement {
		return this._image!; // TODO: null safety
	}

	_initImage(): void {
		const wasElementSupplied = this._url.tagName === 'IMG';
		const img = this._image = wasElementSupplied ? this._url : DomUtil.create('img');

		img.classList.add('leaflet-image-layer');
		if (this._zoomAnimated) { img.classList.add('leaflet-zoom-animated'); }
		if (this.options.className) { img.classList.add(...Util.splitWords(this.options.className)); }

		img.onselectstart = Util.falseFn;
		img.onmousemove = Util.falseFn;

		// @event load: Event
		// Fired when the ImageOverlay layer has loaded its image
		img.onload = this.fire.bind(this, 'load');
		img.onerror = this._overlayOnError.bind(this);

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		img.decoding = this.options.decoding;

		if (this.options.zIndex) {
			this._updateZIndex();
		}

		if (wasElementSupplied) {
			this._url = img.src;
			return;
		}

		img.src = this._url;
		img.alt = this.options.alt;
	}

	_animateZoom(e: any): void {
		const
			scale = this._map!.getZoomScale(e.zoom), // TODO: null safety
		    offset = this._map!._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min; // TODO: null safety

		DomUtil.setTransform(this._image!, offset, scale); // TODO: null safety
	}

	_reset(): void {
		const
			image = this._image!, // TODO: null safety
		    bounds = new Bounds(
				// TODO: null safety
		        this._map!.latLngToLayerPoint(this._bounds.getNorthWest()),
				// TODO: null safety
		        this._map!.latLngToLayerPoint(this._bounds.getSouthEast()),
			),
		    size = bounds.getSize();

		DomUtil.setPosition(image, bounds.min);

		image.style.width  = `${size.x}px`;
		image.style.height = `${size.y}px`;
	}

	_updateOpacity(): void {
		// TODO: null safety
		this._image!.style.opacity = this.options.opacity as any; // automatically coerced to string
	}

	_updateZIndex(): void {
		if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			// TODO: null safety
			this._image!.style.zIndex = this.options.zIndex as any; // automatically coerced to string
		}
	}

	_overlayOnError(): void {
		// @event error: Event
		// Fired when the ImageOverlay layer fails to load its image
		this.fire('error');

		const errorUrl = this.options.errorOverlayUrl;
		if (errorUrl && this._url !== errorUrl) {
			this._url = errorUrl;
			this._image.src = errorUrl;
		}
	}

	// Returns the center of the ImageOverlay.
	getCenter(): LatLng {
		return this._bounds.getCenter();
	}

}
