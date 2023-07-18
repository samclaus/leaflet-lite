import './demo-app.css';
import './src/leaflet.css';
import { BoxZoom, enableDoubleClickZoom, Drag, LatLng, Map, TileLayer, TouchZoom, enableScrollWheelZoom } from './src/Leaflet.js';

const map = new Map(document.body, {
    layers: [
        new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    ],
}).setView(new LatLng(51.505, -0.09), 13);
new Drag(map).enable();
enableScrollWheelZoom(map);
enableDoubleClickZoom(map);
new TouchZoom(map).enable();
new BoxZoom(map).enable();