import { Handler, Map } from '..';

export interface DoubleClickZoomOptions {
	/**
	 * Should double-click zoom to the center of the view regardless
	 * of where the mouse was? Default is false.
	 */
	centered: boolean;
}

/**
 * L.Handler.DoubleClickZoom is used to enable double-click zoom on the map, enabled by default.
 */
export class DoubleClickZoom extends Handler {

	_centered: boolean;

	constructor(
		map: Map,
		{ centered = false }: Partial<DoubleClickZoomOptions> = {},
	) {
		super(map);

		this._centered = centered;
	}

	addHooks(): void {
		this._map.on('dblclick', this._onDoubleClick, this);
	}

	removeHooks(): void {
		this._map.off('dblclick', this._onDoubleClick, this);
	}

	_onDoubleClick(e: any): void { // TODO: type the parameter
		const
			map = this._map,
		    oldZoom = map._zoom,
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (this._centered) {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}

}
