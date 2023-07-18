import type { Map } from '..';
import type { DisposeFn } from '../../core';
import { DomEvent } from '../../dom';
import { Point } from '../../geom';

export interface ScrollWheelZoomOptions {
	/**
	 * Limits the rate at which a wheel can fire (in milliseconds). Default
	 * value is 40, meaning the user can't zoom via wheel more often than
	 * once per 40 ms.
	 */
	debounceTime: number;
	/**
	 * How many scroll pixels (as reported by [DomEvent.getWheelDelta](#domevent-getwheeldelta))
	 * mean a change of one full zoom level. Smaller values will make wheel-zooming
	 * faster (and vice versa). Default is 60.
	 */
	pxPerZoomLevel: number;
	/**
	 * Should the map be zoomed at the center regardless of where the mouse was? Default is false.
	 */
	centered: boolean;
}

/**
 * Listen on the map for 'wheel' events and zoom it accordingly.
 */
export function enableScrollWheelZoom(map: Map, options: Partial<ScrollWheelZoomOptions> = {}): DisposeFn {
	const {
		debounceTime = 40,
		pxPerZoomLevel = 60,
		centered = false,
	} = options;

	let
		delta = 0,
		startTime = 0,
		lastMousePos = new Point(0, 0),
		timer: number | undefined;

	function performZoom(): void {
		const
			zoom = map._zoom,
			snap = map.options.zoomSnap || 0;

		map._stop(); // stop panning and fly animations if any

		// map the delta with a sigmoid function to -4..4 range leaning on -1..1
		const
			d2 = delta / (pxPerZoomLevel * 4),
			d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
			d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
			niceDelta = map._limitZoom(zoom + (delta > 0 ? d4 : -d4)) - zoom;

		delta = 0;
		startTime = 0;

		if (!niceDelta) { return; }

		if (centered) {
			map.setZoom(zoom + niceDelta);
		} else {
			map.setZoomAround(lastMousePos, zoom + niceDelta);
		}
	}

	function onWheelScroll(e: WheelEvent): void {
		delta += DomEvent.getWheelDelta(e);
		lastMousePos = map.mouseEventToContainerPoint(e);
		startTime ||= Date.now();

		const left = Math.max(debounceTime - (Date.now() - startTime), 0);

		clearTimeout(timer);
		timer = setTimeout(performZoom, left);

		DomEvent.stop(e);
	}

	DomEvent.on(map._container, 'wheel', onWheelScroll);
	
	return function(): void {
		DomEvent.off(map._container, 'wheel', onWheelScroll);
	};
}
