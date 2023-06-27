import { Point } from '../geom';
import * as DomEvent from './DomEvent.js';

export { getScale } from './get-scale.js';

/*
 * @namespace DomUtil
 *
 * Utility functions to work with the [DOM](https://developer.mozilla.org/docs/Web/API/Document_Object_Model)
 * tree, used by Leaflet internally.
 *
 * Most functions expecting or returning a `HTMLElement` also work for
 * SVG elements. The only difference is that classes refer to CSS classes
 * in HTML and SVG classes in SVG.
 */

// Returns an element given its DOM id, or returns the element itself
// if it was passed directly.
export function get(id: string | HTMLElement): HTMLElement | null {
	return typeof id === 'string' ? document.getElementById(id) : id;
}

/**
 * Creates an HTML element with `tagName`, sets its class to `className`,
 * and optionally appends it to `container` element.
 */
export function create(tagName: string, className?: string, container?: HTMLElement): HTMLElement {
	const el = document.createElement(tagName);

	if (className) {
		el.className = className;
	}
	if (container) {
		container.appendChild(el);
	}

	return el;
}

// Makes `el` the last child of its parent, so it renders in front of the other children.
export function toFront(el: HTMLElement): void {
	const parent = el.parentNode;

	if (parent && parent.lastChild !== el) {
		parent.appendChild(el);
	}
}

// Makes `el` the first child of its parent, so it renders behind the other children.
export function toBack(el: HTMLElement): void {
	const parent = el.parentNode;

	if (parent && parent.firstChild !== el) {
		parent.insertBefore(el, parent.firstChild);
	}
}

// Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
// and optionally scaled by `scale`. Does not have an effect if the
// browser doesn't support 3D CSS transforms.
export function setTransform(el: HTMLElement, offset?: Point, scale?: number): void {
	const {x, y} = offset || new Point(0, 0);

	el.style.transform = `translate3d(${x}px,${y}px,0)${typeof scale === "number" ? ` scale(${scale})` : ''}`;
}

const positions = new WeakMap<HTMLElement, Point>();

// Sets the position of `el` to coordinates specified by `position`,
// using CSS translate or top/left positioning depending on the browser
// (used by Leaflet internally to position its layers).
export function setPosition(el: HTMLElement, point: Point): void {
	positions.set(el, point);
	setTransform(el, point);
}

// Returns the coordinates of an element previously positioned with setPosition.
export function getPosition(el: HTMLElement): Point {
	// this method is only used for elements previously positioned using setPosition,
	// so it's safe to cache the position for performance
	return positions.get(el) ?? new Point(0, 0);
}

const documentStyle = document.documentElement.style as any;
// Safari still needs a vendor prefix, we need to detect with property name is supported.
const userSelectProp = ['userSelect', 'WebkitUserSelect'].find(prop => prop in documentStyle) || 'userSelect';

let prevUserSelect: any;

// Prevents the user from selecting text in the document. Used internally
// by Leaflet to override the behaviour of any click-and-drag interaction on
// the map. Affects drag interactions on the whole document.
export function disableTextSelection(): void {
	const value = documentStyle[userSelectProp];

	if (value === 'none') {
		return;
	}

	prevUserSelect = value;
	documentStyle[userSelectProp] = 'none';
}

// Cancels the effects of a previous [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection).
export function enableTextSelection(): void {
	if (typeof prevUserSelect === 'undefined') {
		return;
	}

	documentStyle[userSelectProp] = prevUserSelect;
	prevUserSelect = undefined;
}

// Prevents the user from generating `dragstart` DOM events, usually generated when the user drags an image.
export function disableImageDrag(): void {
	// TODO: refactor/remove DOM event code and make this less janky
	DomEvent.on(window as unknown as HTMLElement, 'dragstart', DomEvent.preventDefault);
}

// Cancels the effects of a previous [`L.DomUtil.disableImageDrag`](#domutil-disableimagedrag).
export function enableImageDrag(): void {
	// TODO: refactor/remove DOM event code and make this less janky
	DomEvent.off(window as unknown as HTMLElement, 'dragstart', DomEvent.preventDefault);
}

let
	_outlineElement: HTMLElement | undefined,
	_outlineStyle: string | undefined;

// Makes the [outline](https://developer.mozilla.org/docs/Web/CSS/outline)
// of the element `el` invisible. Used internally by Leaflet to prevent
// focusable elements from displaying an outline when the user performs a
// drag interaction on them.
export function preventOutline(element: HTMLElement): void {
	while (element.tabIndex === -1 && element.parentNode) {
		element = element.parentNode as HTMLElement;
	}
	if (!element.style) { return; }
	restoreOutline();
	_outlineElement = element;
	_outlineStyle = element.style.outlineStyle;
	element.style.outlineStyle = 'none';
	// TODO: refactor/remove DOM event code and make this less janky
	DomEvent.on(window as unknown as HTMLElement, 'keydown', restoreOutline);
}

// @function restoreOutline()
// Cancels the effects of a previous [`L.DomUtil.preventOutline`](#domutil-preventoutline).
export function restoreOutline(): void {
	if (!_outlineElement) { return; }
	_outlineElement.style.outlineStyle = _outlineStyle!;
	_outlineElement = undefined;
	_outlineStyle = undefined;
	// TODO: refactor/remove DOM event code and make this less janky
	DomEvent.off(window as unknown as HTMLElement, 'keydown', restoreOutline);
}

// Finds the closest parent node which size (width and height) is not null.
export function getSizedParentNode(element: HTMLElement): HTMLElement | undefined {
	do {
		// IMPORTANT: parentNode might be 'null' but I don't want to create a
		// separate variable from the parameter just to make TypeScript happy
		element = element.parentNode as any;
	} while (
		element &&
		(!element.offsetWidth || !element.offsetHeight) &&
		element !== document.body
	);
	return element || undefined; // coerce 'null' to 'undefined'
}
