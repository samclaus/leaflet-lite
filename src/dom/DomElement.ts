
/**
 * TODO: surely TypeScript has a built-in interface that covers all regular HTML
 * elements as well as outer `<svg>` elements, complete with attributes and CSS
 * functionality. I do not know of a correct interface though, so for now I will
 * use this union.
 */
export type DomElement = HTMLElement | SVGSVGElement;

export interface ElementScale {
    x: number;
    y: number;
    boundingClientRect: DOMRect;
}

/**
 * Computes the CSS scale currently applied on the element.
 * Returns an object with `x` and `y` members as horizontal and vertical scales respectively,
 * and `boundingClientRect` as the result of [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
 */
export function getScale(element: DomElement): ElementScale {
	const rect = element.getBoundingClientRect(); // Read-only in old browsers.

	return {
		// TODO: fix types? I am really not sure of the correct types to cover all regular
		// HTML elements AND outer <svg> elements
		x: rect.width / (element as any).offsetWidth || 1,
		y: rect.height / (element as any).offsetHeight || 1,
		boundingClientRect: rect
	};
}
