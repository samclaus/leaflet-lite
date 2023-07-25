import { Point } from '../../geom';
import { Icon } from './Icon.js';

/**
 * Given the path to where you are hosting the blue marker icon which comes
 * with the Leaflet Lite NPM package as `/assets/marker.svg`, returns a
 * correctly configured marker icon ready for use.
 * 
 * ```js
 * import { defaultIcon } from 'leaflet-lite';
 * 
 * // If using Vite to bundle your JavaScript/TypeScript and assets, you can
 * // simply import the SVG file into your code and Vite will give you the
 * // runtime URL as a string: https://vitejs.dev/guide/features.html#static-assets
 * import blueMarkerURL from 'leaflet-lite/assets/marker.svg';
 * 
 * defaultIcon(blueMarkerURL);
 * ```
 */
export function defaultIcon(imgSrc: string): Icon {
	const el = new Image(25, 41);
	
	el.src = imgSrc;
	el.alt = 'Blue map marker';
	el.className = 'leaflet-marker-icon';
	el.style.width  = '25px';
	el.style.height = '41px';
	el.style.marginLeft = '-12px';
	el.style.marginTop  = '-41px';

	return new Icon(el, new Point(25, 41), new Point(12, 41));
}
