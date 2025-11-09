import { DatabaseSync } from 'node:sqlite'; /** @kremlin.native */


class BusGovAPI {

    baseURI = new URL('https://bus.gov.il/WebApi/api/passengerinfo/')
    suffix = ['he', 'false']  // trailing parameters for all API calls

    get(func: 'getDateList'): Promise<any[]>
    get(func: 'getCityList'): Promise<{ID: number, NAME: string}[]>
    get(func: 'GetBusLineListByYeshuv', city: number, day: number): Promise<BusGovAPI.LineProps[]>
    get(func: 'GetBusStopByMakat', stop: number): Promise<any>
    get(func: 'GetRealtimeBusLineListByBustop', stop: number): Promise<BusGovAPI.RealtimeEntryProps[]>
    get(func: 'GetScheduleList', day: number, fromPlace: number, reserved0: 0, reserved1: 0, toPlace: number, line: number): Promise<any[]>

    async get(func: string, ...args: (string | number)[]): Promise<any> {
        let path = [func, ...args, ...this.suffix].join('/'),
            resp = await fetch(new URL(path, this.baseURI));

        if (resp.status === 200)
            return resp.json();
        else
            throw new Error(`api call failed (${resp.status} ${resp.statusText})`)
    }

    post(func: 'GetBusStopList', body: BusGovAPI.StopListProps): Promise<BusGovAPI.StopProps[]>

    async post(func: string, body: any): Promise<any[]> {
        let path = func,
            resp = await fetch(new URL(path, this.baseURI), {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json;charset=utf-8",
                },
                referrer: this.baseURI.origin,
                body: JSON.stringify(body)
            });

        if (resp.status === 200)
            return resp.json();
        else
            throw new Error(`api call failed (${resp.status} ${resp.statusText})`)
    }

    static DATE_FMT = Intl.DateTimeFormat('en-IL',
        {year: 'numeric', month: '2-digit', day: '2-digit'});
}

class BusGovDB {
    owner: BusGov
    db = new DatabaseSync('data/busgov/static.db')
    lines = new BaseTable(this.db, 'lines').withCtor(_ => new Line(this.owner, _ as any));
    stops = new BaseTable(this.db, 'stops').withCtor(_ => new Stop(this.owner, _ as any));

    constructor(owner: BusGov) {
        this.owner = owner;
    }

    init() {
        this.lines.init();
        this.stops.init();
    }
}

class BaseTable<Obj extends {_: IdName}> {
    db: DatabaseSync
    name: string
    ctor: (rec: object) => Obj

    constructor(db: DatabaseSync, name: string) {
        this.db = db;
        this.name = name;
        this.ctor = x => x as Obj;
    }

    withCtor(ctor: (rec: object) => Obj) {
        this.ctor = ctor; return this;
    }

