import type { Track } from "../generator";
export function render(
  canvas: HTMLCanvasElement,
  t: Track,
  path: number[],
  solution: number[],
  invalid: boolean,
  zoom: number,
  pan = { x: 0, y: 0 },
  contrast = false,
) {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 3);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const c = canvas.getContext("2d")!;
  c.scale(dpr, dpr);
  const scale = rect.width / t.size;
  c.scale(scale, scale);
  c.fillStyle = "#fcf8eb";
  c.fillRect(0, 0, t.size, t.size);
  c.translate(t.size / 2, t.size / 2);
  c.scale(zoom, zoom);
  c.translate(-t.size / 2 + pan.x, -t.size / 2 + pan.y);
  const poly = (p: { x: number; y: number }[]) => {
    c.moveTo(p[0].x, p[0].y);
    p.slice(1).forEach((p) => c.lineTo(p.x, p.y));
    c.closePath();
  };
  c.beginPath();
  poly(t.outer);
  if (t.hole.length) poly(t.hole);
  c.fillStyle = "#e9e5d3";
  c.fill("evenodd");
  c.strokeStyle = "#a6c9df";
  c.lineWidth = 0.035;
  for (let i = 0; i <= t.size; i++) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, t.size);
    c.moveTo(0, i);
    c.lineTo(t.size, i);
    c.stroke();
  }
  c.strokeStyle = "#243f75";
  c.lineWidth = contrast ? 0.23 : 0.16;
  c.lineJoin = "round";
  c.beginPath();
  poly(t.outer);
  if (t.hole.length) poly(t.hole);
  c.stroke();
  c.globalAlpha = 0.2;
  c.translate(0.08, 0.06);
  c.stroke();
  c.translate(-0.08, -0.06);
  c.globalAlpha = 1;
  c.font = contrast ? "1.2px cursive" : ".85px cursive";
  c.fillStyle = "#526989";
  for (let s = 1; s < t.stages; s++) {
    const p = t.center[Math.floor((s / t.stages) * t.center.length)];
    c.fillText(`→ ${s}`, p.x, p.y);
  }
  const line = (ids: number[], color: string, dash: number[]) => {
    if (!ids.length) return;
    c.beginPath();
    c.setLineDash(dash);
    ids.forEach((id, i) => {
      const p = t.nodes[id];
      if (i) c.lineTo(p.x, p.y);
      else c.moveTo(p.x, p.y);
    });
    c.strokeStyle = color;
    c.lineWidth = 0.22;
    c.lineCap = "round";
    c.stroke();
    c.setLineDash([]);
  };
  line(solution, "#29977d", [0.35, 0.3]);
  line(path, invalid ? "#be4540" : "#173d8a", []);
  for (const [id, label] of t.kind === "rally"
    ? ([
        [t.start, "START"],
        [t.finish, "META"],
      ] as const)
    : ([[t.start, "START / META"]] as const)) {
    const p = t.nodes[id];
    c.beginPath();
    c.arc(p.x, p.y, 0.34, 0, Math.PI * 2);
    c.fillStyle = "#be4540";
    c.fill();
    c.font = "bold 1px cursive";
    c.fillStyle = "#243f75";
    c.fillText(label, p.x - 2, p.y - 1);
  }
  const p = t.nodes[path.at(-1) ?? t.start];
  c.beginPath();
  c.arc(p.x, p.y, 0.24, 0, 7);
  c.fillStyle = "#173d8a";
  c.fill();
}
