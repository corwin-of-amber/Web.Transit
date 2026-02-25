import _ from 'lodash';
import * as Vue from 'vue';
import { imap } from 'itertools';
import { AsyncComputedOnCancel, computedAsync } from '@vueuse/core';
import { Meta, MetaDecorator } from './metaclass'


class Cell<T> {
    ref: Vue.Ref<T>
    tick?: Vue.Ref<number>

    options: {display?: boolean} = {display: true}

    constructor(ref: Vue.Ref<T>, tick?: Vue.Ref<number>) {
        this.ref = ref;
        this.tick = tick;
    }

    withOptions(options: this['options']) {
        _.merge(this.options, options);
        return this;
    }

    get value(): T { return this.ref as T; }

    poke() { this.tick.value += 1; }

    static sync<T>(fn: (ov: T) => T) {
        return new Cell<T>(Vue.computed(fn), Vue.ref(0));
    }

    static async<T>(fn: (oc: AsyncComputedOnCancel) => T | Promise<T>, initialState?: T) {
        let tick = Vue.ref(0);
        return new Cell<T>(computedAsync((oc) => (tick.value, fn(oc)), initialState), tick);
    }
}

class Stabilizer extends MetaDecorator {
    op<T>(fn: (old: T) => T) {
        return (ov: T) => this.ref(ov, fn(ov));
    }

    ref<T>(oldV: T, newV: T) {
        return this.eq(oldV, newV) ? oldV : newV;
    }

    eq<T>(obj1: T, obj2: T) {
        return _.isEqual(obj1, obj2);
    }

    [Meta.decorate](fn: <T>(old: T) => T) {
        return this.op(fn);
    }
}

class Fuel extends MetaDecorator {
    constructor(public remaining: number) { super(); }

    dec() {
        if (this.remaining > 0) { this.remaining--; return true; }
        else return false;
    }

    limited<T>(fn: (...a: any[]) => T, failval: any = Fuel.NEVER): typeof fn {
        return (...a) => this.dec() ? fn(...a) : failval;
    }

    [Meta.decorate](fn: <T>(old: T) => T) {
        return this.limited(fn);
    }

    static NEVER = new Promise(() => {});
}

async function flatMapAsync<T, S>(iterable: Iterable<T>, fn: (t: T) => S | Promise<S>) {
    return (await Promise.all(imap(iterable, fn))).flat();
}


export { Cell, Fuel, Stabilizer, flatMapAsync }