import { LatLng, Map, TileLayer } from './src/Leaflet.js';

const map = new Map(document.body, {
    layers: [
        new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    ],
}).setView(new LatLng(51.505, -0.09), 13);