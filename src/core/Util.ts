/*
 * @namespace Util
 *
 * Various utility functions, used by Leaflet internally.
 */

// @function extend(dest: Object, src?: Object): Object
// Merges the properties (including properties inherited through the prototype chain)
// of the `src` object (or multiple objects) into `dest` object and returns the latter.
// Has an `L.extend` shortcut.
export function extend(dest: any, ...args: any[]): any {
	for (const src of args) {
		for (const key in src) {
			dest[key] = src[key];
		}
	}
	return dest;
}

// Last unique ID used by [`stamp()`](#util-stamp)
export let lastId = 0;

// Returns the unique ID of an object, assigning it one if it doesn't have it.
export function stamp(obj: any): number {
	if (typeof obj._leaflet_id !== "number") {
		obj._leaflet_id = ++lastId;
	}
	return obj._leaflet_id;
}

// @function throttle(fn: Function, time: Number, context: Object): Function
// Returns a function which executes function `fn` with the given scope `context`
// (so that the `this` keyword refers to `context` inside `fn`'s code). The function
// `fn` will be called no more than one time per given amount of `time`. The arguments
// received by the bound function will be any arguments passed when binding the
// function, followed by any arguments passed when invoking the bound function.
// Has an `L.throttle` shortcut.
export function throttle(fn, time, context) {
	let lock, queuedArgs;

	function later() {
		// reset lock and call if queued
		lock = false;
		if (queuedArgs) {
			wrapperFn.apply(context, queuedArgs);
			queuedArgs = false;
		}
	}

	function wrapperFn(...args) {
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

	return wrapperFn;
}

// Returns the number `num` modulo `range` in such a way so it lies within
// `range[0]` and `range[1]`. The returned value will be always smaller than
// `range[1]` unless `includeMax` is set to `true`.
// TODO: just pass min/max as separate args
export function wrapNum(x: number, range: [number, number], includeMax?: boolean) {
	const
		max = range[1],
	    min = range[0],
	    d = max - min;
	return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
}

// @function falseFn(): Function
// Returns a function which always returns `false`.
export function falseFn() { return false; }

// Returns the number `num` rounded with specified `precision`.
// The default `precision` value is 6 decimal places.
// `false` can be passed to skip any processing (can be useful to avoid round-off errors).
export function formatNum(num: number, precision?: number | false) {
	if (precision === false) { return num; }
	const pow = Math.pow(10, precision === undefined ? 6 : precision);
	return Math.round(num * pow) / pow;
}

// @function splitWords(str: String): String[]
// Trims and splits the string on whitespace and returns the array of parts.
export function splitWords(str: string): string[] {
	return str.trim().split(/\s+/);
}

// Merges the given properties to the `options` of the `obj` object, returning the resulting
// options. See `Class options`. Has an `L.setOptions` shortcut.
export function setOptions(obj: { options?: any; }, options?: any): any {
	if (!Object.hasOwn(obj, 'options')) {
		obj.options = obj.options ? Object.create(obj.options) : {};
	}
	return Object.assign(obj.options, options);
}

// @function getParamString(obj: Object, existingUrl?: String, uppercase?: Boolean): String
// Converts an object into a parameter URL string, e.g. `{a: "foo", b: "bar"}`
// translates to `'?a=foo&b=bar'`. If `existingUrl` is set, the parameters will
// be appended at the end. If `uppercase` is `true`, the parameter names will
// be uppercased (e.g. `'?A=foo&B=bar'`)
export function getParamString(obj, existingUrl, uppercase) {
	const params = [];
	for (const [i, value] of Object.entries(obj)) {
		params.push(`${encodeURIComponent(uppercase ? i.toUpperCase() : i)}=${encodeURIComponent(value)}`);
	}
	return ((!existingUrl || !existingUrl.includes('?')) ? '?' : '&') + params.join('&');
}

const templateRe = /\{ *([\w_ -]+) *\}/g;

// @function template(str: String, data: Object): String
// Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
// and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
// `('Hello foo, bar')`. You can also specify functions instead of strings for
// data values — they will be evaluated passing `data` as an argument.
export function template(str, data) {
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

// @property emptyImageUrl: String
// Data URI string containing a base64-encoded empty GIF image.
// Used as a hack to free memory from unused images on WebKit-powered
// mobile devices (by setting image `src` to this string).
export const emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
