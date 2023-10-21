import { Util } from '../core';
import { ImageOverlay } from './ImageOverlay.js';

/**
 * Used to load, display and provide DOM access to an SVG file over specific bounds of the map. Extends `ImageOverlay`.
 *
 * An SVG overlay uses the [`<svg>`](https://developer.mozilla.org/docs/Web/SVG/Element/svg) element.
 *
 * ```js
 * var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 * svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
 * svgElement.setAttribute('viewBox', "0 0 200 200");
 * svgElement.innerHTML = '<rect width="200" height="200"/><rect x="75" y="23" width="50" height="50" style="fill:red"/><rect x="75" y="123" width="50" height="50" style="fill:#0013ff"/>';
 * var svgElementBounds = [ [ 32, -130 ], [ 13, -100 ] ];
 * var svgOverlay = L.svgOverlay(svgElement, svgElementBounds);
 * 
 * map.addLayer(svgOverlay);
 * ```
 */
export class SVGOverlay extends ImageOverlay {

	_initImage(): void {
		const el = this._image = this._url as HTMLImageElement; // TODO: actually an SVG element

		el.classList.add('leaflet-image-layer');

		if (this._map!._zoomAnimated) { // TODO: null safety
			el.classList.add('leaflet-zoom-animated');
		}

		if (this.options.className) {
			el.classList.add(...Util.splitWords(this.options.className));
		}

		el.onselectstart = Util.falseFn;
		el.onmousemove = Util.falseFn;
	}

}
