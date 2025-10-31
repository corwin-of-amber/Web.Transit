import * as Vue from 'vue';
import danfo from 'danfojs';

import App from './components/app.vue';
import { BusGov } from './services/busgov';


function main() {
    let app = Vue.createApp(App).mount(document.body);

    Object.assign(window, { app, danfo, gov: new BusGov });
}

document.addEventListener('DOMContentLoaded', main);