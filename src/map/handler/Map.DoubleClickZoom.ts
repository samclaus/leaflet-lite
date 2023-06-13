import { Handler } from '..';

/**
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */
export class DoubleClickZoom extends Handler {

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

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}

}
