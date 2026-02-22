import fs from 'fs';
import _ from 'lodash';

import { GTFSDB } from './gtfs';
import { XY, dist2 } from '../infra/geom2d';


class MotGov {
    static = new GTFSDB({basedir: 'data/motgov/gtfs', gtfsURI: new URL('https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip')})

    options = {
        reqTimeout: 3000 /* ms */
    }

    stopsAround(c: XY = MotGov.TLV_CENTER) {
        let all_stops = this.static.tables.stops.all().map(s =>
            ({at: [s.stop_lon, s.stop_lat] as XY, tag: {stop: s}}));
        return _.sortBy(all_stops, p => dist2(p.at, c));
    }

    async get(args: {[name: string]: string | number}, format: 'json' | 'xml' = 'json'): Promise<object> {
        let s = this.secrets,
            url = new URL(format, new URL(s.endpoint));
        url.searchParams.set('Key', s.apikey);
        for (let [k, v] of Object.entries(args))
            url.searchParams.set(k, `${v}`);

        console.log('> ', url.toString());
        let resp = await fetch(url, {
            signal: AbortSignal.timeout(this.options.reqTimeout)
        });

        if (resp.status === 200)
            return resp.json();
        else
            throw new Error(`api call failed (${resp.status} ${resp.statusText})`)
    }

    async getRealtime(stop: StopCode) {
        let resp = await this.get({MonitoringRef: stop});
        for (let delivery of resp['Siri']?.ServiceDelivery?.StopMonitoringDelivery ?? []) {
            if (delivery.ErrorCondition) throw delivery.ErrorCondition;
            if (delivery.MonitoredStopVisit) return delivery.MonitoredStopVisit;
        }
        throw new Error('bad response from SIRI-SM');
    }

    getVehicleMarkers(msv: MonitoredStopVisit[] = []) {
        return Object.fromEntries(msv.flatMap(({MonitoredVehicleJourney: e}) =>
            e.VehicleLocation ?
                [[e.VehicleRef, {at: this._lnglat(e.VehicleLocation), 
                                tag: {route: {route_short_name: e.PublishedLineName}}}]] : []));
    }

    getArrivals(msv: MonitoredStopVisit[] = []) {
        let now = +new Date();
        return msv.map(({MonitoredVehicleJourney: e}) => {
            let eta = new Date(e.MonitoredCall.ExpectedArrivalTime);
            return {
                line: e.PublishedLineName,
                when: eta,
                mins: (+eta - now) / 60e3
            }
        });
    }

    _lnglat(ll: SiriLngLat) {
        return [ll.Longitude, ll.Latitude] as [number, number];
    }

    get secrets() {
        return JSON.parse(fs.readFileSync('data/motgov/secrets.json', 'utf-8'));
    }

    static readonly TLV_CENTER: XY = [34.7818, 32.0853];
}


type StopCode = string
type Id = number

interface MonitoredStopVisit {
    RecordedAtTime: any
    ItemIdentifier: Id
    MonitoringRef: Id
    MonitoredVehicleJourney: {
        LineRef: Id
        DirectionRef: number
        FramedVehicleJourneyRef: {}[]
        PublishedLineName: string
        OperatorRef: Id
        DestinationRef: Id
        OriginAimedDepartureTime: any
        ConfidenceLevel: string
        VehicleLocation: SiriLngLat
        Bearing: number
        Velocity: number
        VehicleRef: Id
        MonitoredCall: {
            StopPointRef: Id
            Order: number
            ExpectedArrivalTime: any
            DistanceFromStop: number
            AimedArrivalTime: any
        }
    }
}

type SiriLngLat = {Longitude: number, Latitude: number}


export { MotGov }