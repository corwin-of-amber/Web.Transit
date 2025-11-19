<template>
    <div>
        <MapView :markers="markers" @poke="onMapPoke"
            @marker:mousedown="onMarker"></MapView> 
        <div class="mini-notebook">
            <div class="mini-cell" v-for="data, id in mininb.cells" :key="id">
                <Grid :data="gridData(data)"></Grid>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Vue, Component, toNative } from 'vue-facing-decorator';
import { MapMouseEvent } from 'maplibre-gl';
import Grid, { data as gridData }  from './grid';
import MapView, { IMapView } from './map-view/index.vue';

import sampleMarkers from '../../data/sample-markers';

@Component({
    components: { Grid, MapView }
})
class IApp extends Vue {
    mininb: {cells: {[id: string]: any[]}} = {cells: {}}
    markers: IMapView['markers'] = sampleMarkers as any;

    gridData(data: any[]) {
        return gridData.fromObjects(data);
    }

    onMarker(ev) {
        console.log(ev);
    }

    onMapPoke(ev: MapMouseEvent) {
        this.markers['poke'] = {
            tag: {kind: 'poke'},
            at: [ev.lngLat.lng, ev.lngLat.lat]
        }
    }
}

export { IApp }
export default toNative(IApp);
</script>