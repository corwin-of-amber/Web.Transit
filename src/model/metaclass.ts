import _ from 'lodash';
import { Cell } from './mini-notebook';


class Meta {

    instance: object
    proto: object
    entries: [string, any][]

    constructor(o: object) {
        this.instance = o;
        this.proto = Object.getPrototypeOf(o);
        this.entries = [...Object.entries(o),
            ...Object.getOwnPropertyNames(this.proto).filter(nm => nm !== 'constructor')
                .map(nm => [nm, this.proto[nm]] as [string, any])];
    }

    /**
     * Poor-mans declaration "parser"
     */
    declarationOrder() {
        return [...this.proto.constructor.toString().matchAll(/([_\w]+)\s*(\(|=)/g)]
            .map(mo => mo[1]).filter(nm => this.instance[nm] || Object.hasOwn(this.proto, nm));
    }

    intoCells(): {[k: string]: Cell<any>} {

        let entries = this.entries;
        let ordering = this.declarationOrder();
        entries = _.sortBy(entries, kv => (1 + ordering.indexOf(kv[0])) || entries.indexOf(kv))

        return Object.fromEntries(entries.map(([k, v]) =>
            [k, Meta.createCell(v)]))
    }

    static intoCells(o: object): {[k: string]: Cell<any>} {
        return new Meta(o).intoCells();
    }

    static createCell(v: any) {
        return (v instanceof Cell ? v : v.async ? Cell.async(v, v.async.default) : Cell.sync(v))
            .withOptions(v.options);
    }

    static desc2(fn: (value: any) => any) {
        return (target: object, descriptor: PropertyDescriptor) => {
            descriptor.value = fn(descriptor.value);
            return descriptor;
        };
    }

    static desc(fn: (value: any) => any) {
        return (target: object, name: string, descriptor: PropertyDescriptor) => {
            descriptor.value = fn(descriptor.value);
            return descriptor;
        };
    }

    static display(flag: boolean) {
        return (target: object, name: string, descriptor: PropertyDescriptor) => {
            descriptor.value.options = {display: flag};
            return descriptor;
        };
    }

    static async<T>(opts: {default?: T}) {
        return (target: object, name: string, descriptor: PropertyDescriptor) => {
            descriptor.value.async = opts;
            return descriptor;
        };
    }
}


export { Meta }