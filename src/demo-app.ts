import { BoxZoom, Circle, Drag, Keyboard, LatLng, Map, Marker, MarkerDrag, SVG, TapHold, TileLayer, TouchZoom, defaultMarkerIcon, enableDoubleClickZoom, enableScrollWheelZoom, getCenterAndZoomForGeolocation } from '.';
import defaultMarkerURL from '../assets/marker.svg';
import './demo-app.css';

// Initialize the map
const map = new Map(
    document.body,
    new LatLng(29.64126400008693, -82.34559052037075),
    13,
    new SVG(),
    {
        minZoom: 0,
        maxZoom: 18,
    },
).addLayer(new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'))

// Add behaviors
new Drag(map);
enableScrollWheelZoom(map);
enableDoubleClickZoom(map);
new TouchZoom(map);
new BoxZoom(map);
new Keyboard(map);
new TapHold(map);

navigator.geolocation.getCurrentPosition(pos => {
    const [coords, smartZoom] = getCenterAndZoomForGeolocation(map, pos.coords);

    map.setView(coords, Math.max(smartZoom, 16));

    const marker = new Marker(coords, defaultMarkerIcon(defaultMarkerURL));
    new MarkerDrag(map, marker, true);

    marker._icon.style.transformOrigin = 'bottom';

    requestAnimationFrame(function updateRotation(time: DOMHighResTimeStamp): void {
        requestAnimationFrame(updateRotation);

        marker.setRotation((time % 2160) / 6);
    });

    map.addLayer(new Circle(coords, { radius: pos.coords.accuracy }))
    map.addLayer(marker);
});
