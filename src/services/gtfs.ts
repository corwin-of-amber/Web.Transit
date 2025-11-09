import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';


class GTFS {
    config: GTFSConfig
    static: GTFSDB

    constructor(config: GTFSConfig) {
        this.config = config;
        this.static = new GTFSDB(config);
    }
}


class GTFSDB {
    config: GTFSConfig

    tables: {trips: BaseTable, routes: BaseTable, stops: BaseTable, stop_times: BaseTable}
    
    constructor(config: GTFSConfig) {
        this.config = config;
        this.tables = Object.fromEntries(
            ['trips', 'routes', 'stops', 'stop_times', 'shapes'].map(k =>
                [k, BaseTable.fromFile(this, `${k}.txt`)])) as any;
    }

    getCSV(fn: string) {
        fn = path.join(this.config.basedir, fn);
        return Papa.parse(fs.readFileSync(fn, 'utf-8'), {header: true});
    }
}

class BaseTable {
    db: GTFSDB
    rows: any[]
    key: string

    _lazy: () => void = () => {}

    constructor(db: GTFSDB, data: any[], key?: string) {
        this.db = db;
        this.rows = data;
        this.key = key ?? Object.keys(data[0] ?? {})[0];
    }
    
    all() {
        this._lazy();
        return this.rows;
    }

    get(id: string) {
        this._lazy();
        let k = this.key;
        return this.rows.find(t => t[k] == id);
    }

    static fromFile(db: GTFSDB, csvFn: string) {
        let init = new this(db, [], 'id');
        init._lazy = () => {
            let csv = db.getCSV(csvFn);
            init.rows = csv.data;
            init.key = csv.meta.fields?.[0];
            init._lazy = () => {};
        };
        return init;
    }
}

type GTFSConfig = {basedir: string, realtimeEndpoint?: URL};


export { GTFS, GTFSDB, GTFSConfig }