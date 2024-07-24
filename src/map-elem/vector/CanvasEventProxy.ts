import { GeomUtil, type Point } from "../../geom";
import type { Canvas } from "./Canvas";
import { CircleMarker } from "./CircleMarker";
import { Polygon } from "./Polygon";
import { Polyline } from "./Polyline";

export interface InteractivePath {
	/**
	 * Tests if a point lies on/inside the path. This is used for hitbox testing
	 * so mouse events on the canvas can be mapped to a particular path.
	 */
	_containsPoint(p: Point): boolean;
}

(CircleMarker.prototype as any)._containsPoint = function (this: CircleMarker, p: Point): boolean {
	// TODO: null safety
	return p.distanceTo(this._point!) <= this._radius + this._clickTolerance();
};

(Polyline.prototype as any)._containsPoint = function (p: Point, closed?: boolean): boolean {
	let i, j, k, len, len2, part;
	const w = this._clickTolerance();

	if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

	// hit detection for polylines
	for (i = 0, len = this._parts.length; i < len; i++) {
		part = this._parts[i];

		for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
			if (!closed && (j === 0)) { continue; }

			if (GeomUtil.pointToSegmentDistance(p, part[k], part[j]) <= w) {
				return true;
			}
		}
	}
	return false;
};

// Needed by the `Canvas` renderer for interactivity
(Polygon.prototype as any)._containsPoint = function (this: Polygon, p: Point): boolean {
	let
		inside = false,
		part, p1, p2, i, j, k, len, len2;

	if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

	// ray casting algorithm for detecting if point is in polygon
	for (i = 0, len = this._parts.length; i < len; i++) {
		part = this._parts[i];

		for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
			p1 = part[j];
			p2 = part[k];

			if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
				inside = !inside;
			}
		}
	}

	// also check if it's on polygon stroke
	return inside || (Polyline.prototype as any)._containsPoint.call(this, p, true);
}

/**
 * TODO: this class will implement mouse event -> path mapping, which was
 * always included on the Canvas renderer before.
 */
export class CanvasEventProxy {

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	constructor(
		public _canvas: Canvas,
	) {
		_canvas._el.classList.add('leaflet-interactive');

		// TODO: this._initContainer(), etc. etc.
	}

	_initContainer(): void {
		DomEvent.on(this._el, 'mousemove', this._onMouseMove, this);
		DomEvent.on(this._el, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		DomEvent.on(this._el, 'mouseout', this._handleMouseOut, this);
		this._el['_leaflet_disable_events'] = true;
		// TODO: need to remove all these event handlers now that this is no longer integrated
		// with BlanketOverlay (which has been removed), since BlanketOverlay used to call
		// DomEvent.off() to remove all event handlers, but I would like to not store event
		// handlers in the first place
	}

	_onClick(e: any): void {
		const point = this._map!.mouseEventToLayerPoint(e); // TODO: null safety

		let clickedLayer: Path | undefined;

		for (const path of this._drawOrder) {
			if (path.options.interactive && path._containsPoint(point)) {
				if (
					!(e.type === 'click' || e.type === 'preclick') ||
					!this._map!._draggableMoved(path) // TODO: null safety
				) {
					// TODO: just iterate array backwards and return immediately here?
					clickedLayer = path;
				}
			}
		}

		this._fireEvent(e, undefined, clickedLayer ? [clickedLayer] : undefined);
	}

	_onMouseMove(e: any): void {
		if (!this._map || this._map.dragging?.moving() || this._map._animatingZoom) { return; }

		const point = this._map.mouseEventToLayerPoint(e);
		this._handleMouseHover(e, point);
	}

	_handleMouseOut(e: any): void {
		const path = this._hoveredPath;

		if (path) {
			// if we're leaving the layer, fire mouseout
			this._el.classList.remove('leaflet-interactive');
			this._fireEvent(e, 'mouseout', [path]);
			this._hoveredPath = undefined;
			this._mouseHoverThrottled = false;
		}
	}

	_handleMouseHover(e: any, point: Point): void {
		if (this._mouseHoverThrottled) {
			return;
		}

		let candidateHoveredLayer: Path | undefined;

		for (const path of this._drawOrder) {
			if (path.options.interactive && path._containsPoint(point)) {
				// TODO: iterate array backwards and break loop here?
				candidateHoveredLayer = path;
			}
		}

		if (candidateHoveredLayer !== this._hoveredPath) {
			this._handleMouseOut(e);

			if (candidateHoveredLayer) {
				this._el.classList.add('leaflet-interactive'); // change cursor
				this._fireEvent(e, 'mouseover', [candidateHoveredLayer]);
				this._hoveredPath = candidateHoveredLayer;
			}
		}

		this._fireEvent(e, undefined, this._hoveredPath ? [this._hoveredPath] : undefined);

		this._mouseHoverThrottled = true;
		setTimeout((() => {
			this._mouseHoverThrottled = false;
		}), 32);
	}

	_fireEvent(e: any, type?: string, paths?: Path[]): void {
		// TODO: null safety
		this._map!._fireDOMEvent(e, type || e.type, paths); // TODO: paths are no longer Eventeds because they do not inherit Layer and I want to keep them lightweight
	}

}