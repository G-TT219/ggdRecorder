export type MatchTimelineEvent = {
  type: number;
  targetId: string;
  uid: string;
  timestamp: number;
};

type ResultMatch = {
  playerData: Record<string, { role: number }>;
  rounds?: Array<{ timeline?: MatchTimelineEvent[] }>;
};

export type EndGameResult = {
  winners: string[];
  losers: string[];
  timestamp: number;
};

// Mirrors getEndGameResult in the official dashboard (verified 2026-09-08):
// https://gaggle.fun/main.15d885d4e8b5d6e6.js
// Event UIDs refer to playerData keys, not necessarily player.userId.
export function getEndGameResult(match: ResultMatch): EndGameResult | null {
  const timeline = match.rounds?.[match.rounds.length - 1]?.timeline;
  if (!timeline) return null;
  const events = timeline.filter(event =>
    (event.type === 0 || event.type === 1) && event.targetId === '' &&
    Number.isFinite(event.timestamp));
  if (!events.length) return null;

  const timestamp = events.reduce((latest, event) => Math.max(latest, event.timestamp), -Infinity);
  const players = Object.keys(match.playerData);
  const playerIds = new Set(players);
  const finalEvents = events.filter(event =>
    event.timestamp === timestamp && event.uid && playerIds.has(event.uid));
  if (!finalEvents.length) return null;
  const winners = new Set(finalEvents.filter(event => event.type === 0).map(event => event.uid));
  const losers = finalEvents.filter(event => event.type === 1).map(event => event.uid);

  // Duck_Sabotage_Win + CL_Turned_Into_Rabbit: rabbit and base duck share the win.
  if (timeline.some(event => event.type === 500)) {
    const rabbit = timeline.find(event => event.type === 2045);
    if (rabbit?.uid) {
      winners.add(rabbit.uid);
      const duck = players.find(id => match.playerData[id].role === 2);
      if (duck) winners.add(duck);
    }
  }

  // TTDrTurducken and TTTurduckensMonster share their partner's victory.
  const doctor = [...winners].find(id => match.playerData[id]?.role === 108);
  const monster = [...winners].find(id => match.playerData[id]?.role === 109);
  if (Boolean(doctor) !== Boolean(monster)) {
    const partner = players.find(id => match.playerData[id].role === (doctor ? 109 : 108));
    if (partner) winners.add(partner);
  }
  return { winners: [...winners], losers, timestamp };
}

export function getPlayerOutcome(result: EndGameResult | null, playerKey: string): 'win' | 'loss' | 'unknown' {
  if (!result) return 'unknown';
  return result.winners.includes(playerKey) ? 'win' : 'loss';
}
