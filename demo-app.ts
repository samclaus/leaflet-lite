import './demo-app.css';
import './src/leaflet.css';
import { BoxZoom, enableDoubleClickZoom, Drag, LatLng, Map, TileLayer, TouchZoom, enableScrollWheelZoom, Keyboard, TapHold } from './src/Leaflet.js';

// Initialize the map
const map = new Map(document.body)
    .addLayer(new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'))
    .setView(new LatLng(51.505, -0.09), 13);

// Add behaviors
new Drag(map);
enableScrollWheelZoom(map);
enableDoubleClickZoom(map);
new TouchZoom(map);
new BoxZoom(map);
new Keyboard(map);
new TapHold(map);