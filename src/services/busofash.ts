import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

import type { transit_realtime as rt } from 'gtfs-realtime-bindings';


type GTFSConfig = {basedir: string, realtimeEndpoint: URL};

class GTFS {
    config: GTFSConfig

    static: {trips: any[], routes: any[]}
    visit = new Visitor(this)
    
    constructor(config: GTFSConfig) {
        this.config = config
        this.static = Object.fromEntries(
            ['trips', 'routes'].map(k =>
                [k, this.getCSV(`${k}.txt`)])) as any;
    }

    getCSV(fn: string) {
        fn = path.join(this.config.basedir, fn);
        return Papa.parse(fs.readFileSync(fn, 'utf-8'), {header: true}).data;
    }

    tripById(id: string) {
        return this.static.trips.find(t => t.trip_id == id);
    }

    routeById(id: string) {
        return this.static.routes.find(r => r.route_id == id);
    }
    
    async fetchRT() {
        const gtfsrt = require("gtfs-realtime-bindings");
        return gtfsrt.transit_realtime.FeedMessage.decode(new global.Uint8Array(
            await this.fetchRTBuffer()));
    }
    
    async fetchRTBuffer() {
        let resp = await fetch(this.config.realtimeEndpoint, {
            headers: {
                'authorization': 'tlv_848e1b42-c0c2',
                'cache-control': 'no-cache'
            }
        });

        if (resp.status === 200)
            return resp.arrayBuffer();
        else
            throw new Error(`[gtfs] api error ${resp.status} ${resp.statusText}`);
    }
}

class Visitor {
    o: GTFS

    constructor(o: GTFS) { this.o = o; }
    
    message(e: rt.IFeedMessage) {
        for (let en of e.entity)
            this.entity(en);
        return e;
    }

    entity(e: rt.IFeedEntity & aux.FeedEntity) {
        if (e.tripUpdate) this.tripUpdate(e.tripUpdate);
        return e;
    }

    tripUpdate(e: rt.ITripUpdate & aux.TripUpdate) {
        this.tripDescriptor(e.trip);
    }

    tripDescriptor(e: rt.ITripDescriptor & aux.TripDescriptor) {
        e.ref = this.o.tripById(e.tripId);
        if (e.ref) {
            e.ref.route = this.o.routeById(e.ref.route_id);
        }
    }
}

/* additional properties for GTFS-RT object types */
namespace aux {
    export type TripDescriptor = {ref?: any}
    export type TripUpdate = {trip: TripDescriptor}
    export type FeedEntity = {tripUpdate?: TripUpdate}
}


class Busofash extends GTFS {
    staticDataURI = new URL('https://opendatasource.tel-aviv.gov.il/OpenData_Ducaments/gtfs.zip')

    constructor() {
        super({
            basedir: 'data/busofash/gtfs',
            realtimeEndpoint: new URL('https://api.busnear.by/external/gtfsrt/export')
        });
    }

    async refreshStatic() {
        /** @todo download and unzip */
        await fetch(this.staticDataURI);
    }
}


export { Busofash, GTFS }