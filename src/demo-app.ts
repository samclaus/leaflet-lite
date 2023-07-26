import './demo-app.css';
import './leaflet.css';
import { BoxZoom, enableDoubleClickZoom, Drag, LatLng, Map, TileLayer, TouchZoom, enableScrollWheelZoom, Keyboard, TapHold, Locator, Marker, defaultIcon, MarkerDrag, SVG, Circle } from './Leaflet.js';
import defaultMarkerURL from '../assets/marker.svg';

// Initialize the map
const map = new Map(document.body, new SVG())
    .addLayer(new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'))
    .setView(new LatLng(29.64126400008693, -82.34559052037075), 13);

// Add behaviors
new Drag(map);
enableScrollWheelZoom(map);
enableDoubleClickZoom(map);
new TouchZoom(map);
new BoxZoom(map);
new Keyboard(map);
new TapHold(map);

new Locator(map).locate({ setView: true, maxZoom: 16 }).on('locationfound', ev => {
    const marker = new Marker(ev.latlng, defaultIcon(defaultMarkerURL));
    new MarkerDrag(map, marker, true);

    marker._icon.style.transformOrigin = 'bottom';

    requestAnimationFrame(function updateRotation(time: DOMHighResTimeStamp): void {
        requestAnimationFrame(updateRotation);

        marker.setRotation((time % 2160) / 6);
    });

    map.addLayer(new Circle(ev.latlng, { radius: ev.accuracy }))
    map.addLayer(marker);
});