import type { Map } from '..';
import type { DisposeFn } from '../../core';

export interface DoubleClickZoomOptions {
	/**
	 * Should double-click zoom to the center of the view regardless
	 * of where the mouse was? Default is false.
	 */
	centered: boolean;
}

/**
 * Listen on the map for 'dblclick' events and zoom it accordingly.
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

	map.on('dblclick', onDoubleClick);

	return function(): void {
		map.off('dblclick', onDoubleClick);
	};
}
