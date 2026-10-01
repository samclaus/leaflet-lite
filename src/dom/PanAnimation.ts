import type { Point } from '../geom';
import * as DomUtil from './DomUtil.js';

/**
 * Animates an element's position with `requestAnimationFrame`, keeping the
 * position cached by `DomUtil` synchronized with its CSS transform.
 */
export class PanAnimation {

	_inProgress = false;
	_el: HTMLElement | undefined;
	_duration = 0.25;
	_easeOutPower = 2;
	_startPos: Point | undefined;
	_offset: Point | undefined;
	_startTime = 0;
	_animFrame = 0;

	constructor(
		/**
		 * Called repeatedly as the animation progresses.
		 */
		public _onStep: () => void,
		/**
		 * Called when the animation finishes OR is canceled via `stop()`.
		 */
		public _onEnd: () => void,
	) {}

	// Run an animation of a given element to a new position, optionally setting
	// duration in seconds (`0.25` by default) and easing linearity factor (3rd
	// argument of the [cubic bezier curve](https://cubic-bezier.com/#0,0,.5,1),
	// `0.5` by default).
	run(el: HTMLElement, newPos: Point, durationSec = 0.25, easeLinearity?: number): void {
		this.stop();
		this._el = el;
		this._inProgress = true;
		this._duration = durationSec;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);
		this._startPos = DomUtil.getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = Date.now();
		this._animate();
	}

	// Stops the animation (if currently running).
	stop(): void {
		if (this._inProgress) {
			this._step(true);

			if (this._inProgress) {
				this._complete();
			}
		}
	}

	_animate(): void {
		this._animFrame = requestAnimationFrame(() => this._animate());
		this._step();
	}

	_step(round?: boolean): void {
		const
			elapsed = Date.now() - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration), round);
		} else {
			this._runFrame(1);
			this._complete();
		}
	}

	_runFrame(progress: number, round?: boolean): void {
		// TODO: better null safety without extra checks?
		const pos = this._startPos!.add(this._offset!.multiplyBy(progress));

		if (round) {
			pos._round();
		}

		DomUtil.setPosition(this._el!, pos);

		this._onStep();
	}

	_complete(): void {
		cancelAnimationFrame(this._animFrame);

		this._inProgress = false;
		this._onEnd();
	}

	_easeOut(t: number): number {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}

}
