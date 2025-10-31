<template>
    <template v-for="row, i in rows">
        <template v-for="component, j in row">
            <div v-if="component.text !== undefined" v-text="component.text"
                :class="classFor(component, i, j)"
                :style="styleFor(component, i, j)"></div>
            <template v-if="component.subrows">
                <GridRows :rows="component.subrows"
                          :startPos="{row: startPos.row + startHeight(i), 
                                      col: startPos.col + j}"></GridRows>
            </template>
        </template>
    </template>
</template>

<script lang="ts">
import _ from 'lodash';
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';

import type { Cell }  from './index.vue';


@Component({name: 'GridRows'})
class IGridRows extends Vue {
    @Prop rows: any[][]
    @Prop({default: {row: 0, col: 0}})
    startPos: {row: number, col: number}

    classFor(cell: Cell, row: number, col: number) {
        let base = Array.isArray(cell.class)
        ? cell.class : cell.class ? [cell.class] : [];
        return base;
    }

    styleFor(cell: Cell, row: number, col: number) {
        return {'--rowspan': cell.rowspan,
                '--rowstart': 1 + this.startPos.row + this.startHeight(row),
                'grid-column': 1 + this.startPos.col + col}
    }

    startHeight(row: number) {
        return _.sum(this.rows.slice(0, row).map(row =>
            row[0]?.rowspan ?? 1))
    }
}

export default toNative(IGridRows);
</script>