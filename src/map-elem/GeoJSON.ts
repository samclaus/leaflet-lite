// import type { Layer } from './Layer.js';
// import type { Path } from './Path.js';
// import { Util } from '../core';
// import { LatLng } from '../geog';
// import { GeogUtil } from '../geog/util';
// import { LayerGroup } from './LayerGroup.js';
// import { Marker } from './marker';
// import { CircleMarker, Polygon, Polyline } from './vector';
// import { Util } from '../core';
// import { LatLngBounds } from '../geog';
// import { Layer } from '.';
// import type { PathOptions } from './vector';
// import type { Map } from '../map';

/**
 * READ THIS COMMENT BEFORE TOUCHING THIS FILE
 * 
 * Previously, Leaflet had a ton of functionality to support GeoJSON. First of all,
 * it had a classes FeatureGroup and LayerGroup (I can't remember which subclassed
 * which) that extended the main Layer class to walk and talk like a single object on
 * the map while actually holding references to many objects/elements (markers, video
 * overlays, polylines, etc.) on the map. The GeoJSON class then subclassed that
 * functionality to group all of the polylines, polygons, circles, markers, etc. that
 * were parsed from GeoJSON data. This let you easily, say, add a tooltip to the entire
 * cluster of things on the map.
 * 
 * However, all of this religious subclassing and obsession with uniformity came at the
 * cost of complexity (both mentally for the programmer and performance-wise for the
 * computer) and code bloat. Vector objects (such as polylines and circles) are no
 * longer full "map element" citizens because they do not even correspond to a DOM
 * element if they are rendered with a Canvas. Additionally, LayerGroup didn't actually
 * seem all that useful in practice. I am preferring to have individual map elements be
 * very lightweight without full-fledged event handling, etc., and the user of the library
 * can simply listener for 'mouseover' events on the map itself and rely on event bubbling
 * and an API for easily figuring out which element the event came from to decide what to
 * do. This is generally referred to as "event delegation" on the web, and is much better
 * for performance (and the programmer's mental model imo) when you don't have to worry about
 * adding separate event handlers to every little element. Just a top-level 'mouseover'
 * handler, for example, which can inspect which element the event originated from trivially
 * and then decide what to do.
 * 
 * I will reimplement GeoJSON functionality with this lightweight ideal in mind in the future.
 */

// /**
//  * Used to group several layers and handle them as one. If you add it to the map,
//  * any layers added or removed from the group will be added/removed on the map as
//  * well. Extends `Layer`.
//  *
//  *  - [`bindTooltip`](#layer-bindtooltip) binds a tooltip to all of the layers at once
//  *  - Events are propagated to the `LayerGroup`, so if the group has an event
//  * handler, it will handle events from any of the layers. This includes mouse events
//  * and custom events.
//  *
//  * ```js
//  * const lg = new LayerGroup([marker1, marker2])
//  * 	.addLayer(polyline)
//  * 	.bindTooltip('Hello world!')
//  * 	.on('click', function() { alert('Clicked on a member of the group!'); });
//  * 
//  * map.addLayer(lg);
//  * ```
//  */
// export class LayerGroup extends Layer {

// 	_layers: { [leafletID: string]: Layer } = {};

// 	constructor(layers: Layer[], options?: any) {
// 		super();

// 		Util.setOptions(this, options);

// 		this._isLayerGroup = true;

// 		for (const layer of layers) {
// 			this._layers[Util.stamp(layer)] = layer;
// 		}
// 	}

// 	onAdd(map: Map): this {
// 		return this.eachLayer(map.addLayer, map);
// 	}

// 	onRemove(map: Map): void {
// 		this.eachLayer(map.removeLayer, map);
// 	}

// 	/**
// 	 * Override the default Layer focus functionality to add focus listeners on
// 	 * every Layer in the group. This was needed for tooltips. -- Sam on 10/18/23
// 	 */
// 	_addFocusListeners(): void {
// 		this.eachLayer(this._addFocusListenersOnLayer, this);
// 	}

// 	/**
// 	 * Override the default Layer aria functionality to add descriptions on
// 	 * every Layer in the group. This was needed for tooltips. -- Sam on 10/18/23
// 	 */
// 	_setAriaDescribedBy(): void {
// 		this.eachLayer(this._setAriaDescribedByOnLayer, this);
// 	}

