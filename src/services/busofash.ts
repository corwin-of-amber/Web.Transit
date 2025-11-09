import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { GTFS as GTFSBase } from './gtfs';

import type { transit_realtime as rt } from 'gtfs-realtime-bindings';


class GTFS extends GTFSBase {
    visit = new Visitor(this)
    
    getCSV(fn: string) {
        fn = path.join(this.config.basedir, fn);
        return Papa.parse(fs.readFileSync(fn, 'utf-8'), {header: true}).data;
    }

    tripById(id: string) {
        return this.static.tables.trips.all().find(t => t.trip_id == id);
    }

    routeById(id: string) {
        return this.static.tables.routes.all().find(r => r.route_id == id);
    }
    
    async fetchRT() {
        const gtfsrt = require("gtfs-realtime-bindings");
        let data = new global.Uint8Array(await this.fetchRTBuffer()),
            feed = gtfsrt.transit_realtime.FeedMessage.decode(data);

        this.visit.message(feed);
        return feed;
    }
    
    getVehicleMarkers(feed: aux.FeedMessage & rt.IFeedMessage) {
        return Object.fromEntries((feed.entity ?? [])
            .flatMap(({vehicle: e, tripUpdate: tu}) => 
                e ? [[e.vehicle.id, {at: this._lnglat(e.position), 
                                     tag: {route: tu.trip.ref.route}}]]
                  : []
            )
        );
    }

    _lnglat(pos: rt.IPosition) {
        return [pos.longitude, pos.latitude];
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

    translateTripUpdate(tu: rt.ITripUpdate & aux.TripUpdate) {
        let stop_times = this.static.tables.stop_times.all().filter(e => e.trip_id === tu.trip.tripId),
            seq = tu.stopTimeUpdate.map(e => {
                let stopt = stop_times.find(s => s.stop_sequence == e.stopSequence),
                    stop = this.static.tables.stops.all().find(s => s.stop_id === stopt.stop_id);
                return [stop, this.visit.date(e.arrival as any)];
            });
        return {trip: tu.trip.ref, seq};
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

    /**
     * @note arrival/departure are represetned by `{time: Long | number}`
     *   in the standard, but `Long` may be stored as a string instead.
     */
    date(e: {time: string | number}) {
        return new Date(+e.time * 1e3);
    }
}

/* additional properties for GTFS-RT object types */
namespace aux {
    export type TripDescriptor = {ref?: any}
    export type TripUpdate = {trip: TripDescriptor}
    export type FeedEntity = {tripUpdate?: TripUpdate}
    export type FeedMessage = {entity: (rt.IFeedEntity & FeedEntity)[]}
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