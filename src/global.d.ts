
interface Dict<T> {
    [key: string]: T;
}

interface EventTarget {
    _leaflet_id?: number;
    _leaflet_disable_click?: boolean;
    _leaflet_disable_events?: boolean;
    _leaflet_events?: Dict<any>;
}

interface HTMLElement {
}

interface Window {
    SVGElementInstance: any;
}