// 	/**
// 	 * Adds the given layer to the group. Does nothing if the layer is already
// 	 * a member of this group.
// 	 */
// 	addLayer(layer: Layer): this {
// 		const id = Util.stamp(layer);

// 		if (id in this._layers) {
// 			return this;
// 		}

// 		layer.addEventParent(this);

// 		this._layers[id] = layer;

// 		if (this._map) {
// 			this._map.addLayer(layer);
// 		}
// 	}

// 	/**
// 	 * Removes the given layer (or layer ID) from the group. Does nothing if the
// 	 * given layer is not a member of this group.
// 	 */
// 	removeLayer(layerOrID: number | Layer): this {
// 		const
// 			id = typeof layerOrID === 'number' ? layerOrID : Util.stamp(layerOrID),
// 			layer = this._layers[id];

// 		// NOTE: we care that the layer was registered in this LayerGroup's map,
// 		// not just that we can get ahold of a proper Layer object
// 		if (!layer) {
// 			return this;
// 		}

// 		layer.removeEventParent(this);

// 		if (this._map) {
// 			this._map.removeLayer(layer);
// 		}

// 		delete this._layers[id];

// 		return this;
// 	}

// 	// Returns `true` if the given layer (or layer ID) is currently added to the group.
// 	hasLayer(layer: number | Layer): boolean {
// 		const id = typeof layer === 'number' ? layer : Util.stamp(layer);
// 		return id in this._layers;
// 	}

// 	// Removes all the layers from the group.
// 	clearLayers(): this {
// 		return this.eachLayer(this.removeLayer, this);
// 	}

// 	/**
// 	 * Iterates over the layers of the group, optionally specifying context
// 	 * of the iterator function.
// 	 *
// 	 * ```
// 	 * group.eachLayer(function(layer){
// 	 *     layer.bindTooltip('Hello');
// 	 * });
// 	 * ```
// 	 */
// 	eachLayer(method: (l: Layer) => void): this;
// 	eachLayer<This>(method: (this: This, l: Layer) => void, context: This): this;
// 	eachLayer(method: (l: Layer) => void, context?: any): this {
// 		for (const layer of Object.values(this._layers)) {
// 			method.call(context, layer);
// 		}
// 		return this;
// 	}

// 	// Returns the layer with the given internal ID.
// 	getLayer(id: number): Layer | undefined {
// 		return this._layers[id];
// 	}

// 	// Returns an array of all the layers added to the group.
// 	getLayers(): Layer[] {
// 		return Object.values(this._layers);
// 	}

// 	// Calls `methodName` on every layer contained in this group, passing any
// 	// additional parameters. Has no effect if the layers contained do not
// 	// implement `methodName`.
// 	invoke(methodName: string, ...args: readonly any[]): this {
// 		for (const layer of Object.values(this._layers)) {
// 			(layer as any)[methodName]?.apply(layer, args);
// 		}
// 		return this;
// 	}

// 	// Calls `setZIndex` on every layer contained in this group, passing the z-index.
// 	setZIndex(zIndex: number): this {
// 		return this.invoke('setZIndex', zIndex);
// 	}

// 	// Sets the given path options to each layer of the group that has a `setStyle` method.
// 	setStyle(style: Partial<PathOptions>): this {
// 		return this.invoke('setStyle', style);
// 	}

// 	// Brings the layer group to the top of all other layers
// 	bringToFront(): this {
// 		return this.invoke('bringToFront');
// 	}

// 	// Brings the layer group to the back of all other layers
// 	bringToBack(): this {
// 		return this.invoke('bringToBack');
// 	}

// 	// Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
// 	getBounds(): LatLngBounds {
// 		const bounds = new LatLngBounds();

// 		for (
// 			const layer of Object.values(this._layers)
// 		) {
// 			if (layer.getBounds) {
// 				bounds.extend(layer.getBounds());
// 			} else if (layer.getLatLng) {
// 				bounds.extend(layer.getLatLng());
// 			}
// 		}

// 		return bounds;
// 	}

// }

// /**
//  * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to parse
//  * GeoJSON data and display it on the map. Extends `LayerGroup`.
//  *
//  * ```js
//  * map.addLayer(
//  *     L.geoJSON(data, {
//  *     	style: function (feature) {
//  *     		return {color: feature.properties.color};
//  *     	}
//  *     }),
//  * );
//  * ```
//  */
// export const GeoJSON = LayerGroup.extend({

