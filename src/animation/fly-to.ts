import type { LatLng, LatLngBounds } from "../geog";
import type { FitBoundsOptions, Map } from "../map";

// Sets the view of the map (geographical center and zoom) performing a smooth
// pan-zoom animation.
export function flyTo(map: Map, targetCenter: LatLng, targetZoom?: number, options: any = {} /* TODO: zoom/pan options but minus animate because the whole point of this IS the animation */): void {
    map._stop();

    const
        from = map.project(map.getCenter()),
        to = map.project(targetCenter),
        size = map.getSize(),
        startZoom = map._zoom;

    targetZoom ??= startZoom;

    const
        w0 = Math.max(size.x, size.y),
        w1 = w0 * map.getZoomScale(startZoom, targetZoom),
        u1 = (to.distanceTo(from)) || 1,
        rho = 1.42,
        rho2 = rho * rho;

    function r(i: number): number {
        const s1 = i ? -1 : 1,
            s2 = i ? w1 : w0,
            t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
            b1 = 2 * s2 * rho2 * u1,
            b = t1 / b1,
            sq = Math.sqrt(b * b + 1) - b;

        // workaround for floating point precision bug when sq = 0, log = -Infinite,
        // thus triggering an infinite loop in flyTo
        const log = sq < 0.000000001 ? -18 : Math.log(sq);

        return log;
    }

    function sinh(n: number) { return (Math.exp(n) - Math.exp(-n)) / 2; }
    function cosh(n: number) { return (Math.exp(n) + Math.exp(-n)) / 2; }
    function tanh(n: number) { return sinh(n) / cosh(n); }

    const r0 = r(0);

    function w(s: number) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
    function u(s: number) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 1.5); }

    const
        start = Date.now(),
        S = (r(1) - r0) / rho,
        duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

    function frame(this: Map): void {
        const t = (Date.now() - start) / duration,
            s = easeOut(t) * S;

        if (t <= 1) {
            this._flyToFrame = requestAnimationFrame(frame.bind(this));

            this._move(
                this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
                this.getScaleZoom(w0 / w(s), startZoom),
                {flyTo: true},
            );

        } else {
            this
                ._move(targetCenter, targetZoom)
                ._moveEnd(true);
        }
    }

    map._moveStart(true, options.noMoveStart);
    frame.call(map);
}

// Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
// but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
export function flyToBounds(map: Map, bounds: LatLngBounds, options?: FitBoundsOptions): void {
    const { center, zoom } = map._getBoundsCenterZoom(bounds, options);
    flyTo(map, center, zoom, options);
}