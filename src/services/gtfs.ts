import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { DatabaseSync } from 'node:sqlite'; /** @kremlin.native */


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

    dbs = new DatabaseSync('data/motgov/gtfs.db')

    tables: {
        agency:     BaseTable
        routes:     BaseTable
        trips:      BaseTable
        stops:      BaseTable
        stop_times: BaseTable
        shapes:     BaseTable
        calendar:   BaseTable
    }
    
    constructor(config: GTFSConfig) {
        this.config = config;

        let open = (name: string, key?: KeySpec) =>
            //BaseTable.fromFile(this, `${name}.txt`, key);
            SQLiteTable.fromDB(this, name, key);

        this.tables = {
            agency:      open('agency',   'agency_id'),
            routes:      open('routes',   'route_id'),
            trips:       open('trips',    'trip_id'),
            stops:       open('stops',    'stop_id'),
            stop_times:  open('stop_times', ['trip_id', 'stop_sequence']),
            shapes:      open('shapes',   'shape_id'),
            calendar:    open('calendar', 'service_id'),
        };
    }

    readCSV(fn: string) {
        fn = path.join(this.config.basedir, fn);
        return Papa.parse(fs.readFileSync(fn, 'utf-8'), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: Object.fromEntries(GTFSDB.NUMERIC_FIELDS.map(k => [k, true]))
        });
    }

    static readonly NUMERIC_FIELDS = ['stop_lon', 'stop_lat'];
}

class BaseTable {
    db: GTFSDB
    rows: any[]
    key: KeySpec

    _lazy: () => void = () => {}

    constructor(db: GTFSDB, data: any[], key?: KeySpec) {
        this.db = db;
        this.rows = data;
        this.key = key ?? Object.keys(data[0] ?? {})[0] ?? 'id';
    }
    
    all() {
        this._lazy();
        return this.rows;
    }

    get(id: string) {
        this._lazy();
        let k = this.key;
        if (Array.isArray(k))
            throw new Error('not implemented')
        else
            return this.all().find(t => t[k] == id);
    }

    by(column: string, value: string | number) {
        this._lazy();
        return this.all().filter(t => t[column] == value);
    }

    static fromFile(db: GTFSDB, csvFn: string, key?: KeySpec) {
        let init = new this(db, [], key);
        init._lazy = () => {
            let csv = db.readCSV(csvFn);
            init.rows = csv.data;
            init.key = key ?? csv.meta.fields?.[0];
            init._lazy = () => {};
        };
        return init;
    }
}

type GTFSConfig = {basedir: string, realtimeEndpoint?: URL};


class SQLiteTable extends BaseTable {
    name: string

    constructor(db: GTFSDB, name: string, key?: KeySpec) {
        super(db, [], key);
        this.name = name;
    }

    init() {
        let s = SCHEMA[this.name];
        if (!s) throw new Error(`no table '${this.name}' in schema`)
        this.db.dbs.exec(`CREATE TABLE ${this.name} (${s}) STRICT`);
    }

    index(column: string, named?: string) {
        named ??= `${this.name}_by_${column}`;
        this.db.dbs.exec(`CREATE INDEX IF NOT EXISTS ${named}
                          ON ${this.name}(${column})`);
    }

    all() {
        let s = this.db.dbs.prepare(`SELECT * FROM ${this.name}`);
        return [...s.iterate()];
    }

    get(id: string) {
        let k = this.key;
        if (Array.isArray(k))
            throw new Error('not implemented')
        else {
            let s = this.db.dbs.prepare(`SELECT * FROM ${this.name} WHERE ${k}=?`);
            return s.get(id);
        }
    }

    by(column: string, value: string | number) {
        let s = this.db.dbs.prepare(`SELECT * FROM ${this.name} WHERE ${column}=?`);
        return [...s.iterate(value)];
    }

