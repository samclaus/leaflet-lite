import { Point } from '../geom';
import type { DomElement } from './DomElement.js';
import * as DomEvent from './DomEvent.js';

// TODO: this is just a temporary fix to break a circular dependency
export { getScale } from './get-scale.js';

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

/**
 * Remove all child nodes from an element. This includes text nodes, HTML comments,
 * SVG elements, regular DOM elements, EVERYTHING!
 */
export function removeAllChildren(node: Node): void {
	// Taken from https://stackoverflow.com/a/3955238
	// Basically checking 'firstChild' is almost certainly the fastest way
	// to see if it still has children, and remove the LAST child is
	// generally faster than removing first child, depending on the data
	// structures each DOM implementation uses (i.e. not forcing the browser
	// to shift every element of an array)
	while (node.firstChild) {
		node.removeChild(node.lastChild!);
	}
}

/**
 * Makes `el` the last child of its parent, so it renders in front of the other children.
 */
export function toFront(el: HTMLElement): void {
	const parent = el.parentNode;

	if (parent && parent.lastChild !== el) {
		parent.appendChild(el);
	}
}

/**
 * Makes `el` the first child of its parent, so it renders behind the other children.
 */
export function toBack(el: HTMLElement): void {
	const parent = el.parentNode;

	if (parent && parent.firstChild !== el) {
		parent.insertBefore(el, parent.firstChild);
	}
}

/**
 * Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
 * and optionally scaled by `scale`. Does not have an effect if the
 * browser doesn't support 3D CSS transforms.
 */
export function setTransform(el: ElementCSSInlineStyle, offset?: Point, scale?: number): void {
	const {x, y} = offset || new Point(0, 0);

	el.style.transform = `translate3d(${x}px,${y}px,0)${typeof scale === "number" ? ` scale(${scale})` : ''}`;
}

const positions = new WeakMap<ElementCSSInlineStyle, Point>();

/**
 * Sets the position of `el` to coordinates specified by `position`,
 * using CSS translate or top/left positioning depending on the browser
 * (used by Leaflet internally to position its layers).
 */
export function setPosition(el: ElementCSSInlineStyle, point: Point): void {
	positions.set(el, point);
	setTransform(el, point);
}

/**
 * Returns the coordinates of an element previously positioned with setPosition.
 */
export function getPosition(el: ElementCSSInlineStyle): Point {
	// this method is only used for elements previously positioned using setPosition,
	// so it's safe to cache the position for performance
	return positions.get(el) ?? new Point(0, 0);
}

const documentStyle = document.documentElement.style as any;
// Safari still needs a vendor prefix, we need to detect with property name is supported.
const userSelectProp = ['userSelect', 'WebkitUserSelect'].find(prop => prop in documentStyle) || 'userSelect';

let prevUserSelect: any;

/**
 * Prevents the user from selecting text in the document. Used internally
 * by Leaflet to override the behaviour of any click-and-drag interaction on
 * the map. Affects drag interactions on the whole document.
 */
export function disableTextSelection(): void {
	const value = documentStyle[userSelectProp];

	if (value === 'none') {
		return;
	}

	prevUserSelect = value;
	documentStyle[userSelectProp] = 'none';
}

/**
 * Cancels the effects of a previous `disableTextSelection()` call.
 */
export function enableTextSelection(): void {
	if (typeof prevUserSelect === 'undefined') {
		return;
	}

	documentStyle[userSelectProp] = prevUserSelect;
	prevUserSelect = undefined;
}

/**
 * Prevents the user from generating `dragstart` DOM events, usually generated
 * when the user drags an image.
 */
export function disableImageDrag(): void {
	DomEvent.on(window, 'dragstart', DomEvent.preventDefault);
}

/**
 * Cancels the effects of a previous `disableImageDrag()` call.
 */
export function enableImageDrag(): void {
	DomEvent.off(window, 'dragstart', DomEvent.preventDefault);
}

let
	_outlineElement: DomElement | undefined,
	_outlineStyle: string | undefined;

/**
 * Makes the [outline](https://developer.mozilla.org/docs/Web/CSS/outline)
 * of the element `el` invisible. Used internally by Leaflet to prevent
 * focusable elements from displaying an outline when the user performs a
 * drag interaction on them.
 * 
 * NOTE: calling this function will restore the outline style of the previous
 * element it was called for, if there is one. The function may only affect
 * one element at a time.
 */
export function preventOutline(element: DomElement): void {
	while (element.tabIndex === -1 && element.parentNode) {
		element = element.parentNode as HTMLElement;
	}
	if (!element.style) { return; }
	restoreOutline();
	_outlineElement = element;
	_outlineStyle = element.style.outlineStyle;
	element.style.outlineStyle = 'none';
	DomEvent.on(window, 'keydown', restoreOutline);
}

/**
 * Cancels the effects of a previous `preventOutline()` call.
 */
export function restoreOutline(): void {
	if (_outlineElement) {
		_outlineElement.style.outlineStyle = _outlineStyle!;
		_outlineElement = undefined;
		_outlineStyle = undefined;

		DomEvent.off(window, 'keydown', restoreOutline);
	}
}

/**
 * Finds the closest parent node for which size (width and height) is not null or 0.
 */
export function getSizedParentNode<T extends DomElement>(element: T): T | undefined {
	do {
		// IMPORTANT: parentNode might be 'null' but I don't want to create a
		// separate variable from the parameter just to make TypeScript happy
		element = element.parentNode as any;
	} while (
		element &&
		(!(element as any).offsetWidth || !(element as any).offsetHeight) &&
		element !== document.body
	);
	return element || undefined; // coerce 'null' to 'undefined'
}
