import { Util } from '../../core';
import { Point } from '../../geom';
import { Icon, type IconOptions } from './Icon.js';

export interface DivIconOptions extends IconOptions {
	/**
	 * Custom HTML code to put inside the div element, empty by default.
	 * Alternatively, an instance of `HTMLElement`.
	 */
	html: string | HTMLElement;
	/**
	 * Optional relative position of the background, in pixels.
	 */
	bgPos: Point | undefined;
}

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

	declare options: DivIconOptions;

	constructor(options: DivIconOptions) {
		super(options);

		Util.setOptions(this, options, {
			iconSize: new Point(12, 12), // also can be set through CSS
			html: '',
			bgPos: new Point(0, 0),
			className: 'leaflet-div-icon',
		});
	}

	// TODO: types are not compatible because Icon parent class expects HTMLImageElement
	// everywhere--honestly I kinda feel like this should be the generic icon class which
	// doesn't really care about the element type, and this should be inherited by an
	// img-based icon class.
	createIcon(el: any = document.createElement('div')): any {
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
