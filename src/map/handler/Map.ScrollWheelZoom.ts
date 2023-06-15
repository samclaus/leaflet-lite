import { Handler, Map } from '..';
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
}

/**
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */
export class ScrollWheelZoom extends Handler {

	_delta = 0;
	_lastMousePos = new Point(0, 0);
	_startTime = 0;
	_timer: number | undefined;
	_debounceTime: number;
	_pxPerZoomLevel: number;

	constructor(
		map: Map,
		{
			debounceTime = 40,
			pxPerZoomLevel = 60,
		}: Partial<ScrollWheelZoomOptions> = {},
	) {
		super(map);

		this._debounceTime = debounceTime;
		this._pxPerZoomLevel = pxPerZoomLevel;
	}

	addHooks(): void {
		DomEvent.on(this._map._container, 'wheel', this._onWheelScroll, this);

		this._delta = 0;
	}

	removeHooks(): void {
		DomEvent.off(this._map._container, 'wheel', this._onWheelScroll, this);
	}

	_onWheelScroll(e: WheelEvent): void {
		const delta = DomEvent.getWheelDelta(e);
		const debounce = this._map.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);
		this._startTime ||= Date.now();

		const left = Math.max(debounce - (Date.now() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(this._performZoom.bind(this), left);

		DomEvent.stop(e);
	}

	_performZoom(): void {
		const
			map = this._map,
		    zoom = map._zoom,
		    snap = this._map.options.zoomSnap || 0;

		map._stop(); // stop panning and fly animations if any

		// map the delta with a sigmoid function to -4..4 range leaning on -1..1
		const
			d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4),
		    d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
		    d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
		    delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

		this._delta = 0;
		this._startTime = 0;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}

}
