import { DomUtil } from '../../dom';
import { Point } from '../../geom';
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
	const el = new Image(25, 41);
	
	el.src = imagePath + 'marker-icon.png';
	el.alt = 'Blue map marker';
	el.className = 'leaflet-marker-icon';
	el.style.width  = '25px';
	el.style.height = '41px';
	el.style.marginLeft = '-12px';
	el.style.marginTop  = '-41px';

	return new Icon(el, new Point(25, 41), new Point(12, 41));
}
