import * as Util from './Util.js';

/**
 * Base class for most Leaflet classes with generic options-merging functionality.
 */
export class Class {

	// @function extend(props: Object): Function
	// [Extends the current class](#class-inheritance) given the properties to be included.
	// Returns a Javascript function that is a class constructor (to be called with `new`).
	static extend(props: { [key: string]: any }) {
		class NewClass extends this {};

		// inherit parent's static properties
		Object.setPrototypeOf(NewClass, this);

		const parentProto = this.prototype;
		const proto = NewClass.prototype;

		// mix given properties into the prototype
		Util.extend(proto, props);

		// merge options
		if (proto.options) {
			proto.options = parentProto.options ? Object.create(parentProto.options) : {};
			Util.extend(proto.options, props.options);
		}

		return NewClass;
	}

	// @function include(properties: Object): this
	// [Includes a mixin](#class-includes) into the current class.
	static include(props) {
		const parentOptions = this.prototype.options;
		Util.extend(this.prototype, props);
		if (props.options) {
			this.prototype.options = parentOptions;
			this.mergeOptions(props.options);
		}
		return this;
	}

	// [Merges `options`](#class-options) into the defaults of the class.
	static mergeOptions(options: any): this {
		Util.extend(this.prototype.options, options);
		return this;
	}

	constructor(...args) {
		Util.setOptions(this);

		// call the constructor
		if (this.initialize) {
			this.initialize(...args);
		}
	}

}