// 	/* @section
// 	 * @aka GeoJSON options
// 	 *
// 	 * @option pointToLayer: Function = *
// 	 * A `Function` defining how GeoJSON points spawn Leaflet layers. It is internally
// 	 * called when data is added, passing the GeoJSON point feature and its `LatLng`.
// 	 * The default is to spawn a default `Marker`:
// 	 * ```js
// 	 * function(geoJsonPoint, latlng) {
// 	 * 	return L.marker(latlng);
// 	 * }
// 	 * ```
// 	 *
// 	 * @option style: Function = *
// 	 * A `Function` defining the `Path options` for styling GeoJSON lines and polygons,
// 	 * called internally when data is added.
// 	 * The default value is to not override any defaults:
// 	 * ```js
// 	 * function (geoJsonFeature) {
// 	 * 	return {}
// 	 * }
// 	 * ```
// 	 *
// 	 * @option onEachFeature: Function = *
// 	 * A `Function` that will be called once for each created `Feature`, after it has
// 	 * been created and styled. Useful for attaching events to features.
// 	 * The default is to do nothing with the newly created layers:
// 	 * ```js
// 	 * function (feature, layer) {}
// 	 * ```
// 	 *
// 	 * @option filter: Function = *
// 	 * A `Function` that will be used to decide whether to include a feature or not.
// 	 * The default is to include all features:
// 	 * ```js
// 	 * function (geoJsonFeature) {
// 	 * 	return true;
// 	 * }
// 	 * ```
// 	 * Note: dynamically changing the `filter` option will have effect only on newly
// 	 * added data. It will _not_ re-evaluate already included features.
// 	 *
// 	 * @option coordsToLatLng: Function = *
// 	 * A `Function` that will be used for converting GeoJSON coordinates to `LatLng`s.
// 	 * The default is the `coordsToLatLng` static method.
// 	 *
// 	 * @option markersInheritOptions: Boolean = false
// 	 * Whether default Markers for "Point" type Features inherit from group options.
// 	 */

// 	constructor(geojson, options) {
// 		Util.setOptions(this, options);

// 		this._layers = {};

// 		if (geojson) {
// 			this.addData(geojson);
// 		}
// 	},

// 	// Adds a GeoJSON object to the layer.
// 	addData(geojson: any /* TODO: GeoJSON interface */): this {
// 		const features = Array.isArray(geojson) ? geojson : geojson.features;
// 		let i, len, feature;

// 		if (features) {
// 			for (i = 0, len = features.length; i < len; i++) {
// 				// only add this if geometry or geometries are set and not null
// 				feature = features[i];
// 				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
// 					this.addData(feature);
// 				}
// 			}
// 			return this;
// 		}

// 		const options = this.options;

// 		if (options.filter && !options.filter(geojson)) { return this; }

// 		const layer = geometryToLayer(geojson, options);
// 		if (!layer) {
// 			return this;
// 		}
// 		layer.feature = asFeature(geojson);

// 		layer.defaultOptions = layer.options;
// 		this.resetStyle(layer);

// 		if (options.onEachFeature) {
// 			options.onEachFeature(geojson, layer);
// 		}

// 		return this.addLayer(layer);
// 	},

// 	// Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after hover events.
// 	// If `layer` is omitted, the style of all features in the current layer is reset.
// 	resetStyle(layer?: Path): this {
// 		if (layer === undefined) {
// 			return this.eachLayer(this.resetStyle, this);
// 		}
// 		// reset any custom styles
// 		layer.options = Util.extend({}, layer.defaultOptions);
// 		this._setLayerStyle(layer, this.options.style);
// 		return this;
// 	},

// 	// Changes styles of GeoJSON vector layers with the given style function.
// 	setStyle(style: any /* TODO: function? */): this {
// 		return this.eachLayer(function (layer) {
// 			this._setLayerStyle(layer, style);
// 		}, this);
// 	},

// 	_setLayerStyle(layer, style) {
// 		if (layer.setStyle) {
// 			if (typeof style === 'function') {
// 				style = style(layer.feature);
// 			}
// 			layer.setStyle(style);
// 		}
// 	}
// });

// // @section
// // There are several static functions which can be called without instantiating L.GeoJSON:

