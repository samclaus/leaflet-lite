import { Point } from '../../geom';

export interface IconOptions {
	/**
	 * The URL to the icon image (absolute or relative to your script path).
	 */
	iconUrl: string;
	/**
	 * Width/height of the icon in pixels.
	 */
	iconSize: Point;
	/**
	 * The coordinates of the "tip" of the icon (relative to its top left corner). The icon
	 * will be aligned so that this point is at the marker's geographical location. Centered
	 * by default if size is specified, also can be set in CSS with negative margins.
	 */
	iconAnchor?: Point | undefined;
	/**
	 * The coordinates of the point from which tooltips will "open", relative to the icon anchor.
	 */
	tooltipAnchor?: Point;
	/**
	 * A custom class name to assign to icon <img> element. Empty by default.
	 */
	className?: string;
	/**
	 * Whether the crossOrigin attribute will be added to the tiles.
	 * If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
	 * Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
	 */
	crossOrigin?: string | boolean;
}

/**
 * Represents an icon to provide when creating a marker.
 *
 * ```js
 * var myIcon = L.icon({
 *     iconUrl: 'my-icon.png',
 *     iconSize: [38, 95],
 *     iconAnchor: [22, 94],
 * });
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * Use the `defaultIcon()` factory to instantiate the icon Leaflet uses for markers by default.
 *
 */
export class Icon {

	options: Required<IconOptions>;

	constructor(options: IconOptions) {
		// TODO: how to make TypeScript not complain? This code should be correct, but
		// apparently Required<T> strips away 'undefined' from the property types, not
		// just the '?' optional presence operator
		this.options = {
			tooltipAnchor: new Point(0, 0),
			crossOrigin: false,
			className: '',
			...options,
		} as any;
	}

	// Called internally when the icon has to be shown, returns a `<img>` HTML element
	// styled according to the options.
	createIcon(el: HTMLImageElement = document.createElement("img")): HTMLImageElement {
		const {iconUrl, crossOrigin} = this.options as IconOptions;
		el.src = iconUrl;
		this._setIconStyles(el);

		if (crossOrigin || crossOrigin === '') {
			el.crossOrigin = crossOrigin === true ? '' : crossOrigin;
		}

		return el;
	}

	_setIconStyles(el: HTMLImageElement): void {
		this.options.iconAnchor
		const {
			iconSize,
			iconAnchor = iconSize.divideBy(2),
			className,
		} = this.options;

		el.className = `leaflet-marker-icon ${className}`;
		el.style.width  = `${iconSize.x}px`;
		el.style.height = `${iconSize.y}px`;
		el.style.marginLeft = `${-iconAnchor.x}px`;
		el.style.marginTop  = `${-iconAnchor.y}px`;
	}

}
