import type { Point } from "../../geom";

/**
 * Returns a instance of [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement),
 * corresponding to the class name passed. For example, using 'line' will return
 * an instance of [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement).
 */
export function svgCreate(name: string): SVGElement {
	return document.createElementNS('http://www.w3.org/2000/svg', name);
}

/**
 * Generates a SVG path string for multiple rings, with each ring turning
 * into "M..L..L.." instructions
 */
export function pointsToPath(rings: readonly Point[][], closed?: boolean): string {
	let str = '',
	i, j, len, len2, points, p;

	for (i = 0, len = rings.length; i < len; i++) {
		points = rings[i];

		for (j = 0, len2 = points.length; j < len2; j++) {
			p = points[j];
			str += `${(j ? 'L' : 'M') + p.x} ${p.y}`;
		}

		// closes the ring for polygons
		str += closed ? 'z' : '';
	}

	// SVG complains about empty path strings
	return str || 'M0 0';
}
