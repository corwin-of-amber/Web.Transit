import fs from 'fs';
import path from 'path';
import Papa, { ParseResult } from 'papaparse';
import { Readable } from 'node:stream'; /** @kremlin.native */
import { ReadableStream } from 'node:stream/web'; /** @kremlin.native */
import { DatabaseSync } from 'node:sqlite'; /** @kremlin.native */

import * as fflate from 'fflate';


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

    dbs: DatabaseSync

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
        this.dbs = new DatabaseSync(path.join(config.basedir, 'gtfs.db'))

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

    init() {
        for (let tbl of Object.values(this.tables))
            (tbl as SQLiteTable).init?.();
    }

    async downloadCSVs() {
        let resp = await fetch(this.config.gtfsURI);
        for await (let fl of streamUnzip(resp.body as ReadableStream<Uint8Array>)) {
            let fn = path.join(this.config.basedir, fl.file.name);
            Readable.fromWeb(fl.stream).pipe(fs.createWriteStream(fn));
        }
    }

    async importFromCSVs() {
        console.log('[import] agency');
        this.tables.agency.adds((await this.readCSV('agency.txt')).data)
        console.log('[import] calendar');
        this.tables.calendar.adds((await this.readCSV('calendar.txt')).data)
        console.log('[import] routes');
        this.tables.routes.adds((await this.readCSV('routes.txt')).data)
        console.log('[import] trips');
        this.tables.trips.adds((await this.readCSV('trips.txt')).data
             .map(r => { r.wheelchair_accessible |= 0; return r }))
        console.log('[import] stops');
        this.tables.stops.adds((await this.readCSV('stops.txt')).data
            .map(r => { delete r.parent_station; return r }))

        /* this is a bit slow to do in JS?
        console.log('[import] stop_times');
        this.tables.stop_times.adds((await this.readCSV('stop_times.txt')).data
            .map(r => { r.shape_dist_traveled |= 0; return r }))
        */
    }

    async readCSV<RowType = any>(fn: string) {
        fn = path.join(this.config.basedir, fn);
        return new Promise<ParseResult<RowType>>(resolve => Papa.parse<RowType>(fs.createReadStream(fn), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: Object.fromEntries(GTFSDB.NUMERIC_FIELDS.map(k => [k, true])),
            complete: (results, file) => resolve(results)
        }));
    }

    static readonly NUMERIC_FIELDS = ['stop_lon', 'stop_lat'];
}


async function* streamUnzip(stream: ReadableStream<Uint8Array>) {

    const unzipper = new fflate.Unzip();
    unzipper.register(fflate.UnzipInflate);

    let queue = [] as UnzipFileWithStream[];

    unzipper.onfile = (file) => {
        console.log(`${file.name}: Started extracting`);
        queue.push(new UnzipFileWithStream(file));
    };
  
    for await (let chunk of streamConsume(stream)) {
        unzipper.push(chunk);
        yield *queue.splice(0);
    }
}


class UnzipFileWithStream {
    file: fflate.UnzipFile
    stream: ReadableStream<Uint8Array>

    constructor(file: fflate.UnzipFile) {
        this.file = file;
        this.stream = new ReadableStream({
            start: (controller) => {
                let bytes = 0;
                file.ondata = (err, data, final) => {
                    if (err) {
                        controller.error(err);
                    } else {
                        this.progress(bytes += data.length);

                        controller.enqueue(data);
                        if (final) controller.close();
                    }
                };
                file.start();
            },
            cancel() {
                file.terminate();
            }
        });
    }

    progress(bytes: number, final: boolean = false) {
        console.log(`${this.file.name}: received ${bytes} bytes out of ${this.file.originalSize}`);
        if (final) console.log(`${this.file.name}: Finished extracting`);
    }
}

async function* streamConsume<T>(stream: ReadableStream<T>) {
    let reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
    }
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

    add(row: any) {
        this.rows.push(row);
    }

    adds(rows: any[]) {
        let n = rows.length, i = 0;
        if (n > 1e4) console.log(`adding ${n} rows`)
        for (let row of rows) {
            i += 1;
            this.add(row);
            if ((i & 0x3ff) === 0)
                console.log(`added ${i} rows`);
        }
    }

    static fromFile(db: GTFSDB, csvFn: string, key?: KeySpec) {
        let init = new this(db, [], key);
        /** @todo this won't work when readCSV is async */
        init._lazy = async () => {
            let csv = await db.readCSV(csvFn);
            init.rows = csv.data;
            init.key = key ?? csv.meta.fields?.[0];
            init._lazy = () => {};
        };
        return init;
    }
}

type GTFSConfig = {
    basedir: string,
    gtfsURI?: URL
    realtimeEndpoint?: URL
};


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

    clear() { this.db.dbs.exec(`DELETE FROM ${this.name}`); }
    drop() { this.db.dbs.exec(`DROP TABLE ${this.name}`); }

    static fromDB(db: GTFSDB, tableName: string, key?: KeySpec) {
        return new SQLiteTable(db, tableName, key);
    }
}

type KeySpec = string | string[]

const NUM_ID = 'INTEGER', STR_ID = 'TEXT';

const SCHEMA = {
    agency: `
        agency_id ${NUM_ID} PRIMARY KEY,
        agency_name TEXT NOT NULL,
        agency_url TEXT NOT NULL,
        agency_timezone TEXT NOT NULL,
        agency_lang TEXT,
        agency_phone TEXT,
        agency_fare_url TEXT`,

    stops: `
        stop_id ${NUM_ID} PRIMARY KEY,
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
        route_id ${NUM_ID} PRIMARY KEY,
        agency_id ${NUM_ID} REFERENCES agency(agency_id),
        route_short_name TEXT NOT NULL,
        route_long_name TEXT NOT NULL,
        route_desc TEXT,
        route_type INTEGER NOT NULL,
        route_url TEXT,
        route_color TEXT,
        route_text_color TEXT`,

    trips: `
        route_id ${NUM_ID} NOT NULL REFERENCES routes(route_id),
        service_id ${NUM_ID} NOT NULL REFERENCES calendar(service_id),
        trip_id ${STR_ID} PRIMARY KEY,
        trip_headsign TEXT,
        trip_short_name TEXT,
        direction_id INTEGER,
        block_id TEXT,
        shape_id TEXT,
        wheelchair_accessible INTEGER DEFAULT 0`,

    stop_times: `
        trip_id ${STR_ID} NOT NULL REFERENCES trips(trip_id),
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
        shape_id ${NUM_ID} NOT NULL,
        shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL,
        shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL,
        PRIMARY KEY (shape_id, shape_pt_sequence)`,


    calendar: `
        service_id ${NUM_ID} PRIMARY KEY,
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