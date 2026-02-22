import { ReadableStream } from 'node:stream/web'; /** @kremlin.native */
import * as fflate from 'fflate';


async function* unzipStream(stream: ReadableStream<Uint8Array>) {

    const unzipper = new fflate.Unzip();
    unzipper.register(fflate.UnzipInflate);

    let queue = [] as UnzipFileWithStream[];

    unzipper.onfile = (file) => {
        console.log(`${file.name}: Started extracting`);
        queue.push(new UnzipFileWithStream(file));
    };
  
    for await (let chunk of streamConsume(stream)) {
        unzipper.push(chunk);
        yield *queue.splice(0);
    }
}


class UnzipFileWithStream {
    file: fflate.UnzipFile
    stream: ReadableStream<Uint8Array>

    constructor(file: fflate.UnzipFile) {
        this.file = file;
        this.stream = new ReadableStream({
            start: (controller) => {
                let bytes = 0;
                file.ondata = (err, data, final) => {
                    if (err) {
                        controller.error(err);
                    } else {
                        this.progress(bytes += data.length);

                        controller.enqueue(data);
                        if (final) controller.close();
                    }
                };
                file.start();
            },
            cancel() {
                file.terminate();
            }
        });
    }

    progress(bytes: number, final: boolean = false) {
        console.log(`${this.file.name}: received ${bytes} bytes out of ${this.file.originalSize}`);
        if (final) console.log(`${this.file.name}: Finished extracting`);
    }
}

async function* streamConsume<T>(stream: ReadableStream<T>) {
    let reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
    }
}


export { unzipStream, UnzipFileWithStream }