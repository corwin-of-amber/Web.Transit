import _ from 'lodash';
import { Cell } from './index.vue';


class Gridlet {
    d: Cell[][]
    
    constructor(cellData: Cell[][] = []) {
        this.d = cellData;
    }

    get height() {
        return _.sum(this.d.map(r => this.rowHeight(r)));
    }

    get width() {
        return this.rowWidth(this.d[0] ?? []);
    }

    rowHeight(row: Cell[]) {
        return row[0]?.rowspan ?? 1;
    }

    rowWidth(row: Cell[]) {
        return _.sum(row.map(c => c.colspan ?? 1));
    }

    happend(subgrid: Gridlet) {
        let w = this.width, subh = subgrid.height, subw = subgrid.width;
        while (this.height < subh) {
            this.d.push(this._hfill(w));
        }
        /** @todo this is inconsistent if subrows exist */
        for (let i = 0; i < subgrid.d.length; ++i)
            this.d[i] = this.d[i].concat(subgrid.d[i]);
        for (let i = subgrid.d.length; i < this.d.length; ++i)
            this.d[i].push(...this._hfill(subw));
    }

    _hfill(width: number): Cell[] {
        return width > 0 ? [{text: '', colspan: width}] : [];
    }
}


class HierarchicalHeader {
    labels: NestedMap<string> = new Map

    fromKeyPaths(keypaths: string[][]) {
        for (let key of keypaths) {
            let hm = this.labels;
            for (let el of key) {
                let sub = hm.get(el) ?? new Map();
                hm.set(el, sub);
                hm = sub;
            }
        }
        return this;
    }

    gridify() {
        return aux(this.labels);

        function aux(h: NestedMap<string>): Gridlet {
            let grid = new Gridlet();

            for (let [k, v] of h.entries()) {
                let subgrid = aux(v);
                subgrid.d.unshift([{text: k, colspan: subgrid.width || 1}]);
                grid.happend(subgrid);
            }

            return grid;
        }
    }
}

type NestedMap<T> = Map<string, NestedMap<T>>;



function fromObjects(objs: object[]) {
    let header = new HierarchicalHeader().fromKeyPaths(
        objs.flatMap(o =>
            flattenObjectEntries(o).map(([k, v]) => k)));

    console.log(header.gridify());

    objs = objs.map(flattenObject); /** @todo make optional */


    let proto = Object.fromEntries(objs.flatMap(o => Object.entries(o))),
        keys = Object.keys(proto);
    return [...header.gridify().d,
        ...objs.map(row => keys.map(k => ({text: row[k] ?? ''})))];
}

function flattenObject(o: object) {
    return Object.fromEntries(flattenObjectEntries(o));
}

function flattenObjectEntries(o: object) {
    if (typeof o['_'] === 'object') o = o['_'];
    return Object.entries(o).flatMap(([k ,v]) =>
        typeof v === 'object' && v !== null && !Array.isArray(v) ?
            flattenObjectEntries(v).map(([subk, subv]) => [[k, ...subk], subv])
           : [[[k], v]]
    );
}

export { Gridlet, HierarchicalHeader, 
         fromObjects, flattenObject, flattenObjectEntries }