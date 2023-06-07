import { Handler } from '../../core/Handler.js';
import { Draggable } from '../../dom/Draggable.js';
import { Bounds } from '../../geometry/Bounds.js';
import { Map } from '../Map.js';

export interface DragOptions {
	// @option dragging: Boolean = true
	// Whether the map is draggable with mouse/touch or not.
	dragging: boolean;

	// @section Panning Inertia Options
	// @option inertia: Boolean = *
	// If enabled, panning of the map will have an inertia effect where
	// the map builds momentum while dragging and continues moving in
	// the same direction for some time. Feels especially nice on touch
	// devices. Enabled by default.
	inertia: boolean;

	// @option inertiaDeceleration: Number = 3000
	// The rate with which the inertial movement slows down, in pixels/second².
	inertiaDeceleration: number; // px/s^2

	// @option inertiaMaxSpeed: Number = Infinity
	// Max speed of the inertial movement, in pixels/second.
	inertiaMaxSpeed: number; // px/s

	// @option easeLinearity: Number = 0.2
	easeLinearity: number;

	// TODO refactor, move to CRS
	// @option worldCopyJump: Boolean = false
	// With this option enabled, the map tracks when you pan to another "copy"
	// of the world and seamlessly jumps to the original one so that all overlays
	// like markers and vector layers are still visible.
	worldCopyJump: boolean;

	// @option maxBoundsViscosity: Number = 0.0
	// If `maxBounds` is set, this option will control how solid the bounds
	// are when dragging the map around. The default value of `0.0` allows the
	// user to drag outside the bounds at normal speed, higher values will
	// slow down map dragging outside bounds, and `1.0` makes the bounds fully
	// solid, preventing the user from dragging outside the bounds.
	maxBoundsViscosity: number;
}

/**
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */
export class Drag extends Handler {

	_draggable: Draggable | undefined;
	_viscosity: number | undefined;
	_positions = [];
	_times = [];
	_offsetLimit: Bounds | undefined;
	options: DragOptions;

	constructor(
		map: Map,
		options?: Partial<DragOptions>,
	) {
		super(map);

		this.options = {
			dragging: true,
			inertia: true,
			inertiaDeceleration: 3400,
			inertiaMaxSpeed: Infinity,
			easeLinearity: 0.2,
			worldCopyJump: false,
			maxBoundsViscosity: 0.0,
			...options,
		};
	}

	addHooks(): void {
		if (!this._draggable) {
			const map = this._map;

			this._draggable = new Draggable(map._mapPane, map._container);
			this._draggable.on({
				dragstart: this._onDragStart,
				drag: this._onDrag,
				dragend: this._onDragEnd,
				predrag: this._onPreDragLimit,
			}, this);

			if (this.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDragWrap, this);

				map.on('zoomend', this._onZoomEnd, this);
				map.whenReady(this._onZoomEnd, this);
			}
		}
		this._map._container.classList.add('leaflet-grab', 'leaflet-touch-drag');
		this._draggable.enable();
		this._positions = [];
		this._times = [];
	}

	removeHooks(): void {
		this._map._container.classList.remove('leaflet-grab', 'leaflet-touch-drag');
		this._draggable!.disable(); // TODO: null safety?
	}

	moved(): boolean {
		return !!this._draggable?._moved;
	}

	moving(): boolean {
		return !!this._draggable?._moving;
	}

	_onDragStart(): void {
		const map = this._map;

		map._stop();

		if (this._map.options.maxBounds && this.options.maxBoundsViscosity) {
			const bounds = this._map.options.maxBounds;

			this._offsetLimit = new Bounds(
				this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
				this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1).add(this._map.getSize()),
			);
			this._viscosity = Math.min(1.0, Math.max(0.0, this.options.maxBoundsViscosity));
		} else {
			this._offsetLimit = undefined;
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (this.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	}

	_onDrag(e: DragEvent): void {
		if (this.options.inertia) {
			const
				time = this._lastTime = Date.now(),
			    pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			this._prunePositions(time);
		}

		this._map
		    .fire('move', e)
		    .fire('drag', e);
	}

	_prunePositions(time: number): void {
		while (this._positions.length > 1 && time - this._times[0] > 50) {
			this._positions.shift();
			this._times.shift();
		}
	}

	_onZoomEnd(): void {
		const
			pxCenter = this._map.getSize().divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
	}

	_viscousLimit(value: number, threshold: number): number {
		return value - (value - threshold) * this._viscosity;
	}

	_onPreDragLimit(): void {
		if (!this._viscosity || !this._offsetLimit) { return; }

		const offset = this._draggable._newPos.subtract(this._draggable._startPos);
		const limit = this._offsetLimit;

		if (offset.x < limit.min.x) { offset.x = this._viscousLimit(offset.x, limit.min.x); }
		if (offset.y < limit.min.y) { offset.y = this._viscousLimit(offset.y, limit.min.y); }
		if (offset.x > limit.max.x) { offset.x = this._viscousLimit(offset.x, limit.max.x); }
		if (offset.y > limit.max.y) { offset.y = this._viscousLimit(offset.y, limit.max.y); }

		this._draggable._newPos = this._draggable._startPos.add(offset);
	}

	_onPreDragWrap(): void {
		// TODO refactor to be able to adjust map pane position after zoom
		const
			worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._absPos = this._draggable._newPos.clone();
		this._draggable._newPos.x = newX;
	}

	_onDragEnd(e: any /* TODO: type; the event comes from Draggable class */) {
		const
			map = this._map,
		    options = this.options,
		    noInertia = !options.inertia || e.noInertia || this._times.length < 2;

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');
		} else {
			this._prunePositions(Date.now());

			const
				direction = this._lastPos.subtract(this._positions[0]),
				duration = (this._lastTime - this._times[0]) / 1000,
				ease = options.easeLinearity,
				speedVector = direction.multiplyBy(ease / duration),
				speed = speedVector.distanceTo([0, 0]),
				limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
				limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),
				decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease);

			let offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x && !offset.y) {
				map.fire('moveend');
			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				requestAnimationFrame(() => {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true,
						animate: true
					});
				});
			}
		}
	}

}
