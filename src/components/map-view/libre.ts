import maplibregl, { LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
    true // Lazy load the plugin
);


function map1(container) {
    var map = new maplibregl.Map({
        container,
        style: 'https://demotiles.maplibre.org/style.json', // stylesheet location
        center: [-74.5, 40], // starting position [lng, lat]
        zoom: 3 // starting zoom
    });
}
function map2(container) {
    //const STYLE_URL = 'https://api.maptiler.com/maps/basic-v2/style.json?key=oG3f2x4e0Q2a8E4f2w3a';
    // New Style URL: CARTO Voyager - highly reliable and CORS-friendly
    //const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
    const MVT_TILE_URL = 'https://openfreemap.org/tiles/v3/{z}/{x}/{y}.pbf';
    const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

    // 1. Define the coordinates for Tel Aviv (Longitude, Latitude)
    const telAvivLonLat: LngLatLike = [34.7818, 32.0853];

    // 2. Initialize the MapLibre GL Map
    const map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: telAvivLonLat,
        zoom: 13,
        pitch: 0, 
        bearing: 0,
    });

    // 3. Add navigation controls for a better user experience
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    console.log("MapLibre GL JS initialized. Attempting to render map with new style.");
}


export { map1, map2 }