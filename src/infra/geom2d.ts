
export type XY = [number, number];

export function vec([x1, y1]: XY, [x2, y2]: XY) {
    return [x2 - x1, y2 - y1] as XY;
}

export function norm2([x, y]: XY) {
    return x ** 2 + y ** 2;
}

export function dist2(p1: XY, p2: XY) {
    return norm2(vec(p1, p2));
}