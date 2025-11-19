import _ from 'lodash';
import { flatmap, imap } from 'itertools';
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
    labels: NestedMap<string>

    constructor(labels?: HierarchicalHeader['labels']) {
        this.labels = labels ?? new Map;
    }

    fromKeyPaths(keypaths: Iterable<string[]>) {
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

    forObjects(objs: object[]) {
        return this.fromKeyPaths(flatmap(objs, o =>
            flattenObjectEntries(o).map(([k, v]) => k)));
    }

    sub(kp: string[]) {
        let h = this.labels;
        for (let k of kp) h = h?.get(k);
        if (!h) throw new Error(`no subheader: '${kp}'`)
        return new HierarchicalHeader(h);
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

    *traverse(obj: any) {
        yield* aux(obj, this.labels);

        function *aux(obj: any, h: NestedMap<string>, pfx: string[] = []) {
            if (h.size === 0 || Array.isArray(obj)) yield [pfx, obj]
            else {
                for (let [k, v] of h.entries()) {
                    yield* aux(obj?.[k], v, [...pfx, k]);
                }
            }
        }
    }
}

type NestedMap<T> = Map<string, NestedMap<T>>;



function fromObjects(objs: object[]) {

    let header = new HierarchicalHeader().forObjects(objs);

    function subrows(objs: any[], header: HierarchicalHeader) {
        return objs.map(row => [...header.traverse(row)].map(([kp, v]) =>
            Array.isArray(v) ? {subrows: subrows(v, header.sub(kp))}
                             : {text: v ?? ''}));
    }

    return [
        ...header.gridify().d,
        ...subrows(objs, header)
    ];
}

function flattenObject(o: object) {
    return Object.fromEntries(flattenObjectEntries(o));
}

function flattenObjectEntries(o: object) {
    return [...iflattenObjectEntries(o)];
}

function *iflattenObjectEntries(o: object) {
    if (Array.isArray(o)) {
        for (let el of o) {
            yield* typeof el === 'object' ?
                iflattenObjectEntries(el) : [[[], el]];
        }
    }
    else {
        if (typeof o['_'] === 'object') o = o['_'];
        yield* flatmap(Object.entries(o), ([k ,v]) =>
            typeof v === 'object' && v !== null ?
                imap(iflattenObjectEntries(v), ([subk, subv]) => [[k, ...subk], subv])
              : [[[k], v]]
        );
    }
}

export { Gridlet, HierarchicalHeader, 
         fromObjects, flattenObject, flattenObjectEntries }