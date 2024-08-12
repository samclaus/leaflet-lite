import type { Disposable, HandlerMap } from '../core';
import { DomUtil, type DomElement } from '../dom';
import { LatLng } from '../geog';
import { Point } from '../geom';
import type { Map, ZoomAnimationEvent } from '../map';

export interface NodeOptions {
	/**
	 * Which map pane to position the node within. 'marker' by default.
	 */
	pane: string;
	/**
	 * Whether the user can interact with this marker, e.g., by dragging. True by default.
	 */
	interactive: boolean;
}

/**
 * `Node` is used to position a DOM element at a single coordinate on the map. Essentially,
 * you must provide the dimensions (width and height) of the element, an X and Y coordinate
 * within the element's width/height to determine which part of the element will be
 * "anchored" to the coordinate on the map, and then Leaflet Lite will manipulate the
 * element's CSS transform to keep it positioned correctly.
 *
 * ```js
 * const img = document.createElement('img');
 * img.src = '/path/to/beach-ball.png';
 * img.alt = 'A beach ball with white and blue stripes.';
 * 
 * // NOTE: Constructing the Node will add it to the map immediately
 * const imgNode = new Node(
 *     myMap,
 *     img,
 * 
 *     // St. Augustine Beach, FL
 *     new LatLng(29.85707, 81.26591),
 * 
 *     // The beach ball picture is 50x50 pixels
 *     new Point(50, 50),
 * 
 *     // Anchor the middle X coordinate and *almost* the bottom Y so the
 *     // beach ball sits slightly above where it would if we centered it
 *     // on the coordinates
 *     new Point(25, 40),
 * 
 *     // Could provide additional options, but we will use the defaults
 * );
 * 
 * // Still just a standard DOM element, see?
 * img.addEventListener('click', ev => {
 *     // Remove it from the map when clicked
 *     imgNode.dispose();
 * });
 * 
 * // No need to use <img> elements--you could add <button>'s to the map
 * // if it makes sense for your use case!
 * ```
 * 
 * ### How does it work?
 * 
 * The `Node` class simply manipulates the CSS properties of the given DOM element
 * to position it in the relevant map pane (which itself is just a `<div>`). That
 * means you can use the element mostly as normal, including adding children to it
 * whenever/however you want. However, if you mess with the CSS properties that
 * `Node` uses to position the element, it will of course no longer be positioned
 * correctly. Here are the CSS properties manipulated by `Node`:
 * 
 * - `display: block`
 * - `width` and `height` to set the dimensions of the element
 * - `position: absolute`, `left: 0`, and `top: 0` to position the element in the
 *   pane's top-left corner
 * - `transform` is used to offset the element to the 'real' position via translation,
 *   as well as to give the element a desired amount of rotation
 * - `margin-left` and `margin-top` are used to achieve the anchor offset
 * - `z-index` is used to make nodes lower down on the map (higher Y coordinates) show
 *   on top of higher up nodes
 * 
 * And that's all there is to it! `Node` will add a `'focus'` event listener to the
 * element if `autoPanOnFocus` is true, but it does not call `preventDefault()` or
 * `stopPropagation()`.
 */
export class Node<El extends DomElement = DomElement> implements Disposable {
	// TODO: rename to "Point"

	/**
	 * This field exists purely for the application's use. Leaflet Lite does not use
	 * read or write to it. It should generally be used to associate app-specific IDs
	 * with Leaflet elements for the sake of event handling.
	 * 
	 * For example, let's say you load a list of restaurants from your server, as a
	 * JSON array. Each restaurant has a randomly generated string ID for referencing
	 * it in the database on the server. Your application JavaScript can loop over the
	 * array of restaurant objects (JSON), creating a marker on the map for each one,
	 * but also setting the 'data' field to the restaurant ID. Then, when Leaflet tells
	 * you that a marker was clicked, you can grab the restaurant ID from the 'data'
	 * field of the marker associated with the event, and pull some additional info
	 * about the restaurant from your server to show in a pop-up UI.
	 */
	appData: any;

	_events: HandlerMap = {
		zoom: this._update,
		viewreset: this._update,
	};
	_disposed = false;

	/**
	 * 2D rotation of the marker, in degrees. 0 by default.
	 */
	_rotation = 0;
	_size: Point;
	_anchor: Point;

	constructor(
		public _map: Map,
		public _el: El,
		public _latlng: LatLng,
		size: Point,
		anchor: Point,
		opts?: Partial<NodeOptions>,
	) {
		_map.on(this._events, this);

		if (_map._zoomAnimated) {
			_el.classList.add('leaflet-zoom-animated')
			_map.on('zoomanim', this._animateZoom, this);
		}
		if (opts?.interactive) {
			_el.classList.add('leaflet-interactive');
		}

		this._size = size.clone();
		this._anchor = anchor.clone();

		_el.classList.add('leaflet-marker-icon');
		_el.style.width  = `${size.x}px`;
		_el.style.height = `${size.y}px`;
		_el.style.marginLeft = `-${anchor.x}px`;
		_el.style.marginTop  = `-${anchor.y}px`;

		if (!this._map._zoomAnimated) {
			_el.classList.add('leaflet-zoom-hide');
		}

		this._update();

		_map.pane(opts?.pane ?? 'marker').appendChild(_el);
	}

	_update(): this {
		const pos = this._map.latLngToLayerPoint(this._latlng).round();
		this._setPos(pos);
		return this;
	}

	_setPos(pos: Point): void {
		DomUtil.setPosition(this._el, pos);

		this._el.style.transform += ` rotateZ(${this._rotation}deg)`;
		this._el.style.zIndex = pos.y as any; // Automatically coerced to string
	}

	_animateZoom(ev: ZoomAnimationEvent): void {
		this._setPos(
			this._map._latLngToNewLayerPoint(
				this._latlng,
				ev.zoom,
				ev.center,
			).round(),
		);
	}

	// Changes the marker position to the given point.
	setLatLng(latlng: LatLng): this {
		this._latlng = latlng;
		return this._update();
	}

	setRotation(degrees: number): this {
		this._rotation = degrees;
		return this._update();
	}

	dispose(): void {
		if (!this._disposed) {
			const { _map, _el } = this;

			_map.off(this._events, this);

			if (_map._zoomAnimated) {
				_map.off('zoomanim', this._animateZoom, this);
			}

			_el.remove();
	
			this._map = undefined as any;
			this._el = undefined as any;
			this._events = undefined as any;
			this._disposed = true;
		}
	}

}

/**
 * Pans the given node's map so that the node is visible, taking the anchor
 * coordinates into account.
 * 
 * This could be used for keyboard accessibility when adding a `<button>` node
 * to the map, by panning to the node when it receives a `'focus'` event.
 * Alternatively, it could be useful if the user selects something from outside
 * of the map which has a corresponding node on the map.
 */
export function panNodeIntoView(node: Node): void {
	node._map.panInside(node._latlng, {
		paddingTopLeft: node._anchor,
		paddingBottomRight: node._size.subtract(node._anchor),
	});
}
