
declare var chrome: any;

const FIND_PROXY = `
  if (host.includes('moran.mot.gov.il'))
    return 'SOCKS localhost:1080; DIRECT';
  else
    return 'DIRECT';
`;

async function proxySetup() {
    return new Promise(resolve => {
        chrome.proxy.settings.set({
            value: {
                mode: "pac_script",
                pacScript: {
                    data: "function FindProxyForURL (url, host) {\n" +
                        FIND_PROXY +
                    "}"
                }
            },
            scope: 'regular'
        }, resolve);
    })

}


export { proxySetup }