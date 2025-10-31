
function fromObjects(objs: object[]) {
    let proto = Object.fromEntries(objs.flatMap(o => Object.entries(o))),
        keys = Object.keys(proto);
    return [keys.map(t => ({text: t})),
        ...objs.map(row => keys.map(k => ({text: row[k] ?? ''})))];
}


export { fromObjects }