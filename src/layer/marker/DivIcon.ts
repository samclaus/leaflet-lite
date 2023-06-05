import {Icon} from './Icon.js';
import {Point, toPoint as point} from '../../geometry/Point.js';

/**
 * Represents a lightweight icon for markers that uses a simple `<div>`
 * element instead of an image. Inherits from `Icon` but ignores the `iconUrl` option.
 *
 * ```js
 * var myIcon = L.divIcon({className: 'my-div-icon'});
 * // you can set .my-div-icon styles in CSS
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
 */
export class DivIcon extends Icon {

	options = {
		// @section
		// @aka DivIcon options
		iconSize: [12, 12], // also can be set through CSS

		// iconAnchor: (Point),
		// popupAnchor: (Point),

		// @option html: String|HTMLElement = ''
		// Custom HTML code to put inside the div element, empty by default. Alternatively,
		// an instance of `HTMLElement`.
		html: '',

		// Optional relative position of the background, in pixels
		bgPos: new Point(0, 0),

		className: 'leaflet-div-icon',
	};

	createIcon(el: HTMLElement = document.createElement('div')): HTMLElement {
		const {html, bgPos} = this.options;

		if (html instanceof Element) {
			el.replaceChildren();
			el.appendChild(html);
		} else {
			el.innerHTML = html;
		}

		if (bgPos) {
			el.style.backgroundPosition = `${-bgPos.x}px ${-bgPos.y}px`;
		}
		this._setIconStyles(el);

		return el;
	}

}
