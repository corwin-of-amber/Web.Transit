import _ from 'lodash';

import { GTFSDB } from './gtfs';
import { XY, dist2 } from '../infra/geom2d';

class MotGov {
    static = new GTFSDB({basedir: 'data/motgov/gtfs'})

    stopsAround(c: XY = MotGov.TLV_CENTER) {
        let all_stops = this.static.tables.stops.all().map(s =>
            ({...s, at: [+s.stop_lon, +s.stop_lat]}));
        return _.sortBy(all_stops, p => dist2(p.at, c));
    }

    static readonly TLV_CENTER: XY = [34.7818, 32.0853];
}


export { MotGov }