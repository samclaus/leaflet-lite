import { Util } from '../core';
import { DomUtil } from '../dom';
import { ImageOverlay, type ImageOverlayOptions } from './ImageOverlay.js';

export interface VideoOverlayOptions extends ImageOverlayOptions {
	/**
	 * Whether the video starts playing automatically when loaded.
	 * On some browsers autoplay will only work with `muted: true`.
	 * True by default.
	 */
	autoplay: boolean;
	/**
	 * Whether the video will loop back to the beginning when played.
	 * True by default.
	 */
	loop: boolean;
	/**
	 * Whether the video will save aspect ratio after the projection.
	 * Relevant for supported browsers. See [browser compatibility](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit).
	 * True by default.
	 */
	keepAspectRatio: boolean;
	/**
	 * Whether the video starts on mute when loaded. True by default.
	 */
	muted: boolean;
	/**
	 * Mobile browsers will play the video right where it is instead of
	 * opening it up in fullscreen mode. True by default.
	 */
	playsInline: boolean;
}

/**
 * Used to load and display a video player over specific bounds of the map. Extends `ImageOverlay`.
 *
 * A video overlay uses the [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video)
 * HTML element.
 *
 * ```js
 * const
 *     videoUrl = 'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
 * 	   videoBounds = [[ 32, -130], [ 13, -100]],
 *     videoOverlay = L.videoOverlay(videoUrl, videoBounds);
 * 
 * map.addLayer(videoOverlay);
 * ```
 */
export class VideoOverlay extends ImageOverlay {

	declare options: VideoOverlayOptions;

	constructor(url: any, bounds: any, options?: Partial<VideoOverlayOptions>) {
		super(url, bounds, options);

		Util.setOptions(this, options, {
			autoplay: true,
			loop: true,
			keepAspectRatio: true,
			muted: true,
			playsInline: true
		});
	}

	_initImage(): void {
		const wasElementSupplied = this._url.tagName === 'VIDEO';
		const vid = this._image = wasElementSupplied ? this._url : DomUtil.create('video');

		vid.classList.add('leaflet-image-layer');

		if (this._map!._zoomAnimated) { // TODO: null safety
			vid.classList.add('leaflet-zoom-animated');
		}

		if (this.options.className) {
			vid.classList.add(...Util.splitWords(this.options.className));
		}

		vid.onselectstart = Util.falseFn;
		vid.onmousemove = Util.falseFn;

		// @event load: Event
		// Fired when the video has finished loading the first frame
		vid.onloadeddata = this.fire.bind(this, 'load');

		if (wasElementSupplied) {
			const sourceElements = vid.getElementsByTagName('source');
			const sources = [];
			for (let j = 0; j < sourceElements.length; j++) {
				sources.push(sourceElements[j].src);
			}

			this._url = (sourceElements.length > 0) ? sources : [vid.src];
			return;
		}

		if (!Array.isArray(this._url)) { this._url = [this._url]; }

		if (!this.options.keepAspectRatio && Object.hasOwn(vid.style, 'objectFit')) {
			vid.style['objectFit'] = 'fill';
		}

		vid.autoplay = !!this.options.autoplay;
		vid.loop = !!this.options.loop;
		vid.muted = !!this.options.muted;
		vid.playsInline = !!this.options.playsInline;

		for (let i = 0; i < this._url.length; i++) {
			const source = DomUtil.create('source') as HTMLSourceElement;
			source.src = this._url[i];
			vid.appendChild(source);
		}
	}

}
