import { Point } from '../../geom';
import { Icon } from './Icon.js';

/**
 * Creates an icon that consists of a single `<img>` element. The element will
 * be given a `'leaflet-marker-icon'` to add critical styles.
 */
export function imgIcon(
	/**
	 * URL for the `'src'` attribute of the `<img>`.
	 */
	src: string,
	/**
	 * Descriptive text for the `'alt'` attribute of the `<img>`.
	 * Required for accessibility.
	 */
	alt: string,
	/**
	 * Width (x) and height (y) of the `<img>`, in pixels.
	 */
	size: Point,
	/**
	 * Coordinate within the `<img>` that should be anchored to a particular
	 * coordinate on the map. This will be achieved using negative left and
	 * top CSS margins on the element.
	 */
	anchor: Point,
): Icon {
	const el = new Image(25, 41);
	
	el.src = src;
	el.alt = alt;
	el.className = 'leaflet-marker-icon';
	el.style.width  = `${size.x}px`;
	el.style.height = `${size.y}px`;
	el.style.marginLeft = `-${anchor.x}px`;
	el.style.marginTop  = `-${anchor.y}px`;

	return new Icon(el, size, anchor);
}

/**
 * Given the path to where you are hosting the blue marker icon which comes
 * with the Leaflet Lite NPM package as `/assets/marker.svg`, returns a
 * correctly configured marker icon ready for use.
 * 
 * ```js
 * import { defaultMarkerIcon } from 'leaflet-lite';
 * 
 * // If using Vite to bundle your JavaScript/TypeScript and assets, you can
 * // simply import the SVG file into your code and Vite will give you the
 * // runtime URL as a string: https://vitejs.dev/guide/features.html#static-assets
 * import blueMarkerURL from 'leaflet-lite/assets/marker.svg';
 * 
 * defaultMarkerIcon(blueMarkerURL);
 * ```
 */
export function defaultMarkerIcon(src: string): Icon {
	return imgIcon(
		src,
		'Blue map marker',
		new Point(25, 41),
		new Point(12, 41),
	);
}
