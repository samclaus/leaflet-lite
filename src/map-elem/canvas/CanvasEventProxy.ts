
/**
 * TODO: this class will implement mouse event -> path mapping, which was
 * always included on the Canvas renderer before.
 */
export class CanvasEventProxy {

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	_initContainer(): void {
		DomEvent.on(this._el, 'mousemove', this._onMouseMove, this);
		DomEvent.on(this._el, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		DomEvent.on(this._el, 'mouseout', this._handleMouseOut, this);
		this._el['_leaflet_disable_events'] = true;
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