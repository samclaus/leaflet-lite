import { BlanketOverlay, type BlanketOverlayOptions } from '..';
import { Util } from '../../core';
import type { Map } from '../../map';
import { CircleMarker } from './CircleMarker.js';
import { Path } from './Path.js';
import { Polyline } from './Polyline.js';

export interface RendererOptions extends BlanketOverlayOptions {
	/**
	 * How much to extend the click tolerance around a path/object on the map.
	 * Only used by Canvas renderer.
	 */
	tolerance: number | undefined;
}

/**
 * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the
 * DOM container of the renderer, its bounds, and its zoom animation.
 *
 * A `Renderer` works as an implicit layer group for all `Path`s - the renderer
 * itself can be added or removed to the map. All paths use a renderer, which can
 * be implicit (the map will decide the type of renderer and use it automatically)
 * or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * Do not use this class directly, use `SVG` and `Canvas` instead.
 *
 * The `continuous` option inherited from `BlanketOverlay` cannot be set to `true`
 * (otherwise, renderers get out of place during a pinch-zoom operation).
 *
 * @event update: Event
 * Fired when the renderer updates its bounds, center and zoom, for example when
 * its map has moved
 */
export abstract class Renderer extends BlanketOverlay {

	declare options: RendererOptions;

	constructor(options?: Partial<RendererOptions>) {
		super();

		Util.setOptions(this, options, {
			continuous: false,
		});
		Util.stamp(this);
	}

	abstract _initPath(path: Path): void;
	abstract _addPath(path: Path): void;
	abstract _updatePath(path: Path): void;
	abstract _updateStyle(path: Path): void;
	abstract _bringToFront(path: Path): void;
	abstract _bringToBack(path: Path): void;
	abstract _removePath(path: Path): void;
	abstract _updateCircle(layer: CircleMarker): void;
	abstract _updatePoly(layer: Polyline, closed?: boolean): void;
	abstract _projectPaths(): void;
	abstract _updatePaths(): void;
	abstract _resetPaths(): void;

	// Subclasses are responsible of implementing `_update()`. It should fire
	// the 'update' event whenever appropriate (before/after rendering).
	abstract _update(): void;

	onAdd(map: Map): this {
		BlanketOverlay.prototype.onAdd.call(this, map);
		return this.on('update', this._updatePaths, this);
	}

	onRemove(): void {
		BlanketOverlay.prototype.onRemove.call(this);
		this.off('update', this._updatePaths, this);
	}

	/**
	 * Implements the 'zoomend' handler for BlanketOverlay, calling `_projectPaths()`
	 * which must iterate over all paths owned by the renderer and have them each
	 * re-project themselves now that the origin pixel for the map has changed.
	 */
	_onZoomEnd(): void {
		this._projectPaths();
	}

	_onViewReset(): void {
		this._resetPaths();
	}

	_onSettled(): void {
		this._update();
	}

}
