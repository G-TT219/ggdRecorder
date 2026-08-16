import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StatsTab from './StatsTab';

const recentPlayersKey = 'ggd-recorder.recent-players.v2';

describe('StatsTab recent common-match players', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(recentPlayersKey, JSON.stringify([{
      userId: 'other-player-id',
      nickname: '最近玩家',
      lastSeenAt: '2026-07-26T00:00:00.000Z',
      lastMatchId: 'shared-match-id',
    }]));

    Object.assign(window.electronAPI, {
      getGaggleAuthStatus: vi.fn().mockResolvedValue({
        success: true,
        status: { state: 'connected', userId: 'current-player-id', source: 'session' },
      }),
      onGaggleAuthStatusChanged: vi.fn().mockReturnValue(() => undefined),
      fetchMyMatchHistory: vi.fn(),
      fetchMatchData: vi.fn().mockResolvedValue({
        success: true,
        data: {
          matchId: 'shared-match-id',
          map: 0,
          mode: 0,
          winningFaction: 1,
          startAt: '2026-07-26T00:00:00.000Z',
          endAt: '2026-07-26T00:10:00.000Z',
          rounds: [],
          playerData: {
            current: {
              userId: 'current-player-id',
              nickname: '当前账号',
              role: 1,
              faction: 1,
              win: true,
              isGhost: false,
              kills: 0,
              tasks: 4,
              correctVotes: 2,
              turnsSurvived: 5,
              discussions: 3,
              sabotages: 0,
            },
            recent: {
              userId: 'other-player-id',
              nickname: '最近玩家',
              role: 2,
              faction: 2,
              win: false,
              isGhost: true,
              kills: 1,
              tasks: 0,
              correctVotes: 1,
              turnsSurvived: 3,
              discussions: 2,
              sabotages: 1,
            },
          },
        },
      }),
    });
  });

  it('opens the shared match and focuses the selected player without querying account history', async () => {
    render(<StatsTab />);

    fireEvent.click(await screen.findByTitle('打开与 最近玩家 的最近共同对局'));

    await waitFor(() => {
      expect(window.electronAPI.fetchMatchData).toHaveBeenCalledWith('shared-match-id');
    });
    expect(window.electronAPI.fetchMyMatchHistory).not.toHaveBeenCalled();
    expect(await screen.findByText('已定位共同对局玩家：最近玩家')).toBeInTheDocument();
    expect(screen.getByText('已定位')).toBeInTheDocument();
    expect(document.querySelector('.stats-section.is-detail-view')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '战绩查询' })).not.toBeInTheDocument();
    expect(screen.queryByText('查询我的战绩')).not.toBeInTheDocument();
  });
});
