<template>
    <div class="tabular"
            :style="{'--ncolumns': width, '--nrows': computedHeight}"
            @mousedown="selectCell">
        <GridRows :rows="data"></GridRows>
        <div v-if="sel" class="selection"
            :style="{'--rowstart': sel.row, '--colstart': sel.col}"></div>
    </div>
</template>

<style lang="scss">
div.tabular {
    --ncolumns: 10;
    display: grid;
    width: fit-content;
    grid-template-columns: repeat(var(--ncolumns), auto);
    gap: 1px;
    padding: 1px;
    background-color: #333;

    > div {
        font-family: var(--normal-font);
        font-size: 80%;
        background-color: white;
        padding: 2px;
        grid-row: var(--rowstart) / span var(--rowspan, 1);
    }

    div.url {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    div.selection {
        grid-row: var(--rowstart);
        grid-column: var(--colstart);
        outline: 3px solid rgb(128, 128, 255);
        background: none;
        pointer-events: none;
    }
}
</style>

<script lang="ts">
import _ from 'lodash';
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import GridRows from './rows.vue';

@Component({
    name: "Grid",
    components: { GridRows }
})
class ITabular extends Vue {
    @Prop({default: []})
    data: Cell[][]
    
    sel: RowCol = undefined

    get width() {
        return _.max(this.data.map(r => r.length)) ?? 0;
    }

    get computedHeight() {
        return this.height(this.data);
    }

    height(rows: Cell[][]) {
        return _.sum(rows.map(row => {
            let max = _.max(row.map(cell => {
                if (cell.subrows) return this.height(cell.subrows);
                else return 1;
            }));
            for (let cell of row) {
                cell.rowspan = max;
            }
            return max;
        }));
    }

    selectCell(ev: MouseEvent) {
        let cst = getComputedStyle(ev.target as Element);
        this.sel = {row: +cst.gridRowStart, col: +cst.gridColumnStart};
    }
}

type Cell = {
    text?: string
    subrows?: Cell[][]

    class?: string | string[]
    rowspan?: number
}
//({text: string, class?: string | string[]} |
// {subrows: string[]}) & {rowspan?: number}

type RowCol = {row: number, col: number}


export { ITabular, Cell, RowCol }
export default toNative(ITabular)
</script>