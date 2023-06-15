
import { Map } from '../map';

export type ControlPosition = 'topleft' | 'topright' | 'bottomleft' | 'bottomright';

/**
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */
export abstract class Control {

	_map: Map | undefined;
	_container: HTMLElement | undefined;

	constructor(
		public position: ControlPosition = 'topright',
	) {}

	/**
	 * Should return the container DOM element for the control and add listeners on relevant
	 * map events. Called on [`control.addTo(map)`](#control-addTo).
	 */
	abstract onAdd(map: Map): HTMLElement;

	/**
	 * Optional method. Should contain all clean up code that removes the listeners previously
	 * added in [`onAdd`](#control-onadd). Called on [`control.remove()`](#control-remove).
	 */
	onRemove?(map: Map): void;

	/**
	 * Returns the position of the control.
	 */
	getPosition(): ControlPosition {
		return this.position;
	}

	// Sets the position of the control.
	setPosition(position: ControlPosition): this {
		const map = this._map;

		this.remove();
		this.position = position;

		if (map) {
			this.addTo(map);
		}

		return this;
	}

	// Adds the control to the given map.
	addTo(map: Map): this {
		this.remove();
		this._map = map;

		const
			container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		container.classList.add('leaflet-control');

		if (pos.includes('bottom')) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		this._map.on('unload', this.remove, this);

		return this;
	}

	// Removes the control from the map it is currently active on.
	remove(): this {
		if (!this._map) {
			return this;
		}

		// TODO: null safety?
		this._container!.remove();

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map.off('unload', this.remove, this);
		this._map = undefined;

		return this;
	}

	_refocusOnMap(e: MouseEvent): void {
		// NOTE: make sure it is not a 'pseudo' click event triggered by pressing
		// spacebar or enter while on a button/input
		if (this._map && e && e.screenX > 0 && e.screenY > 0) {
			this._map._container.focus();
		}
	}

}
