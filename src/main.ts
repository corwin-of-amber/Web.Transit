import _ from 'lodash';
import * as Vue from 'vue';
import danfo from 'danfojs';
import { MapMouseEvent } from 'maplibre-gl';

import { XY } from './infra/geom2d';

import { Cell, Fuel, Stabilizer, flatMapAsync } from './model/mini-notebook';
import { Meta } from './model/metaclass';

import App, { IApp } from './components/app.vue';
import { GridWidget } from './components/grid/data';
import MapView, { Tag } from './components/map-view/index.vue';

import { MotGov } from './services/motgov';
import { BusGov } from './services/busgov';
import { Busofash } from './services/busofash';

import { proxySetup } from './etc/proxy-settings';

import './index.scss';


function main() {
    proxySetup();

    let app = Vue.createApp(App).component('MapView', MapView).mount(document.body) as IApp;

    Object.assign(window, { app, Vue, danfo, gov: new BusGov, mot: new MotGov, ash: new Busofash });

    scratch1();
}


class Ports<T> {
    ref = Vue.reactive({}) as Partial<T>

    capture(nm: keyof T) {
        return (ev: any) => this.ref[nm] = ev;
    }

    get _() { return this.ref; }
}


//// SCRATCH AREA ////
declare var mot: MotGov, app: IApp;

function scratch0() {
    let c = app.mininb.cells;
    c.stoopid =
        [{id: 'stop1', at: [5, 9], routes: [{name: "3", agency: "דן"}]},
         {id: 'stop2', at: [5, 9], routes: [{name: "9", agency: "דן"}, {name: "45", agency: "אגד"}, {name: "20", agency: "דן"}]}];
}

function scratch1() {    
    let c = Vue.reactive({} as typeof app.mininb.cells);

    let fuel = new Fuel(50),
        stable = new Stabilizer,
        ports = new Ports<{poke: MapMouseEvent, marker: any}>();

    const mark = (kind: string, at: XY, props: Partial<Tag> = {}) =>
            ({tag: {kind, ...props}, at});
    
    class A {
        ui = () => [{
            map: new GridWidget({vue: {
                type: 'MapView',
                props: {markers: app.markers},
                handlers: {poke: ports.capture('poke'),
                           'marker:mousedown': ports.capture('marker')}
            }})
        }]

        @Meta.desc(stable)
        selected() {
            return [ports._.marker?.marker].flatMap(m => m?.tag?.stop ?
                [mark('stop/selected', m.at, {stop: m.tag.stop})] : []);
        }

        arrivalsView = () => mot.getArrivals(c.arrivals)
        vehicleMarkers = () => mot.getVehicleMarkers(c.arrivals) as any
        
        @Meta.async({default: []})
        @Meta.desc(fuel)
        arrivals() {
            return flatMapAsync(c.selected ?? [], r =>
                r.tag?.stop ? mot.getRealtime(r.tag.stop.stop_code) : [])
        }

        poke = () => [ports._.poke].flatMap(ev => ev ?
                     [mark('poke', [ev.lngLat.lng, ev.lngLat.lat])] : [])
        around = () => [c.poke?.[0]?.at].flatMap(at => at ?
                       mot.stopsAround(at).slice(0, 15) : [])

        @Meta.display(false)
        markers() {
            return {
                ...Object.fromEntries(c.poke?.map(m => ['poke', m])),
                ...Object.fromEntries(c.selected?.map(m => ['selected', m])),
                ...Object.fromEntries(c.around?.map(st => [st.tag.stop.stop_id, st])),
                ...c.vehicleMarkers
            }
        }
    }

    let cells: {[k: string]: Cell<any[]>} = Meta.intoCells(new A);

    Object.assign(window, {c, cells, A})
       
    Object.assign(c, Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.value])));
    Object.assign(app.mininb.cells, Object.fromEntries(Object.entries(cells)
        .flatMap(([k, v]) => v.options.display ? [[k, v.value]] : [])));

    Vue.effect(() => app.markers = c.markers as any);
}

document.addEventListener('DOMContentLoaded', main);