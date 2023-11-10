import type { LatLng } from '../geog';
import { Point } from '../geom';
import type { Map } from '../map';
import { Node } from '../map-elem';

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
export function defaultMarkerIcon(
	map: Map,
	src: string,
	latlng: LatLng,
): Node<HTMLImageElement> {
	// NOTE: Image() constructor is the same as document.createElement('img') but
	// more concise and also sets the width/height attributes at construction
	const
		size = new Point(25, 41),
		el = new Image(size.x, size.y);

	el.src = src;
	el.alt = 'Blue map marker';

	// NOTE: Node() will handle setting the element's CSS width/height and margins
	// (for anchor alignment), so we only needed to set img-specific attributes in
	// our code above
	return new Node(
		map,
		el,
		latlng,
		size,
		new Point(12, 41),
	);
}
