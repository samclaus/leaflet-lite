import type { Point } from "../../geom";

/**
 * An icon is a dirt simple, data-only class for grouping a DOM element with
 * information about its size and anchor point. The anchor point determines
 * what coordinate within the element is lined up with the icon's location
 * on the map.
 * 
 * Generally, an icon must not be used by multiple markers at the same time,
 * or they will both be manipulating the same DOM element.
 */
export class Icon {

    constructor(
        public el: HTMLElement,
        public size: Point,
        public anchor: Point,
    ) {}

}
