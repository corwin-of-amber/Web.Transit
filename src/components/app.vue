<template>
    <div>
        <Grid :data="gridData"></Grid>
        <MapView></MapView>
    </div>
</template>

<script lang="ts">
import { Vue, Component, toNative } from 'vue-facing-decorator';
import Grid, { data }  from './grid';
import MapView from './map-view/index.vue';
import * as gridData from './grid/data';

@Component({
    components: { Grid, MapView }
})
class IApp extends Vue {
    data = [{a: 5, b: 5, c: 9}]

    get gridData() {
        return gridData.fromObjects(this.data);
    }
}

export default toNative(IApp);
</script>