// // @function geometryToLayer(featureData: Object, options?: GeoJSON options): Layer
// // Creates a `Layer` from a given GeoJSON feature. Can use a custom
// // [`pointToLayer`](#geojson-pointtolayer) and/or [`coordsToLatLng`](#geojson-coordstolatlng)
// // functions if provided as options.
// export function geometryToLayer(geojson, options) {

// 	const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
// 	      coords = geometry ? geometry.coordinates : null,
// 	      layers = [],
// 	      pointToLayer = options && options.pointToLayer,
// 	      _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng;
// 	let latlng, latlngs, i, len;

// 	if (!coords && !geometry) {
// 		return null;
// 	}

// 	switch (geometry.type) {
// 	case 'Point':
// 		latlng = _coordsToLatLng(coords);
// 		return _pointToLayer(pointToLayer, geojson, latlng, options);

// 	case 'MultiPoint':
// 		for (i = 0, len = coords.length; i < len; i++) {
// 			latlng = _coordsToLatLng(coords[i]);
// 			layers.push(_pointToLayer(pointToLayer, geojson, latlng, options));
// 		}
// 		return new LayerGroup(layers);

// 	case 'LineString':
// 	case 'MultiLineString':
// 		latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
// 		return new Polyline(latlngs, options);

// 	case 'Polygon':
// 	case 'MultiPolygon':
// 		latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
// 		return new Polygon(latlngs, options);

// 	case 'GeometryCollection':
// 		for (i = 0, len = geometry.geometries.length; i < len; i++) {
// 			const geoLayer = geometryToLayer({
// 				geometry: geometry.geometries[i],
// 				type: 'Feature',
// 				properties: geojson.properties
// 			}, options);

// 			if (geoLayer) {
// 				layers.push(geoLayer);
// 			}
// 		}
// 		return new LayerGroup(layers);

// 	case 'FeatureCollection':
// 		for (i = 0, len = geometry.features.length; i < len; i++) {
// 			const featureLayer = geometryToLayer(geometry.features[i], options);

// 			if (featureLayer) {
// 				layers.push(featureLayer);
// 			}
// 		}
// 		return new LayerGroup(layers);

// 	default:
// 		throw new Error('Invalid GeoJSON object.');
// 	}
// }

// function _pointToLayer(pointToLayerFn, geojson, latlng, options) {
// 	return pointToLayerFn ?
// 		pointToLayerFn(geojson, latlng) :
// 		new Marker(latlng, options && options.markersInheritOptions && options);
// }

// // @function coordsToLatLng(coords: Array): LatLng
// // Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
// // or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
// export function coordsToLatLng(coords) {
// 	return new LatLng(coords[1], coords[0], coords[2]);
// }

// // @function coordsToLatLngs(coords: Array, levelsDeep?: Number, coordsToLatLng?: Function): Array
// // Creates a multidimensional array of `LatLng`s from a GeoJSON coordinates array.
// // `levelsDeep` specifies the nesting level (0 is for an array of points, 1 for an array of arrays of points, etc., 0 by default).
// // Can use a custom [`coordsToLatLng`](#geojson-coordstolatlng) function.
// export function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
// 	const latlngs = [];

// 	for (let i = 0, len = coords.length, latlng; i < len; i++) {
// 		latlng = levelsDeep ?
// 			coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
// 			(_coordsToLatLng || coordsToLatLng)(coords[i]);

// 		latlngs.push(latlng);
// 	}

// 	return latlngs;
// }

// // Reverse of [`coordsToLatLng`](#geojson-coordstolatlng)
// // Coordinates values are rounded with [`formatNum`](#util-formatnum) function.
// export function latLngToCoords(latlng: LatLng, precision?: number | false): number[] {
// 	return typeof latlng.alt === 'number' ?
// 		[
// 			Util.formatNum(latlng.lng, precision),
// 			Util.formatNum(latlng.lat, precision),
// 			Util.formatNum(latlng.alt, precision),
// 		] : [
// 			Util.formatNum(latlng.lng, precision),
// 			Util.formatNum(latlng.lat, precision),
// 		];
// }

// // @function latLngsToCoords(latlngs: Array, levelsDeep?: Number, close?: Boolean, precision?: Number|false): Array
// // Reverse of [`coordsToLatLngs`](#geojson-coordstolatlngs)
// // `close` determines whether the first point should be appended to the end of the array to close the feature, only used when `levelsDeep` is 0. False by default.
// // Coordinates values are rounded with [`formatNum`](#util-formatnum) function.
// export function latLngsToCoords(latlngs, levelsDeep, close, precision) {
// 	const coords = [];

