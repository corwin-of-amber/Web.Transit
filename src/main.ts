import * as Vue from 'vue';
import danfo from 'danfojs';

import App, { IApp } from './components/app.vue';
import { MotGov } from './services/motgov';
import { BusGov } from './services/busgov';
import { Busofash } from './services/busofash';

import './index.scss';


function main() {
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
    let c = app.mininb.cells;
    delete c.stoopid;
    c.poke = <any>Vue.computed(() => [app.markers['poke']].filter(x => x))
    c.around = <any>Vue.computed(() => [c.poke?.[0]?.at].filter(x => x).flatMap(at =>
        mot.stopsAround(at).slice(0, 10)))

    Vue.effect(() => app.markers = {
        ...Object.fromEntries(c.poke.map(m => ['poke', m])),
        ...Object.fromEntries(c.around.map(st => [st.tag.stop.stop_id, st]))
    })
}

document.addEventListener('DOMContentLoaded', main);