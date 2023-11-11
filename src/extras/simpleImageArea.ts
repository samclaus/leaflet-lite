import { Util } from '../core';
import type { LatLngBounds } from '../geog';
import { Point } from '../geom';
import type { Map } from '../map';
import { Area, type AreaOptions } from '../map-elem';

export interface ImageAreaOptions extends Partial<AreaOptions> {
	/**
	 * The geographic bounds which should be covered by the `<img>` element.
	 */
	bounds: LatLngBounds;
	/**
	 * Existing `<img>` element or all the critical information for creating one.
	 */
	img: HTMLImageElement | {
		/**
		 * URL to the image content.
		 */
		src: string;
		/**
		 * Width (x) and height (y) of the image. This will be used to set the
		 * width and height attributes of the image, which should correspond to
		 * the actual pixel dimensions of a bitmap image (or the desired
		 * dimensions in the case of a vector image).
		 * 
		 * If the size of the image is not proportional to the size of the bounds
		 * it will cover on the map (which are used to calculate its CSS width and
		 * height), the image may appear distorted, depending on other CSS properties
		 * you set.
		 */
		size: Point;
		/**
		 * Text for the `alt` attribute of the image (useful for accessibility).
		 */
		alt: string;
	};
	/**
	 * A custom class name to assign to the image. Empty by default.
	 */
	className?: string | undefined;
	/**
	 * Opacity of the image overlay in range [0, 1]. 1 (fully opaque) by default.
	 */
	opacity?: number | undefined;
	/**
	 * Whether the crossOrigin attribute will be added to the image. If a string is
	 * provided, the image will have its crossOrigin attribute set to the string
	 * provided. This is needed if you want to access image pixel data. Refer to
	 * [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)
	 * for possible values.
	 */
	crossOrigin: string | undefined;
	/**
	 * URL to the overlay image to show in place of the overlay that failed to load.
	 */
	errorOverlayUrl?: string | undefined;
	/**
	 * Tells the browser whether to decode the image in a synchronous fashion,
	 * as per the [`decoding` HTML attribute](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding).
	 * If the image overlay is flickering when being added/removed, set
	 * this option to `'sync'`. 'auto' by default.
	 */
	decoding?: 'async' | 'sync' | 'auto' | undefined;
	/**
	 * The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer. 1 by default.
	 */
	zIndex?: number | undefined;
}

/**
 * Creates an `Area` which positions an `<img>` element such that it covers the
 * given geographic bounds on the map.
 * 
 * This function is mostly intended as an example to showcase that Leaflet Lite
 * does not attempt to wrap or otherwise obscure the vanilla DOM (HTML) API.
 * Most of the options that can be passed are directly used to configure
 * properties on the `<img>`.
 */
export function simpleImageArea(map: Map, opts: ImageAreaOptions): Area<HTMLImageElement> {
	let img: HTMLImageElement;

	if (opts.img instanceof HTMLImageElement) {
		img = opts.img;
	} else {
		const { src, size, alt } = opts.img;

		img = new Image(size.x, size.y);
		img.src = src;
		img.alt = alt;
	}

	if (opts.className) {
		img.classList.add(...Util.splitWords(opts.className));
	}
	if (typeof opts.opacity === 'number') {
		img.style.opacity = opts.opacity as any; // automatically coerced to string
	}
	if (typeof opts.zIndex === 'number') {
		img.style.zIndex = opts.zIndex as any; // automatically coerced to string
	}

	// TODO: taken from Leaflet, not sure why they did it
	img.onselectstart = Util.falseFn;
	img.onmousemove = Util.falseFn;

	if (opts.errorOverlayUrl) {
		// Capture value in case options object gets changed after this function is called
		const url = opts.errorOverlayUrl;

		// NOTE: uses 'onerror' property of the <img> rather than 'addEventListener' method
		// so the caller of this function can remove the error handler despite it being an
		// anonymous closure (to call 'removeEventListener' you have to pass the function
		// that was originally passed to 'addEventListener')
		img.onerror = (): void => {
			img.src = url;
		};
	}

	if (typeof opts.crossOrigin === 'string') {
		img.crossOrigin = opts.crossOrigin;
	}
	if (typeof opts.decoding === 'string') {
		img.decoding = opts.decoding;
	}

	// Area will take care of adding the image to the DOM and positioning it on the map;
	// see its documentation for more information
	return new Area(map, img, opts.bounds, opts);
}
