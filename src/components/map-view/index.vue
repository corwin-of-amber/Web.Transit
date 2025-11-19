<template>
    <div ref='map' class="mapview" :style="{'--zoom': zoom}">
    </div>
</template>

<style>
</style>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import type { Map as MapLibre, MapMouseEvent, Marker } from 'maplibre-gl';

import { map2, marker } from './libre';
import './markers.css';


@Component({
    emits: ['mousedown', 'poke', 'marker:mousedown']
})
class IMapView extends Vue {
    @Prop
    markers: {[id: string]: {at: XY, tag?: Tag}} = {}
    
    map: MapLibre
    _markers: Map<string, Marker> = new Map

    zoom: number = undefined
    _clicking: boolean = false

    mounted() {
        let map = map2(this.$refs.map);
        this.zoom = map.getZoom();
        map.on('zoom', () => this.zoom = map.getZoom());

        map.on('mousedown', ev => {
            this.onMouseDown(ev.originalEvent) ||
                this.onMapMouseDown(ev);
        });
        map.on('mouseup', ev => this.onMapMouseUp(ev));
        map.on('drag', () => this._clicking = false); // prevent poke

        this.map = map;

        this.$watch('markers', (m: typeof this.markers) => {
            for (let [k, v] of Object.entries(m)) {
                let mark = this._markers.get(k);
                if (mark)
                    mark.setLngLat(v.at);
                else {
                    mark = marker(map, v.at);
                    this._markers.set(k, mark);
                }
                this.configureMarker(mark, k, v.tag);
            }
            for (let [k, v] of this._markers.entries()) {
                if (!Object.hasOwn(m, k)) {
                    v.remove();
                    this._markers.delete(k);
                }
            }
        }, {immediate: true, deep: true});
    }

    onMouseDown(ev: MouseEvent) {
        let marker = (ev.target as HTMLElement).closest('.marker[data-key]');
        if (marker) {
            let key = marker.getAttribute('data-key');
            this.$emit('marker:mousedown', {
                $ev: ev,
                el: marker,
                marker: this.markers[key],
                glmarker: this._markers.get(key)
            });
            return true;
        }
    }

    onMapMouseDown(ev: MapMouseEvent) {
        const features = this.map.queryRenderedFeatures(ev.point);
        console.log(ev, features);
        this.$emit('mousedown', ev);
        this._clicking = true;
    }

    onMapMouseUp(ev: MapMouseEvent) {
        if (this._clicking) this.$emit('poke', ev);
        this._clicking = false;
    }

    configureMarker(mark: Marker, key: string, tag: Tag) {
        let e = mark.getElement();
        e.setAttribute('data-key', key);
        if (tag?.route) {
            e.classList.add('marker--route');
            e.setAttribute('data-route', tag.route.route_short_name);
            e.style.setProperty('--color', '#' + tag.route.route_color);
        }
        else if (tag?.stop) {
            e.classList.add('marker--stop');
            e.setAttribute('data-stop_id', tag.stop.stop_id);
        }
        if (tag?.kind) {
            e.classList.add(`marker--${tag.kind}`);
        }
    }
}


type XY = [number, number];
type Tag = {
    route?: {route_short_name: string, route_color: string}
    stop?: {stop_id: string},
    kind?: string
};


export { IMapView }
export default toNative(IMapView);
</script>