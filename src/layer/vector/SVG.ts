import { Util } from '../../core';
import { DomUtil } from '../../dom';
import type { Point } from '../../geom';
import type { CircleMarker } from './CircleMarker.js';
import type { Path } from './Path.js';
import type { Polyline } from './Polyline.js';
import { Renderer } from './Renderer.js';
import { svgCreate as create, pointsToPath } from './SVG.Util.js';

/**
 * Allows vector layers to be displayed with [SVG](https://developer.mozilla.org/docs/Web/SVG).
 * Inherits `Renderer`.
 *
 * Use SVG by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.svg()
 * });
 * ```
 *
 * Use a SVG renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.svg({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */
export class SVG extends Renderer {

	_svgSize: Point | undefined;
	_rootGroup: SVGGElement | undefined;

	_initContainer(): void {
		this._container = create('svg') as any; // TODO: fix types

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container!.setAttribute('pointer-events', 'none');

		this._rootGroup = create('g') as any; // TODO: fix types
		this._container!.appendChild(this._rootGroup!);
	}

	_destroyContainer(): void {
		Renderer.prototype._destroyContainer.call(this);
		this._svgSize = undefined;
		this._rootGroup = undefined;
	}

	_resizeContainer(): Point {
		const size = Renderer.prototype._resizeContainer.call(this);

		// set size of svg-container if changed
		if (!this._svgSize || !this._svgSize.equals(size)) {
			this._svgSize = size;

			// TODO: null safety
			this._container!.setAttribute('width', size.x as any); // gets coerced to string
			this._container!.setAttribute('height', size.y as any); // gets coerced to string
		}

		return size;
	}

	_update(): void {
		// TODO: null safety
		if (this._map!._animatingZoom && this._bounds) { return; }

		const
			b = this._bounds!, // TODO: null safety
		    size = b.getSize();

		// movement: update container viewBox so that we don't have to change coordinates of individual layers
		// TODO: null safety
		this._container!.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));
		this.fire('update');
	}

	// methods below are called by vector layers implementations

	_initPath(layer: Path): void {
		const path = layer._path = create('path');

		if (layer.options.className) {
			path.classList.add(...Util.splitWords(layer.options.className));
		}

		if (layer.options.interactive) {
			path.classList.add('leaflet-interactive');
		}

		this._updateStyle(layer);
		this._layers[Util.stamp(layer)] = layer;
	}

	_addPath(layer: Path): void {
		if (!this._rootGroup) { this._initContainer(); }
		this._rootGroup!.appendChild(layer._path); // TODO: null safety
		layer.addInteractiveTarget(layer._path);
	}

	_removePath(layer: Path): void {
		layer._path.remove();
		layer.removeInteractiveTarget(layer._path);
		delete this._layers[Util.stamp(layer)];
	}

	_updatePath(layer: Path): void {
		layer._project();
		layer._update();
	}

	_updateStyle(layer: Path): void {
		const
			path = layer._path,
		    options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', options.opacity);
			path.setAttribute('stroke-width', options.weight);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', options.fillOpacity);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}
	}

	_updatePoly(layer: Polyline, closed?: boolean): void {
		this._setPath(layer, pointsToPath(layer._parts, closed));
	}

	_updateCircle(layer: CircleMarker): void {
		const
			p = layer._point!, // TODO: null safety
		    r = Math.max(Math.round(layer._radius), 1),
		    r2 = Math.max(Math.round(layer._radiusY), 1) || r,
		    arc = `a${r},${r2} 0 1,0 `;

		// drawing a circle with two half-arcs
		const d = layer._empty() ? 'M0 0' :
			`M${p.x - r},${p.y
			}${arc}${r * 2},0 ${
				arc}${-r * 2},0 `;

		this._setPath(layer, d);
	}

	_setPath(layer: Path, path: string): void {
		layer._path.setAttribute('d', path);
	}

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront(layer: Path): void {
		DomUtil.toFront(layer._path);
	}

	_bringToBack(layer: Path): void {
		DomUtil.toBack(layer._path);
	}

}
