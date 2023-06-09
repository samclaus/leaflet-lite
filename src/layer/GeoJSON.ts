// import type { Layer, Path } from '../Leaflet.js';
// import * as Util from '../core/Util.js';
// import { LatLng } from '../geo/LatLng.js';
// import * as LineUtil from '../geometry/LineUtil.js';
// import { FeatureGroup } from './FeatureGroup.js';
// import { LayerGroup } from './LayerGroup.js';
// import { Marker } from './marker/Marker.js';
// import { CircleMarker } from './vector/CircleMarker.js';
// import { Polygon } from './vector/Polygon.js';
// import { Polyline } from './vector/Polyline.js';

// /**
//  * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to parse
//  * GeoJSON data and display it on the map. Extends `FeatureGroup`.
//  *
//  * ```js
//  * L.geoJSON(data, {
//  * 	style: function (feature) {
//  * 		return {color: feature.properties.color};
//  * 	}
//  * }).addTo(map);
//  * ```
//  */
// export const GeoJSON = FeatureGroup.extend({

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
// 		return new FeatureGroup(layers);

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
// 		return new FeatureGroup(layers);

// 	case 'FeatureCollection':
// 		for (i = 0, len = geometry.features.length; i < len; i++) {
// 			const featureLayer = geometryToLayer(geometry.features[i], options);

// 			if (featureLayer) {
// 				layers.push(featureLayer);
// 			}
// 		}
// 		return new FeatureGroup(layers);

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
// 			latLngsToCoords(latlngs[i], LineUtil.isFlat(latlngs[i]) ? 0 : levelsDeep - 1, close, precision) :
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
// 		multi = !LineUtil.isFlat(line._latlngs),
// 		coords = latLngsToCoords(line._latlngs, multi ? 1 : 0, false, precision);

// 	return getFeature(line, {
// 		type: `${multi ? 'Multi' : ''}LineString`,
// 		coordinates: coords
// 	});
// }

// export function polygonToGeoJSON(poly: Polygon, precision?: number) {
// 	const
// 		holes = !LineUtil.isFlat(poly._latlngs),
// 		multi = holes && !LineUtil.isFlat(poly._latlngs[0]);

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
