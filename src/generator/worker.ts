import { opponentTrack } from "../game/duel";
import { generate, campaign } from "./index";
import { solveScore } from "../solver";
self.onmessage = (event: MessageEvent) => {
  const { seed, kind, difficulty, level, requestId } = event.data;
  try {
    const track = level ? campaign(level) : generate(seed, kind, difficulty);
    const solution = solveScore(track);
    self.postMessage({
      track,
      solution,
      redTrack: opponentTrack(track),
      requestId,
    });
  } catch (error) {
    self.postMessage({ error: String(error), requestId });
  }
};