// 	for (let i = 0, len = latlngs.length; i < len; i++) {
// 		// Check for flat arrays required to ensure unbalanced arrays are correctly converted in recursion
// 		coords.push(levelsDeep ?
// 			latLngsToCoords(latlngs[i], GeogUtil.isFlat(latlngs[i]) ? 0 : levelsDeep - 1, close, precision) :
// 			latLngToCoords(latlngs[i], precision));
// 	}

// 	if (!levelsDeep && close && coords.length > 0) {
// 		coords.push(coords[0].slice());
// 	}

// 	return coords;
// }

// export function getFeature(layer, newGeometry) {
// 	return layer.feature ?
// 		Util.extend({}, layer.feature, {geometry: newGeometry}) :
// 		asFeature(newGeometry);
// }

// // @function asFeature(geojson: Object): Object
// // Normalize GeoJSON geometries/features into GeoJSON features.
// export function asFeature(geojson) {
// 	if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
// 		return geojson;
// 	}

// 	return {
// 		type: 'Feature',
// 		properties: {},
// 		geometry: geojson
// 	};
// }

// export function pointToGeoJSON(point: Marker | CircleMarker, precision?: number) {
// 	return getFeature(point, {
// 		type: 'Point',
// 		coordinates: latLngToCoords(point.getLatLng(), precision),
// 	});
// }

// export function polylineToGeoJSON(line: Polyline, precision?: number) {
// 	const
// 		multi = !GeogUtil.isFlat(line._latlngs),
// 		coords = latLngsToCoords(line._latlngs, multi ? 1 : 0, false, precision);

// 	return getFeature(line, {
// 		type: `${multi ? 'Multi' : ''}LineString`,
// 		coordinates: coords
// 	});
// }

// export function polygonToGeoJSON(poly: Polygon, precision?: number) {
// 	const
// 		holes = !GeogUtil.isFlat(poly._latlngs),
// 		multi = holes && !GeogUtil.isFlat(poly._latlngs[0]);

// 	let coords = latLngsToCoords(poly._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);

// 	if (!holes) {
// 		coords = [coords];
// 	}

// 	return getFeature(poly, {
// 		type: `${multi ? 'Multi' : ''}Polygon`,
// 		coordinates: coords
// 	});
// }

// export function genericToGeoJSON(layer: Layer, precision?: number) {
// 	if (layer instanceof Polygon) {
// 		return polygonToGeoJSON(layer, precision);
// 	}
// 	if (layer instanceof Polyline) {
// 		return polylineToGeoJSON(layer, precision);
// 	}
// 	if (layer instanceof Marker || layer instanceof CircleMarker) {
// 		return pointToGeoJSON(layer, precision);
// 	}
// }

// // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
// // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the layer group (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
// export function layerGroupToGeoJSON(lg: LayerGroup, precision?: number) {
// 	const type = lg.feature?.geometry?.type;

// 	if (type === 'MultiPoint') {
// 		const coords: number[][] = [];

// 		lg.eachLayer(layer => {
// 			const json = genericToGeoJSON(layer, precision);

// 			if (json) {
// 				coords.push(json.geometry.coordinates);
// 			}
// 		});

// 		return getFeature(lg, {
// 			type: 'MultiPoint',
// 			coordinates: coords
// 		});
// 	}

// 	const
// 		isGeometryCollection = type === 'GeometryCollection',
// 		jsons: any[] = []; // TODO

// 	lg.eachLayer(layer => {
// 		const json = genericToGeoJSON(layer, precision);

// 		if (json) {
// 			if (isGeometryCollection) {
// 				jsons.push(json.geometry);
// 			} else {
// 				const feature = asFeature(json);
// 				// Squash nested feature collections
// 				if (feature.type === 'FeatureCollection') {
// 					jsons.push.apply(jsons, feature.features);
// 				} else {
// 					jsons.push(feature);
// 				}
// 			}
// 		}
// 	});

// 	if (isGeometryCollection) {
// 		return getFeature(lg, {
// 			geometries: jsons,
// 			type: 'GeometryCollection'
// 		});
// 	}

// 	return {
// 		type: 'FeatureCollection',
// 		features: jsons
// 	};
// }
