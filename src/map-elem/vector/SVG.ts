import { Util } from '../../core';
import { DomUtil } from '../../dom';
import type { Point } from '../../geom';
import type { CircleMarker } from './CircleMarker.js';
import type { Path } from './Path.js';
import type { Polyline } from './Polyline.js';
import { Renderer, type RendererOptions } from './Renderer.js';
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

	declare _container: SVGSVGElement;

	_svgSize: Point | undefined;
	_rootGroup: SVGGElement;
	_paths = new Set<Path>();

	constructor(options?: Partial<RendererOptions>) {
		super(options);

		this._container = create('svg') as any; // TODO: fix types
		this._rootGroup = create('g') as any; // TODO: fix types
		this._container.appendChild(this._rootGroup);

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');
	}

	_destroyContainer(): void {
		Renderer.prototype._destroyContainer.call(this);
		this._svgSize = undefined;
		this._rootGroup = undefined as any;
	}

	_resizeContainer(): Point {
		const size = Renderer.prototype._resizeContainer.call(this);

		// set size of svg-container if changed
		if (!this._svgSize?.equals(size)) {
			this._svgSize = size;
			this._container.setAttribute('width', size.x as any); // gets coerced to string
			this._container.setAttribute('height', size.y as any); // gets coerced to string
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
		this._container.setAttribute('viewBox', `${b.min.x}, ${b.min.y}, ${size.x}, ${size.y}`);
		this.fire('update');
	}

	// methods below are called by vector layers implementations

	_initPath(path: Path): void {
		const el = path._path = create('path');

		if (path.options.className) {
			el.classList.add(...Util.splitWords(path.options.className));
		}

		if (path.options.interactive) {
			el.classList.add('leaflet-interactive');
		}

		this._updateStyle(path);
		this._paths.add(path);
	}

	_addPath(path: Path): void {
		this._rootGroup.appendChild(path._path);
		path.addInteractiveTarget(path._path);
	}

	_removePath(path: Path): void {
		path._path.remove();
		path.removeInteractiveTarget(path._path);
		this._paths.delete(path);
	}

	_updatePath(path: Path): void {
		path._project();
		path._update();
	}

	_updateStyle(path: Path): void {
		const
			el = path._path as SVGPathElement,
		    options = path.options;

		if (!el) { return; }

		if (options.stroke) {
			el.setAttribute('stroke', options.color);
			el.setAttribute('stroke-opacity', options.opacity as any);
			el.setAttribute('stroke-width', options.weight as any);
			el.setAttribute('stroke-linecap', options.lineCap);
			el.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				el.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				el.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				el.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				el.removeAttribute('stroke-dashoffset');
			}
		} else {
			el.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			el.setAttribute('fill', options.fillColor || options.color);
			el.setAttribute('fill-opacity', options.fillOpacity as any);
			el.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			el.setAttribute('fill', 'none');
		}
	}

	_updatePoly(poly: Polyline, closed?: boolean): void {
		this._setPath(poly, pointsToPath(poly._parts, closed));
	}

	_updateCircle(circle: CircleMarker): void {
		const
			p = circle._point!, // TODO: null safety
		    r = Math.max(Math.round(circle._radius), 1),
		    r2 = Math.max(Math.round(circle._radiusY), 1) || r,
		    arc = `a${r},${r2} 0 1,0 `;

		// drawing a circle with two half-arcs
		const d = circle._empty()
			? 'M0 0'
			: `M${p.x - r},${p.y}${arc}${r * 2},0 ${arc}${-r * 2},0 `;

		this._setPath(circle, d);
	}

	_setPath(path: Path, d: string): void {
		path._path.setAttribute('d', d);
	}

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront(path: Path): void {
		DomUtil.toFront(path._path);
	}

	_bringToBack(path: Path): void {
		DomUtil.toBack(path._path);
	}

	_projectPaths(): void {
		for (const path of this._paths) {
			path._project();
		}
	}

	_updatePaths(): void {
		for (const path of this._paths) {
			path._update();
		}
	}

	_resetPaths(): void {
		for (const path of this._paths) {
			path._reset();
		}
	}

}
