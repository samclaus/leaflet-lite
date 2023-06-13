import { DomUtil } from '../../dom';
import { Point } from '../../geometry';
import { Icon } from './Icon.js';

let defaultImagePath: string | undefined;

function getDefaultImagePath(): string {
	return defaultImagePath ||= detectDefaultImagePath();
}

function detectDefaultImagePath(): string {
	const el = DomUtil.create('div', 'leaflet-default-icon-path', document.body);
	const path = stripUrl(getComputedStyle(el).backgroundImage);

	document.body.removeChild(el);
	if (path) { return path; }
	const link = document.querySelector('link[href$="leaflet.css"]') as HTMLLinkElement;
	if (!link) { return ''; }
	return link.href.substring(0, link.href.length - 'leaflet.css'.length - 1);
}

function stripUrl(path: string): string {
	function strip(str: string, re: RegExp, idx: number): string {
		return re.exec(str)?.[idx] || '';
	}
	path = strip(path, /^url\((['"])?(.+)\1\)$/, 2);
	return path && strip(path, /^(.*)marker-icon\.png$/, 1);
}

export function defaultIcon(imagePath = getDefaultImagePath()): Icon {
	return new Icon({
		iconUrl: imagePath + 'marker-icon.png',
		iconSize: new Point(25, 41),
		iconAnchor: new Point(12, 41),
		tooltipAnchor: new Point(16, -28),
	});
}
