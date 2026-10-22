import { generate, campaign } from "./index";
import { solve } from "../solver";
self.onmessage = (event: MessageEvent) => {
  const { seed, kind, difficulty, level, requestId } = event.data;
  try {
    const track = level ? campaign(level) : generate(seed, kind, difficulty);
    const solution = solve(track);
    self.postMessage({ track, solution, requestId });
  } catch (error) {
    self.postMessage({ error: String(error), requestId });
  }
};
