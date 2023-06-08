
import type { Layer, Map } from '../Leaflet.js';
import * as DomEvent from '../dom/DomEvent.js';
import * as DomUtil from '../dom/DomUtil.js';
import { Control, type ControlPosition } from './Control.js';

const ukrainianFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg>';
const defaultPrefix = `<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">${ukrainianFlag} Leaflet</a>`;

/**
 * The attribution control allows you to display attribution data in a small text box on a map.
 * It is put on the map by default unless you set its
 * [`attributionControl` option](#map-attributioncontrol) to `false`, and it fetches attribution
 * texts from layers with the [`getAttribution` method](#layer-getattribution) automatically.
 * Extends Control.
 * 
 * @deprecated TODO: all of this machinery is completely unnecessary. Application code should be
 * responsible for putting together the attribution string and passing it directly, since they
 * already need to pass it to Layers so that would not be any more difficult.
 */
export class Attribution extends Control {

	_attributions: { [attrib: string]: number } = {};

	constructor(
		position: ControlPosition = 'bottomright',
		public prefix = defaultPrefix,
	) {
		super(position);
	}

	onAdd(map: Map): HTMLElement {
		this._container = DomUtil.create('div', 'leaflet-control-attribution');
		DomEvent.disableClickPropagation(this._container);

		// TODO ugly, refactor
		for (const layer of Object.values(map._layers)) {
			this.addAttribution(layer.getAttribution());
		}

		this._update();

		map.on('layeradd', this._addAttribution, this);

		return this._container;
	}

	onRemove(map: Map): void {
		map.off('layeradd', this._addAttribution, this);
	}

	_addAttribution(ev: { layer: Layer }): void {
		this.addAttribution(ev.layer.getAttribution());
		ev.layer.on('remove', function () {
			this.removeAttribution(ev.layer.getAttribution());
		}, this, true);
	}

	// The HTML text shown before the attributions. Pass `false` to disable.
	setPrefix(prefix: string): this {
		this.prefix = prefix;
		this._update();
		return this;
	}

	// Adds an attribution text (e.g. `'&copy; OpenStreetMap contributors'`).
	addAttribution(text: string | undefined): this {
		if (!text) { return this; }

		this._attributions[text] = (this._attributions[text] || 0) + 1;
		this._update();

		return this;
	}

	// Removes an attribution text.
	removeAttribution(text: string | undefined): this {
		if (!text) { return this; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	}

	_update(): void {
		if (!this._map) { return; }

		const attribs: string[] = [];

		for (const i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		const prefixAndAttribs: string[] = [];

		if (this.prefix) {
			prefixAndAttribs.push(this.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		// TODO: null safety
		this._container!.innerHTML = prefixAndAttribs.join(' <span aria-hidden="true">|</span> ');
	}

}
