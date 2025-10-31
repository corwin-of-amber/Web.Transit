import * as Vue from 'vue';
import danfo from 'danfojs';

import App from './components/app.vue';
import { BusGov } from './services/busgov';
import { Busofash } from './services/busofash';


function main() {
    let app = Vue.createApp(App).mount(document.body);

    Object.assign(window, { app, danfo, gov: new BusGov, ash: new Busofash });
}

document.addEventListener('DOMContentLoaded', main);