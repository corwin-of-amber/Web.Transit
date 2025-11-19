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

    // Dummy starting coordinates (Tel Aviv Center)
    const telAvivCoords: LngLatLike = [34.7818, 32.0853];

    const lang = 'he';

    const map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: telAvivCoords,
        zoom: 13,
        pitch: 0, 
        bearing: 0,
        attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Remove public transit stations (need to place our own)
    map.on('style.load', () => {    
        for (let layer of ['poi_transit', 'poi_r1', 'poi_r7', 'poi_r20']) {
            map.removeLayer(layer);
        }
    });

    setLanguage(map, lang);

    return map;
}


function setLanguage(map: maplibregl.Map, lang: string) {
    map.on('style.load', () => {    
        for (let layer of map.getStyle().layers) {
            if (layer.type == 'symbol' && (!layer.layout?.['icon-image'] || layer.layout?.['icon-allow-overlap']))
                map.setLayoutProperty(layer.id, 'text-field', ['get', `name:${lang}`])
        }
    });
}

function marker(map: maplibregl.Map, at: LngLatLike) {

    const el = document.createElement('div');
    el.className = 'marker';

    return new maplibregl.Marker({element: el})
        .setLngLat(at)
        .addTo(map);
}


export { map1, map2, marker }