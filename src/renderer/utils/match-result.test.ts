import { describe, expect, it } from 'vitest';
import { getEndGameResult, getPlayerOutcome, type MatchTimelineEvent } from './match-result';

const event = (uid: string, type = 0, timestamp = 100, targetId = ''): MatchTimelineEvent =>
  ({ uid, type, timestamp, targetId });
const players = { goose: { role: 1 }, duck: { role: 2 } };
const match = (timeline: MatchTimelineEvent[], playerData = players) =>
  ({ playerData, rounds: [{ timeline }] });

describe('official end-game results', () => {
  it('uses final events rather than player win, ghost status or winning faction', () => {
    const result = getEndGameResult({
      ...match([event('goose'), event('duck', 1)]),
      playerData: {
        goose: { role: 1, win: false, isGhost: true },
        duck: { role: 2, win: true, isGhost: false },
      } as typeof players,
    });
    expect(getPlayerOutcome(result, 'goose')).toBe('win');
    expect(getPlayerOutcome(result, 'duck')).toBe('loss');
  });

  it('uses only the last round and latest ending timestamp with empty targetId', () => {
    const result = getEndGameResult({ playerData: players, rounds: [
      { timeline: [event('duck', 0, 500)] },
      { timeline: [event('duck', 0, 50), event('goose'), event('duck', 1), event('duck', 0, 200, 'goose')] },
    ] });
    expect(result).toEqual({ winners: ['goose'], losers: ['duck'], timestamp: 100 });
  });

  it('filters out unknown player ids, using dictionary keys as official UIDs', () => {
    const result = getEndGameResult(match([event('goose'), event('missing'), event('duck', 1)]));
    expect(result?.winners).toEqual(['goose']);
  });

  it('does not guess a loss when final events are missing or invalid', () => {
    for (const value of [
      { playerData: players }, { playerData: players, rounds: [] },
      match([]), match([event('goose', 7)]), match([event('missing')]),
      match([event('goose', 0, NaN)]),
    ]) {
      expect(getEndGameResult(value)).toBeNull();
      expect(getPlayerOutcome(getEndGameResult(value), 'goose')).toBe('unknown');
    }
  });

  it('adds the transformed rabbit and base duck for sabotage victory', () => {
    const result = getEndGameResult({
      playerData: { ...players, rabbit: { role: 97 } },
      rounds: [{ timeline: [event('goose', 1), event('duck', 1), event('rabbit', 1),
        event('sabotage', 500), event('rabbit', 2045)] }],
    });
    expect(result?.winners).toEqual(['rabbit', 'duck']);
    expect(getPlayerOutcome(result, 'duck')).toBe('win');
  });

  it('does not add rabbit winners without a sabotage victory', () => {
    const result = getEndGameResult({
      playerData: { ...players, rabbit: { role: 97 } },
      rounds: [{ timeline: [event('goose'), event('rabbit', 2045)] }],
    });
    expect(result?.winners).toEqual(['goose']);
  });

  it.each(['doctor', 'monster'])('adds the paired winner when %s won', winner => {
    const result = getEndGameResult({
      playerData: { doctor: { role: 108 }, monster: { role: 109 } },
      rounds: [{ timeline: [event(winner)] }],
    });
    expect(result?.winners).toEqual(expect.arrayContaining(['doctor', 'monster']));
    expect(result?.winners).toHaveLength(2);
  });
});
