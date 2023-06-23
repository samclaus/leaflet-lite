
import type { HandlerFn } from '../core';
import { DomEvent, DomUtil } from '../dom';
import type { Map } from '../map';
import { Control } from './Control.js';

/**
 * A basic zoom control with two buttons (zoom in and zoom out). Extends `Control`.
 */
export class Zoom extends Control {

	options = {
		// @option position: String = 'topleft'
		// The position of the control (one of the map corners). Possible values are `'topleft'`,
		// `'topright'`, `'bottomleft'` or `'bottomright'`
		position: 'topleft',

		// @option zoomInText: String = '<span aria-hidden="true">+</span>'
		// The text set on the 'zoom in' button.
		zoomInText: '<span aria-hidden="true">+</span>',

		// @option zoomInTitle: String = 'Zoom in'
		// The title set on the 'zoom in' button.
		zoomInTitle: 'Zoom in',

		// @option zoomOutText: String = '<span aria-hidden="true">&#x2212;</span>'
		// The text set on the 'zoom out' button.
		zoomOutText: '<span aria-hidden="true">&#x2212;</span>',

		// @option zoomOutTitle: String = 'Zoom out'
		// The title set on the 'zoom out' button.
		zoomOutTitle: 'Zoom out'
	};

	_disabled = false;
	_zoomInButton: HTMLElement | undefined;
	_zoomOutButton: HTMLElement | undefined;

	onAdd(map: Map): HTMLElement {
		const
			zoomName = 'leaflet-control-zoom',
		    container = DomUtil.create('div', `${zoomName} leaflet-bar`),
		    options = this.options;

		this._zoomInButton  = this._createButton(options.zoomInText, options.zoomInTitle,
		        `${zoomName}-in`,  container, this._zoomIn);
		this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
		        `${zoomName}-out`, container, this._zoomOut);

		this._updateDisabled();
		map.on('zoomend zoomlimitschanged', this._updateDisabled, this);

		return container;
	}

	onRemove(map: Map): void {
		map.off('zoomend zoomlimitschanged', this._updateDisabled, this);
	}

	disable(): this {
		this._disabled = true;
		this._updateDisabled();
		return this;
	}

	enable(): this {
		this._disabled = false;
		this._updateDisabled();
		return this;
	}

	_zoomIn(e: KeyboardEvent): void {
		const map = this._map!; // TODO: null safety

		if (!this._disabled && map._zoom < map.options.maxZoom) {
			map.setZoom(map._zoom + (map.options.zoomDelta * (e.shiftKey ? 3 : 1)));
		}
	}

	_zoomOut(e: KeyboardEvent): void {
		const map = this._map!; // TODO: null safety

		if (!this._disabled && map._zoom > map.options.minZoom) {
			map.setZoom(map._zoom - (map.options.zoomDelta * (e.shiftKey ? 3 : 1)));
		}
	}

	_createButton(
		html: string,
		title: string,
		className: string,
		container: HTMLElement,
		onClick: HandlerFn,
	): HTMLAnchorElement {
		const link = DomUtil.create('a', className, container) as HTMLAnchorElement;

		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		/*
		 * Will force screen readers like VoiceOver to read this as "Zoom in - button"
		 */
		link.setAttribute('role', 'button');
		link.setAttribute('aria-label', title);

		DomEvent.disableClickPropagation(link);
		DomEvent.on(link, 'click', DomEvent.stop);
		DomEvent.on(link, 'click', onClick, this);
		DomEvent.on(link, 'click', this._refocusOnMap, this);

		return link;
	}

	_updateDisabled() {
		const
			map = this._map!, // TODO: null safety
			zoomInBtn = this._zoomInButton!, // TODO: null safety
			zoomOutBtn = this._zoomOutButton!, // TODO: null safety
		    className = 'leaflet-disabled';

		zoomInBtn.classList.remove(className);
		zoomOutBtn.classList.remove(className);
		zoomInBtn.setAttribute('aria-disabled', 'false');
		zoomOutBtn.setAttribute('aria-disabled', 'false');

		if (this._disabled || map._zoom === map.options.minZoom) {
			zoomOutBtn.classList.add(className);
			zoomOutBtn.setAttribute('aria-disabled', 'true');
		}
		if (this._disabled || map._zoom === map.options.maxZoom) {
			zoomInBtn.classList.add(className);
			zoomInBtn.setAttribute('aria-disabled', 'true');
		}
	}

}