    add(row: any) {
        let keys = Object.keys(row), vals = Object.values(row) as any[],
            update = keys.filter(k => k != this.key).map(k => `${k}=excluded.${k}`),
            s = this.db.dbs.prepare(`
            INSERT INTO ${this.name}(${keys}) VALUES (${keys.map(() => '?')})
            ON CONFLICT(${this.key}) DO UPDATE 
              SET ${update.join(', ')}`);

        s.run(...vals);
    }

    adds(rows: any[]) {
        for (let row of rows) this.add(row);
    }

    clear() { this.db.dbs.exec(`DELETE FROM ${this.name}`); }
    drop() { this.db.dbs.exec(`DROP TABLE ${this.name}`); }

    static fromDB(db: GTFSDB, tableName: string, key?: KeySpec) {
        return new SQLiteTable(db, tableName, key);
    }
}

type KeySpec = string | string[]


const SCHEMA = {
    agency: `
        agency_id TEXT PRIMARY KEY,
        agency_name TEXT NOT NULL,
        agency_url TEXT NOT NULL,
        agency_timezone TEXT NOT NULL,
        agency_lang TEXT,
        agency_phone TEXT,
        agency_fare_url TEXT`,

    stops: `
        stop_id TEXT PRIMARY KEY,
        stop_code TEXT,
        stop_name TEXT NOT NULL,
        stop_desc TEXT,
        stop_lat REAL NOT NULL,
        stop_lon REAL NOT NULL,
        zone_id TEXT,
        stop_url TEXT,
        location_type INTEGER DEFAULT 0,
        parent_station TEXT REFERENCES stops(stop_id),
        wheelchair_boarding INTEGER DEFAULT 0`,

    routes: `
        route_id TEXT PRIMARY KEY,
        agency_id TEXT REFERENCES agency(agency_id),
        route_short_name TEXT NOT NULL,
        route_long_name TEXT NOT NULL,
        route_desc TEXT,
        route_type INTEGER NOT NULL,
        route_url TEXT,
        route_color TEXT,
        route_text_color TEXT`,

    trips: `
        route_id TEXT NOT NULL REFERENCES routes(route_id),
        service_id TEXT NOT NULL REFERENCES calendar(service_id),
        trip_id TEXT PRIMARY KEY,
        trip_headsign TEXT,
        trip_short_name TEXT,
        direction_id INTEGER,
        block_id TEXT,
        shape_id TEXT,
        wheelchair_accessible INTEGER DEFAULT 0`,

    stop_times: `
        trip_id TEXT NOT NULL REFERENCES trips(trip_id),
        arrival_time TEXT NOT NULL,   -- Stored as HH:MM:SS TEXT
        departure_time TEXT NOT NULL, -- Stored as HH:MM:SS TEXT
        stop_id TEXT NOT NULL REFERENCES stops(stop_id),
        stop_sequence INTEGER NOT NULL,
        stop_headsign TEXT,
        pickup_type INTEGER DEFAULT 0,
        drop_off_type INTEGER DEFAULT 0,
        shape_dist_traveled REAL,
        timepoint INTEGER,
        PRIMARY KEY (trip_id, stop_sequence)`,

    shapes: `
        shape_id TEXT NOT NULL,
        shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL,
        shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL,
        PRIMARY KEY (shape_id, shape_pt_sequence)`,

    calendar: `
        service_id TEXT PRIMARY KEY,
        monday INTEGER NOT NULL,
        tuesday INTEGER NOT NULL,
        wednesday INTEGER NOT NULL,
        thursday INTEGER NOT NULL,
        friday INTEGER NOT NULL,
        saturday INTEGER NOT NULL,
        sunday INTEGER NOT NULL,
        start_date TEXT NOT NULL,  -- Stored as YYYYMMDD TEXT
        end_date TEXT NOT NULL     -- Stored as YYYYMMDD TEXT
        `

}

const INDEXES = {
    stop_times: `CREATE INDEX IF NOT EXISTS stop_times_by_stop_id ON stop_times(stop_id)`
}

export { GTFS, GTFSDB, GTFSConfig }