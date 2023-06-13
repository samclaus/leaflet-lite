
/**
 * Last unique ID used by [`stamp()`](#util-stamp).
 */
export let lastId = 0;

/**
 * Returns the unique ID of an object, assigning it one if it doesn't have it.
 */
export function stamp(obj: any): number {
	if (typeof obj._leaflet_id !== "number") {
		obj._leaflet_id = ++lastId;
	}
	return obj._leaflet_id;
}

/**
 * Returns a function which executes function `fn` with the given scope `context`
 * (so that the `this` keyword refers to `context` inside `fn`'s code). The function
 * `fn` will be called no more than one time per given amount of `time`. The arguments
 * received by the bound function will be any arguments passed when binding the
 * function, followed by any arguments passed when invoking the bound function.
 * Has an `L.throttle` shortcut.
 */
export function throttle<T extends Function>(fn: T, time: number, context?: any): T {
	let
		lock = false,
		queuedArgs: any[] | undefined;

	function later(): void {
		// reset lock and call if queued
		lock = false;

		if (queuedArgs) {
			wrapperFn.apply(context, queuedArgs);
			queuedArgs = undefined;
		}
	}

	function wrapperFn(...args: any[]): void {
		if (lock) {
			// called too soon, queue to call later
			queuedArgs = args;
		} else {
			// call and lock until later
			fn.apply(context, args);
			setTimeout(later, time);
			lock = true;
		}
	}

	return wrapperFn as any;
}

/**
 * Returns the number `num` modulo `range` in such a way so it lies within
 * `range[0]` and `range[1]`. The returned value will be always smaller than
 * `range[1]` unless `includeMax` is set to `true`.
 *
 * TODO: just pass min/max as separate args
 */
export function wrapNum(
	x: number,
	range: readonly [number, number],
	includeMax?: boolean,
): number {
	const
		max = range[1],
	    min = range[0],
	    d = max - min;

	return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
}

/** Function which always returns `false`. */
export function falseFn(): false { return false; }

/**
 * Returns the number `num` rounded with specified `precision`.
 * The default `precision` value is 6 decimal places.
 * `false` can be passed to skip any processing (can be useful to avoid round-off errors).
 */
export function formatNum(num: number, precision?: number | false) {
	if (precision === false) { return num; }
	const pow = Math.pow(10, precision === undefined ? 6 : precision);
	return Math.round(num * pow) / pow;
}

/**
 * Trims and splits the string on whitespace and returns the array of parts.
 */
export function splitWords(str: string): string[] {
	return str.trim().split(/\s+/);
}

/**
 * Merges the given properties to the `options` of the `obj` object, returning the resulting
 * options. See `Class options`. Has an `L.setOptions` shortcut.
 */
export function setOptions(obj: { options?: any; }, options?: any): any {
	if (!Object.hasOwn(obj, 'options')) {
		obj.options = obj.options ? Object.create(obj.options) : {};
	}
	return Object.assign(obj.options, options);
}

/**
 * Converts an object into a parameter URL string, e.g. `{a: "foo", b: "bar"}`
 * translates to `'?a=foo&b=bar'`. If `existingUrl` is set, the parameters will
 * be appended at the end. If `uppercase` is `true`, the parameter names will
 * be uppercased (e.g. `'?A=foo&B=bar'`)
 */
export function getParamString(obj: Dict<any>, existingUrl?: string, uppercase?: boolean): string {
	const params = [];
	for (const [i, value] of Object.entries(obj)) {
		params.push(`${encodeURIComponent(uppercase ? i.toUpperCase() : i)}=${encodeURIComponent(value)}`);
	}
	return ((!existingUrl || !existingUrl.includes('?')) ? '?' : '&') + params.join('&');
}

const templateRe = /\{ *([\w_ -]+) *\}/g;

/**
 * Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
 * and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
 * `('Hello foo, bar')`. You can also specify functions instead of strings for
 * data values — they will be evaluated passing `data` as an argument.
 */
export function template(str: string, data: Dict<any>): string {
	return str.replace(templateRe, (str, key) => {
		let value = data[key];

		if (value === undefined) {
			throw new Error(`No value provided for variable ${str}`);
		} else if (typeof value === 'function') {
			value = value(data);
		}

		return value;
	});
}

/**
 * Data URI string containing a base64-encoded empty GIF image.
 * Used as a hack to free memory from unused images on WebKit-powered
 * mobile devices (by setting image `src` to this string).
 */
export const emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
