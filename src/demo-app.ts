import { BoxZoom, Drag, Keyboard, LatLng, Map, NodeDrag, TapHold, TileLayer, TouchZoom, canvas, defaultMarkerIcon, enableDoubleClickZoom, enableScrollWheelZoom, getCenterAndZoomForGeolocation } from '.';
import defaultMarkerURL from '../assets/marker.svg';
import './demo-app.css';

// Initialize the map
const map = new Map(
    document.body,
    new LatLng(29.64126400008693, -82.34559052037075),
    13,
    {
        minZoom: 0,
        maxZoom: 18,
    },
);

new TileLayer(map, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').init();

const cvs = new canvas.Canvas(map);
cvs.init();

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

    const marker = defaultMarkerIcon(map, defaultMarkerURL, coords);
    new NodeDrag(map, marker, true);

    marker._el.style.transformOrigin = 'bottom';

    requestAnimationFrame(function updateRotation(time: DOMHighResTimeStamp): void {
        requestAnimationFrame(updateRotation);

        marker.setRotation((time % 2160) / 6);
    });

    new canvas.Circle(cvs, coords, pos.coords.accuracy).add();
});
