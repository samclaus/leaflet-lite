import type { DomElement } from '.';
import { Browser, Evented } from '../core';
import { Point } from '../geom';
import * as DomEvent from './DomEvent.js';
import * as DomUtil from './DomUtil.js';

const START = Browser.touch ? 'touchstart mousedown' : 'mousedown';

/**
 * A class for making DOM elements draggable (including touch support).
 * Used internally for map and marker dragging. Only works for elements
 * that were positioned with [`L.DomUtil.setPosition`](#domutil-setposition).
 *
 * ```js
 * var draggable = new L.Draggable(elementToDrag);
 * draggable.enable();
 * ```
 */
export class Draggable extends Evented {

	static _dragging: Draggable | undefined;

	_enabled = false;
	_moved = false;
	_moving = false;
	_lastTarget: HTMLElement | undefined;
	_startPoint: Point | undefined;
	_startPos: Point | undefined;

	// TODO
	_parentScale: any;
	_lastEvent: any;
	_newPos: Point | undefined;

	// @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
	// Creates a `Draggable` object for moving `el` when you start dragging the `dragHandle` element (equals `el` itself by default).
	constructor(
		public _element: DomElement,
		public _dragStartTarget = _element,
		public _preventOutline = false,
		// The max number of pixels a user can shift the mouse pointer during a click
		// for it to be considered a valid click (as opposed to a mouse drag).
		public _clickTolerance = 3,
	) {
		super();
	}

	// Enables the dragging ability
	enable(): void {
		if (this._enabled) { return; }

		DomEvent.on(this._dragStartTarget, START, this._onDown, this);

		this._enabled = true;
	}

	// Disables the dragging ability
	disable(): void {
		if (!this._enabled) { return; }

		// If we're currently dragging this draggable,
		// disabling it counts as first ending the drag.
		if (Draggable._dragging === this) {
			this.finishDrag(true);
		}

		DomEvent.off(this._dragStartTarget, START, this._onDown, this);

		this._enabled = false;
		this._moved = false;
	}

	// TODO: it is either MouseEvent OR TouchEvent, not both, but suppress TS errors for now
	_onDown(e: MouseEvent & TouchEvent): void {
		// Ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (!this._enabled) { return; }

		this._moved = false;

		if (this._element.classList.contains('leaflet-zoom-anim')) { return; }

		if (e.touches && e.touches.length !== 1) {
			// Finish dragging to avoid conflict with touchZoom
			if (Draggable._dragging === this) {
				this.finishDrag();
			}
			return;
		}

		if (Draggable._dragging || e.shiftKey || ((e.button !== 0) && !e.touches)) { return; }
		Draggable._dragging = this;  // Prevent dragging multiple objects at once.

		if (this._preventOutline) {
			DomUtil.preventOutline(this._element);
		}

		DomUtil.disableImageDrag();
		DomUtil.disableTextSelection();

		if (this._moving) { return; }

		// @event down: Event
		// Fired when a drag is about to start.
		this.fire('down');

		const
			first = e.touches ? e.touches[0] : e,
		    sizedParent = DomUtil.getSizedParentNode(this._element);

		if (!sizedParent) {
			// TODO: better solution?
			throw new Error("Draggable: could not find sized parent for element!");
		}

		this._startPoint = new Point(first.clientX, first.clientY);
		this._startPos = DomUtil.getPosition(this._element);

		// Cache the scale, so that we can continuously compensate for it during drag (_onMove).
		this._parentScale = DomUtil.getScale(sizedParent);

		const mouseevent = e.type === 'mousedown';

		DomEvent.on(document, mouseevent ? 'mousemove' : 'touchmove', this._onMove, this);
		DomEvent.on(document, mouseevent ? 'mouseup' : 'touchend touchcancel', this._onUp, this);
	}

	_onMove(e: MouseEvent | TouchEvent) {
		// Ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (!this._enabled) { return; }

		let first: MouseEvent | Touch;

		if (e instanceof MouseEvent) {
			first = e;
		} else if (e.touches.length > 1) {
			this._moved = true;
			return;
		} else {
			first = e.touches[0];
		}

		// TODO: null safety
		const offset = new Point(first.clientX, first.clientY)._subtract(this._startPoint!);

		if (
			(!offset.x && !offset.y) ||
			(Math.abs(offset.x) + Math.abs(offset.y) < this._clickTolerance)
		) {
			return;
		}

		// We assume that the parent container's position, border and scale do not change for the duration of the drag.
		// Therefore there is no need to account for the position and border (they are eliminated by the subtraction)
		// and we can use the cached value for the scale.
		offset.x /= this._parentScale.x;
		offset.y /= this._parentScale.y;

		DomEvent.preventDefault(e);

		if (!this._moved) {
			// @event dragstart: Event
			// Fired when a drag starts
			this.fire('dragstart');

			this._moved = true;

			document.body.classList.add('leaflet-dragging');

			this._lastTarget = (e.target || e.srcElement || undefined) as HTMLElement | undefined;

			// IE and Edge do not give the <use> element, so fetch it
			// if necessary
			if (window.SVGElementInstance && this._lastTarget instanceof window.SVGElementInstance) {
				this._lastTarget = (this._lastTarget as any)?.correspondingUseElement;
			}

			this._lastTarget?.classList.add('leaflet-drag-target');
		}

		// TODO: null safety
		this._newPos = this._startPos!.add(offset);
		this._moving = true;
		this._lastEvent = e;
		this._updatePosition();
	}

	_updatePosition(): void {
		const e = {originalEvent: this._lastEvent};

		// @event predrag: Event
		// Fired continuously during dragging *before* each corresponding
		// update of the element's position.
		this.fire('predrag', e);
		DomUtil.setPosition(this._element, this._newPos!); // TODO: null safety

		// @event drag: Event
		// Fired continuously during dragging.
		this.fire('drag', e);
	}

	_onUp(): void {
		// Ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (!this._enabled) { return; }
		this.finishDrag();
	}

	finishDrag(noInertia?: boolean): void {
		document.body.classList.remove('leaflet-dragging');

		if (this._lastTarget) {
			this._lastTarget.classList.remove('leaflet-drag-target');
			this._lastTarget = undefined;
		}

		DomEvent.off(document, 'mousemove touchmove', this._onMove, this);
		DomEvent.off(document, 'mouseup touchend touchcancel', this._onUp, this);

		DomUtil.enableImageDrag();
		DomUtil.enableTextSelection();

		const fireDragend = this._moved && this._moving;

		this._moving = false;
		Draggable._dragging = undefined;

		if (fireDragend) {
			// @event dragend: DragEndEvent
			// Fired when the drag ends.
			this.fire('dragend', {
				noInertia,
				distance: this._newPos!.distanceTo(this._startPos!), // TODO: null safety
			});
		}
	}

}
