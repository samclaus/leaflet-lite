
// TODO: this file was just extracted out from DomUtil.ts to break the circular dependency
// between DomUtil.ts and DomEvent.ts. There is probably a better way to organize all of
// their functionality.

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
export function getScale(element: HTMLElement): ElementScale {
	const rect = element.getBoundingClientRect(); // Read-only in old browsers.

	return {
		x: rect.width / element.offsetWidth || 1,
		y: rect.height / element.offsetHeight || 1,
		boundingClientRect: rect
	};
}