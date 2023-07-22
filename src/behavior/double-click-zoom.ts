import type { DisposeFn } from '../core';
import type { Map } from '../map';

export interface DoubleClickZoomOptions {
	/**
	 * Should double-click zoom to the center of the view regardless
	 * of where the mouse was? Default is false.
	 */
	centered: boolean;
}

/**
 * Listens on the map for 'dblclick' events and zoom it accordingly.
 */
export function enableDoubleClickZoom(map: Map, options?: Partial<DoubleClickZoomOptions>): DisposeFn {
	function onDoubleClick(e: any): void { // TODO: type the parameter
		const
		    oldZoom = map._zoom,
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (options?.centered) {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}

	function disableDoubleClickZoom(): void {
		map.off('dblclick', onDoubleClick);
	}

	map.on('dblclick', onDoubleClick);
	map.on('unload', disableDoubleClickZoom, undefined, true);

	return disableDoubleClickZoom;
}
