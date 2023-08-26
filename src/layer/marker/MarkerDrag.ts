import type { Disposable } from '../../core';
import { DomUtil, Draggable } from '../../dom';
import type { LatLng } from '../../geog';
import { Bounds, Point } from '../../geom';
import type { Map } from '../../map';
import { Marker } from './Marker.js';

/**
 * MarkerDrag is used to make Markers draggable. It adds event listeners upon being
 * constructed, and you must `dispose()` of it to remove the behavior.
 *
 * @property dragging: Handler
 * Marker dragging handler (by both mouse and touch). Only valid when the marker is
 * on the map (Otherwise set [`marker.options.draggable`](#marker-draggable)).
 */
export class MarkerDrag implements Disposable {

	_oldLatLng: LatLng | undefined;
	_panFrame = 0;
	_draggable: Draggable;

	constructor(
		public _map: Map,
		public _marker: Marker,
		/**
		 * Whether to pan the map when dragging this marker near its edge or not.
		 * False by default.
		 */
		public _autoPan = false,
		/**
		 * Distance (in pixels to the left/right and to the top/bottom) of the
		 * map edge to start panning the map. (50, 50) by default.
		 */
		public _autoPanPadding = new Point(50, 50),
		/**
		 * Number of pixels the map should pan by. TODO: each second? 10 by default.
		 */
		public _autoPanSpeed = 10,
	) {
		/**
		 * @deprecated This is only here for the _draggableMoved() method of Map, which needs to
		 * be investigated and refactored.
		 */
		_marker.dragging = this;

		const icon = this._marker._icon;

		this._draggable = new Draggable(icon, icon, true);
		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		icon.classList.add('leaflet-marker-draggable');
	}

	dispose(): void {
		this._draggable.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		this._marker._icon.classList.remove('leaflet-marker-draggable');
	}

	/**
	 * @deprecated This is only here for the _draggableMoved() method of Map, which needs to
	 * be investigated and refactored.
	 */
	enabled(): boolean {
		return this._draggable._enabled;
	}

	moved(): boolean {
		return this._draggable._moved;
	}

	_adjustPan(e: any): void { // TODO: stronger types
		const
			marker = this._marker,
		    map = marker._map!, // TODO: null safety
		    speed = this._autoPanSpeed,
		    padding = this._autoPanPadding,
		    iconPos = DomUtil.getPosition(marker._icon),
		    bounds = map.getPixelBounds(),
		    origin = map.getPixelOrigin(),
			panBounds = new Bounds(
				bounds.min._subtract(origin).add(padding),
				bounds.max._subtract(origin).subtract(padding),
			);

		if (!panBounds.contains(iconPos)) {
			// Compute incremental movement
			const movement = new Point(
				(Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) -
				(Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),

				(Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) -
				(Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y),
			).multiplyBy(speed);

			map.panBy(movement, {animate: false});

			this._draggable._newPos!._add(movement); // TODO: null safety
			this._draggable._startPos!._add(movement); // TODO: null safety

			DomUtil.setPosition(marker._icon, this._draggable._newPos!); // TODO: null safety
			this._onDrag(e);

			this._panFrame = requestAnimationFrame(() => this._adjustPan(e));
		}
	}

	_onDragStart(): void {
		this._oldLatLng = this._marker.getLatLng();

		// @section Dragging events
		// @event movestart: Event
		// Fired when the marker starts moving (because of dragging).
		// @event dragstart: Event
		// Fired when the user starts dragging the marker.
		this._marker
			.fire('movestart')
			.fire('dragstart');
	}

	_onPreDrag(e: Event): void {
		if (this._autoPan) {
			cancelAnimationFrame(this._panFrame);
			this._panFrame = requestAnimationFrame(() => this._adjustPan(e));
		}
	}

	_onDrag(e: any): void { // TODO: stronger types
		const
			marker = this._marker,
		    iconPos = DomUtil.getPosition(marker._icon),
		    latlng = marker._map!.layerPointToLatLng(iconPos); // TODO: null safety

		marker._latlng = latlng;

		e.latlng = latlng;
		e.oldLatLng = this._oldLatLng;

		// @event drag: Event
		// Fired repeatedly while the user drags the marker.
		marker
		    .fire('move', e)
		    .fire('drag', e);
	}

	_onDragEnd(e: Event): void {
		cancelAnimationFrame(this._panFrame);

		// @event moveend: Event
		// Fired when the marker stops moving (because of dragging).
		// @event dragend: DragEndEvent
		// Fired when the user stops dragging the marker.
		this._oldLatLng = undefined;
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}

}
