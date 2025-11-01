<template>
    <div ref='map' style='width: 750px; height: 500px;'></div>
</template>

<style>
</style>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import type { Marker } from 'maplibre-gl';

import { map2, marker } from './libre';
import './markers.css';


@Component
class IMapView extends Vue {
    @Prop
    markers: {[id: string]: {at: XY, tag?: Tag}} = {}
    
    _markers: Map<string, Marker> = new Map

    mounted() {
        let map = map2(this.$refs.map);

        this.$watch('markers', (m: typeof this.markers) => {
            for (let [k, v] of Object.entries(m)) {
                let mark = this._markers.get(k);
                if (mark)
                    mark.setLngLat(v.at);
                else {
                    mark = marker(map, v.at);
                    this._markers.set(k, mark);
                }
                this.configureMarker(mark, v.tag);
            }
            for (let [k, v] of this._markers.entries()) {
                if (!Object.hasOwn(m, k)) {
                    v.remove();
                    this._markers.delete(k);
                }
            }
        }, {immediate: true, deep: true})
    }

    configureMarker(mark: Marker, tag: Tag) {
        if (tag?.route) {
            let e = mark.getElement();
            e.setAttribute('data-route', tag.route.route_short_name);
            e.style.setProperty('--color', '#' + tag.route.route_color);
        }
    }
}


type XY = [number, number];
type Tag = {
    route?: {route_short_name: string, route_color: string}
};


export { IMapView }
export default toNative(IMapView);
</script>