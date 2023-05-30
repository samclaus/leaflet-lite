import { Handler } from '../../core/Handler.js';
import { Map } from '../Map.js';

/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

// @namespace Map
// @section Interaction Options

Map.mergeOptions({
	// @option doubleClickZoom: Boolean|String = true
	// Whether the map can be zoomed in by double clicking on it and
	// zoomed out by double clicking while holding shift. If passed
	// `'center'`, double-click zoom will zoom to the center of the
	//  view regardless of where the mouse was.
	doubleClickZoom: true
});

export const DoubleClickZoom = Handler.extend({
	addHooks() {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks() {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick(e) {
		const map = this._map,
		    oldZoom = map.getZoom(),
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});
