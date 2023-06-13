
import { DomUtil } from '../dom';
import { Point } from '../geom';
import type { Map } from '../map';
import { Control } from './Control.js';

/**
 * A simple scale control that shows the scale of the current center of screen in metric (m/km) and imperial (mi/ft) systems. Extends `Control`.
 *
 * ```js
 * L.control.scale().addTo(map);
 * ```
 */
export class Scale extends Control {

	options = {
		// @option position: String = 'bottomleft'
		// The position of the control (one of the map corners). Possible values are `'topleft'`,
		// `'topright'`, `'bottomleft'` or `'bottomright'`
		position: 'bottomleft',

		// @option maxWidth: Number = 100
		// Maximum width of the control in pixels. The width is set dynamically to show round values (e.g. 100, 200, 500).
		maxWidth: 100,

		// @option metric: Boolean = True
		// Whether to show the metric scale line (m/km).
		metric: true,

		// @option imperial: Boolean = True
		// Whether to show the imperial scale line (mi/ft).
		imperial: true,

		// @option updateWhenIdle: Boolean = false
		// If `true`, the control is updated on [`moveend`](#map-moveend), otherwise it's always up-to-date (updated on [`move`](#map-move)).
		updateWhenIdle: false,
	};

	_mScale: HTMLElement | undefined;
	_iScale: HTMLElement | undefined;

	onAdd(map: Map): HTMLElement {
		const
			className = 'leaflet-control-scale',
		    container = DomUtil.create('div', className);

		this._addScales(`${className}-line`, container);

		map.on(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	}

	onRemove(map: Map): void {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	}

	_addScales(className: string, container: HTMLElement): void {
		if (this.options.metric) {
			this._mScale = DomUtil.create('div', className, container);
		}
		if (this.options.imperial) {
			this._iScale = DomUtil.create('div', className, container);
		}
	}

	_update(): void {
		const
			map = this._map!, // TODO: null safety
		    y = map.getSize().y / 2,
			maxMeters = map.distance(
				map.containerPointToLatLng(new Point(0, y)),
				map.containerPointToLatLng(new Point(this.options.maxWidth, y)),
			);

		this._updateScales(maxMeters);
	}

	_updateScales(maxMeters: number): void {
		if (this.options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}
		if (this.options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	}

	_updateMetric(maxMeters: number): void {
		const
			meters = this._getRoundNum(maxMeters),
		    label = meters < 1000 ? `${meters} m` : `${meters / 1000} km`;

		// TODO: null safety
		this._updateScale(this._mScale!, label, meters / maxMeters);
	}

	_updateImperial(maxMeters: number): void {
		const
			maxFeet = maxMeters * 3.2808399,
			iScale = this._iScale!; // TODO: null safety

		let maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);

			this._updateScale(iScale, `${miles} mi`, miles / maxMiles);
		} else {
			feet = this._getRoundNum(maxFeet);

			this._updateScale(iScale, `${feet} ft`, feet / maxFeet);
		}
	}

	_updateScale(scale: HTMLElement, text: string, ratio: number): void {
		scale.style.width = `${Math.round(this.options.maxWidth * ratio)}px`;
		scale.innerHTML = text;
	}

	_getRoundNum(num: number): number {
		const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
		let d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;

		return pow10 * d;
	}

}
