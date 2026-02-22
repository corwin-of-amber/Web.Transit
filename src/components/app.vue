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
import MapView, { IMapView, Tag } from './map-view/index.vue';
import { XY } from '../infra/geom2d';

import sampleMarkers from '../../data/sample-markers';

@Component({
    components: { Grid, MapView }
})
class IApp extends Vue {
    mininb: {cells: {[id: string]: any[]}} = {cells: {}}
    markers: IMapView['markers'] = sampleMarkers as any;

    gridData(data: any[]) {
        if (!Array.isArray(data))
            data = Object.entries(data).map(([k, v]) => ({k, v}));
        return gridData.fromObjects(data);
    }

    onMarker(ev) {
        let m = ev.marker;
        if (m.tag?.stop) {
            this.markers['selected'] =
                this.mark('stop/selected', m.at, {stop: m.tag.stop});
        }
    }

    onMapPoke(ev: MapMouseEvent) {
        this.markers['poke'] =
            this.mark('poke', [ev.lngLat.lng, ev.lngLat.lat]);
    }

    mark(kind: string, at: XY, props: Partial<Tag> = {}) {
        return {tag: {kind, ...props}, at};
    }
}

export { IApp }
export default toNative(IApp);
</script>