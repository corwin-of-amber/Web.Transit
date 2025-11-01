<template>
    <div ref='map' style='width: 750px; height: 500px;'></div>
</template>

<script>
import { map2 } from './libre';


export default {
    mounted() {
        map2(this.$refs.map);
    }
}

</script>