
/**
 * TODO: surely TypeScript has a built-in interface that covers all regular HTML
 * elements as well as outer `<svg>` elements, complete with attributes and CSS
 * functionality. I do not know of a correct interface though, so for now I will
 * use this union.
 */
export type DomElement = HTMLElement | SVGSVGElement;