    init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ${this.name} 
            (id INT PRIMARY KEY, name TEXT, json TEXT) STRICT`);
    }

    all() {
        let s = this.db.prepare(`SELECT json FROM lines`);

        return [...s.iterate()].map(({json}) => this.ctor(JSON.parse(json as string)));
    }

    get(id: number) {
        let s = this.db.prepare(`SELECT json FROM lines WHERE id=?`),
            rec = s.get(id);

        return rec && this.ctor(JSON.parse(rec.json as string));
    }

    add(obj: Obj) {
        let s = this.db.prepare(`
            INSERT INTO ${this.name}(id,name,json) VALUES (?,?,?)
            ON CONFLICT(id) DO UPDATE 
              SET name=excluded.name, json=excluded.json`);
        s.run(obj._.id, obj._.name, JSON.stringify(obj._));
    }
}

class BusGov {
    api = new BusGovAPI
    db = new BusGovDB(this)

    async days() {
        return (await this.api.get('getDateList'))
            .map(d => new Day(this, {id: d.ID, name: d.NAME}, d));
    }

    async cities() {
        return (await this.api.get('getCityList'))
            .map(c => new City(this, {id: c.ID, name: c.NAME}, c));
    }

    async defaultDay() {
        return this.today();
    }

    today() {
        return new Day(this, {id: 1,
            name: BusGovAPI.DATE_FMT.format(new Date())});
    }

    stop(id: number) {
        return new Stop(this, {id, name: '?'});
    }

    TLV = new City(this, {id: 5000, name: 'תל אביב'})
}


class EntityBase<Props extends {}> {
    owner: BusGov
    _: Props
    _src: any
    constructor(owner: BusGov, props: Props, src?: any) {
        this.owner = owner;
        this._ = props;
        this._src = src;
    }
}

export class Day extends EntityBase<IdName> { }

export class City extends EntityBase<IdName> {
    async lines(day?: Day) {
        let o = this.owner;

        day ??= await o.defaultDay();
        return (await o.api.get(
                'GetBusLineListByYeshuv', this._.id, day?._.id))
            .map(e => new Line(o, {
                id: e.ID, name: e.NAME,
                company: {id: e.CompanyId, name: e.CompanyName}
            }, e));
    }
}

export class Line extends EntityBase<IdName & {company: IdName}> {
    async routes() {
        /** @todo may not be the most general and does not cover variants */
        return Promise.all([1, 2].map(dir => this.route(dir)));
    }

    async route(dir = 1) {
        let id = this._.id * 10 + dir;
        return new Route(this.owner, {id, line: this, dir});
    }
}

export class Route extends EntityBase<{id: number, line: Line, dir: number, variant?: string}> {
    async stops(day?: Day) {
        let o = this.owner;

        day ??= await o.defaultDay();
        return (await this.owner.api.post('GetBusStopList', {
            DayOrder: day._.id,
            DateOrder: day._.name,
            LineNumberId: this._.line._.id,
            Makat: this._.id,
            Chalufa: this._.variant ?? "0"
        })).map(e => new Stop(o, {
            id: e.Makat,
            name: e.HebrewName ?? e.Name ?? e.EnglishName
        }, e));
    }
}

export class Stop extends EntityBase<IdName> {
    async realtimes() {
        let o = this.owner;

        return (await o.api.get(
                'GetRealtimeBusLineListByBustop', this._.id))
            .map(e => ({
                route: new Route(o, {
                    id: e.ID,
                    line: new Line(o, {
                        id: Math.floor(e.ID / 10),
                        name: e.Shilut,
                        company: {
                            id: e.CompanyId,
                            name: e.CompanyHebrewName ?? e.CompanyName ?? e.CompanyEnglishName
                        }
                    }, e),
                    dir: e.MotDirection,
                    variant: e.MotVariation
                }, e),
                minutes: e.MinutesToArrivalList,
                dist: {start: e.DistanceFromStart, stop: e.Distance},
                _src: e
            }));
    }
}

export type IdName = {id: number, name: string}


namespace BusGovAPI {
    export type LineProps = typeof LINE;
    export type StopProps = typeof STOP;
    export type StopListProps = typeof STOP_LIST_REQ;
    export type RealtimeEntryProps = typeof REALTIME_ENTRY;

    const LINE = {
        "ID": 51831,
        "NAME": "30",
        "CompanyId": 13,
        "CompanyName": "סופרבוס",
        "Direction": null,
        "SourceName": "טבריה תחנה מרכזית",
        "DestinationName": "עפולה תחנה מרכזית",
        "DestinationEngName": null,
        "CompanyEnglishName": null,
        "Chalufa": null,
        "Description": null,
        "Distance": 0,
        "DistanceFromStart": 0,
        "TripsPerDay": 0,
        "CompanyHebrewName": null,
        "BusstopHebrewName": null,
        "BusstopType": null,
        "DestinationQuarterId": null,
        "Shilut": null,
        "DestinationQuarterName": null,
        "MinutesToArrival": 0,
        "MinutesToArrivalList": null,
        "Remark": null,
        "DtArrival": "0001-01-01T00:00:00",
        "ResponseSuccesed": false,
        "DestinationMakat": 0,
        "SiriDirectionRef": 0,
        "MotLineId": 0,
        "MotDirection": 0,
        "MotVariation": null,
        "MessageExists": 0
    };

    const STOP = {
        "Id": 8,
        "Name": null,
        "EnglishName": "Balfour/Perlstein",
        "HebrewName": "בלפור/פרלשטיין",
        "PlaceId": 0,
        "EnglishPlaceDescription": "Bat Yam The Center of Town",
        "HebrewPlaceDescription": "בת-ים מרכז העיר",
        "BusStopTypeId": 0,
        "HebrewBusStopType": "איסוף והורדה",
        "EnglishBusStopType": "Boarding and Alighting",
        "Distance": "2.72",
        "PlatformId": "",
        "BoardingAlighting": "",
        "ArrivalTime": "00:11",
        "TimeFromOrigin": "11",
        "Longitude": 34.74552,
        "Latitude": 32.020751,
        "Makat": 33719,
        "FirstAlightId": 9,
        "LinesString": null,
        "MessageExists": 0,
        "LineList": null
    }

    const STOP_LIST_REQ = {//"isEggedDb":"false",
        //"Language":"he",
        //"FromAddress":{"City":{"iid":3198,"ID":"5000","NAME":"תל אביב יפו"},"Quarter":{"ID":5199,"NAME":"דרך הטייסים-אצטדיון וינטר : ניר אביב","DESCRIPTION":"ניר אביב","PRIORITY":16,"CITY":null,"uniqueId":9,"$$hashKey":"object:9471"}},
        //"ToAddress":{"City":{"ID":"5000","NAME":"תל-אביב","PRIORITY":1,"iid":3210,"uniqueId":0,"$$hashKey":"object:9562"},"Quarter":{"ID":3298,"NAME":"קרית שאול- בית עלמין : כניסה לשכונת המשתלה","DESCRIPTION":"כניסה לשכונת המשתלה","PRIORITY":13,"CITY":null,"uniqueId":21,"$$hashKey":"object:9587"}},
        "DayOrder":1,
        "DateOrder":"30/10/2025",
        "LineNumberId":51110,
        //"SearchCityId":"5000",
        //"SearchPlaceId":5199,
        //"Hour":"",
        "Makat":511101,
        "Chalufa":"0",
        //"BusStationArrangementD":1,
        //"BusStationArrangementA":54,
        //"OriginTime":"29/10/2025 23:05",
        //"CoordinateLat":"",
        //"CoordinateLng":"",
        //"CoordinateDistance":"",
        //"FreeTextQuestion":"","FreeTextOptionId":"","FreeTextSessionId":"",
        //"SelectedBusstopId":25629,
        //"CityPlaceExpression":"","StreetId":"","HouseNumber":""
    };

    const REALTIME_ENTRY = {
        "ID": 511151,
        "NAME": null,
        "CompanyId": 3,
        "CompanyName": "דן",
        "Direction": null,
        "SourceName": null,
        "DestinationName": null,
        "DestinationEngName": null,
        "CompanyEnglishName": null,
        "Chalufa": "0",
        "Description": "תל-אביב,קאנטרי דקל - חולון,משרד הרישוי",
        "Distance": 13,
        "DistanceFromStart": 5210,
        "TripsPerDay": 90,
        "CompanyHebrewName": "דן",
        "BusstopHebrewName": "דיזנגוף סנטר/המלך גורג",
        "BusstopType": "איסוף והורדה",
        "DestinationQuarterId": "3225",
        "Shilut": "14",
        "DestinationQuarterName": "חולון משרד הרישוי",
        "MinutesToArrival": 0,
        "MinutesToArrivalList": [ 0, 6, 7 ],
        "Remark": null,
        "DtArrival": "0001-01-01T00:00:00",
        "ResponseSuccesed": true,
        "DestinationMakat": 35246,
        "SiriDirectionRef": 1,
        "MotLineId": 21014,
        "MotDirection": 1,
        "MotVariation": "0",
        "MessageExists": 0
    }
}


export { BusGovAPI, BusGov }