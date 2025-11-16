<template>
    <div ref='map' :style="{width: '750px', height: '500px', '--zoom': zoom}"
        @mousedown="onMouseDown"></div>
</template>

<style>
</style>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import type { Marker } from 'maplibre-gl';

import { map2, marker } from './libre';
import './markers.css';


@Component({
    emits: ['marker:mousedown']
})
class IMapView extends Vue {
    @Prop
    markers: {[id: string]: {at: XY, tag?: Tag}} = {}
    
    _markers: Map<string, Marker> = new Map

    zoom: number = undefined

    mounted() {
        let map = map2(this.$refs.map);
        this.zoom = map.getZoom();
        map.on('zoom', () => this.zoom = map.getZoom());

        map.on('mousedown', (e) => {
            const features = map.queryRenderedFeatures(e.point);
            console.log(features);
        });

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
        }
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
    }
}


type XY = [number, number];
type Tag = {
    route?: {route_short_name: string, route_color: string}
    stop?: {stop_id: string}
};


export { IMapView }
export default toNative(IMapView);
</script>