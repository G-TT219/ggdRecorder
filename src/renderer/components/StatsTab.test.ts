import { describe, expect, it } from 'vitest';
import {
  formatPercent,
  getFactionName,
  getMapName,
  getModeName,
  getRoleName,
  isSpectator,
} from './StatsTab';

describe('Gaggle stats enum labels', () => {
  it('uses the current official role ids instead of the legacy mapping', () => {
    expect(getRoleName(8)).toBe('正义使者');
    expect(getRoleName(47)).toBe('观战者');
    expect(getRoleName(64)).toBe('追踪者');
    expect(getRoleName(111)).toBe('布谷鸟');
  });

  it('maps current map and mode ids', () => {
    expect(getMapName(0)).toBe('鹅教堂');
    expect(getMapName(7)).toBe('地下室');
    expect(getMapName(9)).toBe('血夜港湾');
    expect(getModeName(0)).toBe('经典');
    expect(getModeName(5)).toBe('轮抽');
    expect(getModeName(254)).toBe('教程');
  });

  it('recognizes spectators by either role or faction', () => {
    expect(isSpectator(47, 12)).toBe(true);
    expect(isSpectator(47, 1)).toBe(true);
    expect(isSpectator(1, 12)).toBe(true);
    expect(isSpectator(1, 1)).toBe(false);
    expect(getFactionName(12)).toBe('观战');
  });

  it('keeps API percentage values as percentages', () => {
    expect(formatPercent(58.7)).toBe('58.7%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(undefined)).toBe('—');
  });
});
