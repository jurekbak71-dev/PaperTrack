import type { Point } from "../geometry";

/** One completed click/tap selects one node. Dragging never draws a path. */
export function bindNodeClicks(
  canvas: HTMLCanvasElement,
  point: (event: PointerEvent) => Point,
  select: (node: Point) => void,
  dragged: () => void,
) {
  let pending: {
    id: number;
    node: Point;
    x: number;
    y: number;
    moved: boolean;
  } | null = null;
  canvas.onpointerdown = (event) => {
    if (!event.isPrimary || event.button !== 0 || pending) return;
    pending = {
      id: event.pointerId,
      node: point(event),
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  canvas.onpointermove = (event) => {
    if (!pending || pending.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8)
      pending.moved = true;
  };
  canvas.onpointerup = (event) => {
    if (!pending || pending.id !== event.pointerId) return;
    const down = pending,
      node = point(event);
    pending = null;
    event.preventDefault();
    if (down.moved || node.x !== down.node.x || node.y !== down.node.y)
      dragged();
    else select(node);
  };
  const cancel = (event: PointerEvent) => {
    if (pending?.id === event.pointerId) pending = null;
  };
  canvas.onpointercancel = cancel;
  canvas.onlostpointercapture = cancel;
}
