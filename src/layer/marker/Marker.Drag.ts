import type { LatLng, Map } from '../../Leaflet.js';
import { Handler } from '../../core/Handler.js';
import * as DomUtil from '../../dom/DomUtil.js';
import { Draggable } from '../../dom/Draggable.js';
import { Bounds } from '../../geometry/Bounds.js';
import { Point } from '../../geometry/Point.js';

/**
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 *
 * Interaction handlers are properties of a marker instance that allow you to control interaction behavior in runtime, enabling or disabling certain features such as dragging (see `Handler` methods). Example:
 *
 * ```js
 * marker.dragging.disable();
 * ```
 *
 * @property dragging: Handler
 * Marker dragging handler (by both mouse and touch). Only valid when the marker is on the map (Otherwise set [`marker.options.draggable`](#marker-draggable)).
 */

export class MarkerDrag extends Handler {

	_oldLatLng: LatLng | undefined;
	_panRequest = 0; // from requestAnimationFrame()
	_draggable: Draggable | undefined;

	constructor(
		map: Map,
		public _marker: any,
	) {
		super(map);
	}

	addHooks(): void {
		const icon = this._marker._icon;

		this._draggable ||= new Draggable(icon, icon, true);
		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		icon.classList.add('leaflet-marker-draggable');
	}

	removeHooks(): void {
		this._draggable!.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		if (this._marker._icon) {
			this._marker._icon.classList.remove('leaflet-marker-draggable');
		}
	}

	moved(): boolean {
		return !!this._draggable?._moved;
	}

	_adjustPan(e: Event): void {
		const
			marker = this._marker,
		    map = marker._map,
		    speed = this._marker.options.autoPanSpeed,
		    padding = this._marker.options.autoPanPadding,
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

			this._draggable._newPos._add(movement);
			this._draggable._startPos._add(movement);

			DomUtil.setPosition(marker._icon, this._draggable._newPos);
			this._onDrag(e);

			this._panRequest = requestAnimationFrame(() => this._adjustPan(e));
		}
	}

	_onDragStart(): void {
		this._oldLatLng = this._marker.getLatLng();

		// When using ES6 imports it could not be set when `Popup` was not imported as well
		this._marker.closePopup && this._marker.closePopup();

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
		if (this._marker.options.autoPan) {
			cancelAnimationFrame(this._panRequest);
			this._panRequest = requestAnimationFrame(() => this._adjustPan(e));
		}
	}

	_onDrag(e: Event): void {
		const
			marker = this._marker,
		    iconPos = DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		marker._latlng = latlng;

		// TODO: this is not great
		(e as any).latlng = latlng;
		(e as any).oldLatLng = this._oldLatLng;

		// @event drag: Event
		// Fired repeatedly while the user drags the marker.
		marker
		    .fire('move', e)
		    .fire('drag', e);
	}

	_onDragEnd(e: Event): void {
		cancelAnimationFrame(this._panRequest);

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
