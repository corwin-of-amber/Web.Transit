import _ from 'lodash';
import * as Vue from 'vue';
import danfo from 'danfojs';

import { Cell, Fuel, Stabilizer, flatMapAsync } from './model/mini-notebook';
import { Meta } from './model/metaclass';

import App, { IApp } from './components/app.vue';
import { MotGov } from './services/motgov';
import { BusGov } from './services/busgov';
import { Busofash } from './services/busofash';

import { proxySetup } from './etc/proxy-settings';

import './index.scss';


function main() {
    proxySetup();

    let app = Vue.createApp(App).mount(document.body) as IApp;

    Object.assign(window, { app, Vue, danfo, gov: new BusGov, mot: new MotGov, ash: new Busofash });

    scratch1();
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
    let c = app.mininb.cells; //Vue.reactive({} as typeof app.mininb.cells);

    let fuel = new Fuel(50),
        stable = new Stabilizer;

    class A {
        //@Meta.desc(stable.op.bind(stable))
        //selected() { return [app.markers['selected']].filter(x => x); }

        selected(ov) { return stable.op(() => [app.markers['selected']].filter(x => x))(ov); }
        //selected = stable.op(() => [app.markers['selected']].filter(x => x))

        arrivalsView = () => mot.getArrivals(c.arrivals)
        vehicleMarkers = () => mot.getVehicleMarkers(c.arrivals) as any
        
        @Meta.async({default: []})
        @Meta.desc(fuel.limited.bind(fuel))
        arrivals() {
            return flatMapAsync(c.selected ?? [], r =>
                r.tag?.stop ? mot.getRealtime(r.tag.stop.stop_code) : [])
        }

        poke = () => [app.markers['poke']].filter(x => x)
        around = () => [c.poke?.[0]?.at].filter(x => x).flatMap(at =>
            mot.stopsAround(at).slice(0, 15))

        @Meta.display(false)
        markers() {
            if (!c) return {}
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
        /*
        arrivalsView: () => mot.getArrivals(c.arrivals),
        vehicleMarkers: () => mot.getVehicleMarkers(c.arrivals) as any,

        @async([])
        arrivals() { //: async([])(fuel.limited(async () =>
            return flatMapAsync(c.selected ?? [], r =>
                r.tag?.stop ? mot.getRealtime(r.tag.stop.stop_code) : [])
        ),

        poke: () => [app.markers['poke']].filter(x => x),
        around: () => [c.poke?.[0]?.at].filter(x => x).flatMap(at =>
            mot.stopsAround(at).slice(0, 15))
    });
*/
    Object.assign(c, Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.value])));
    //Object.assign(app.mininb.cells,
    //    Object.fromEntries(Object.entries(cells).flatMap(([k, v]) => v.options.display ? [[k, v.value]] : [])));

    Vue.effect(() => app.markers = c.markers as any);
}

document.addEventListener('DOMContentLoaded', main);