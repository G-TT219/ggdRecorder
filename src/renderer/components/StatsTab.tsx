import { useEffect, useState } from 'react';
import Logger from '../utils/logger';
import Icon from './Icon';
import { emitAppError } from './WorkspaceShell';
import type { GaggleAuthStatus } from '../../shared/types';

type TimestampValue = string | number;

// These IDs follow the enums used by the current Gaggle dashboard bundle.
const ROLE_NAMES: Record<number, string> = {
  1: '鹅', 2: '鸭', 3: '呆呆鸟', 4: '肉汁', 5: '机械师', 6: '技术员',
  7: '通灵者', 8: '正义使者', 9: '食鸟鸭', 10: '变形者', 11: '警长',
  12: '静语者', 13: '加拿大鹅', 14: '恋人鸭', 15: '恋人鹅', 16: '秃鹫',
  17: '专业杀手', 18: '间谍', 19: '拟态', 20: '侦探', 21: '鸽子',
  22: '观鸟', 23: '刺客', 24: '猎鹰', 25: '杀手', 26: '保镖', 27: '告密者',
  28: '政治家', 29: '锁匠', 30: '殡仪员', 31: '网红', 32: '派对',
  33: '爆炸王', 34: '决斗呆呆鸟', 35: '鹅', 36: '鸭', 37: '肉汁', 38: '鸭',
  39: '猎鹰', 40: '秃鹫', 41: '变形者', 42: '鹅', 43: '鹅', 44: '吸血鬼',
  45: '村民', 46: '鬼奴', 47: '观战者', 48: '身份窃贼', 49: '冒险家',
  50: '复仇者', 51: '忍者', 52: '丧葬者', 53: '窥探者', 54: '超能力者',
  55: '隐形', 56: '星界行者', 57: '鹈鹕', 58: '鬼奴', 59: '木乃伊',
  60: '连环杀手', 61: '工程师', 62: '术士', 63: '流浪儿童', 64: '追踪者',
  65: '超能力鸭', 66: '跟踪者', 67: '传教士', 68: '审判官', 69: '圣徒',
  70: '大祭司', 71: '恶魔猎手', 72: '新信徒', 73: '女裁缝', 74: '乌鸦',
  75: '食罪者', 76: '鹅', 77: '鸡', 78: '保镖', 79: '身份窃贼',
  80: '丧葬者', 81: '迷彩鸭', 82: '丘比特', 83: '生存主义者', 84: '载体',
  85: '寄生者', 86: '异形', 87: '科学家', 88: '角色', 89: '猫头鹰',
  90: '雷达兵', 91: '狙击手', 92: '说客', 93: '走失小鸭', 94: '预言家',
  95: '默剧演员', 96: '渡鸦', 97: '兔子', 98: '清醒梦者', 99: '小丑',
  100: '士兵', 101: '验尸官', 102: '探测员', 103: '掠夺者', 104: '狙击手',
  105: '妄想症', 106: '老鹰', 107: 'AI', 108: '特大啃博士',
  109: '特大啃怪物', 110: '巫医', 111: '布谷鸟',
};

const FACTION_NAMES: Record<number, string> = {
  1: '鹅阵营', 2: '鸭阵营', 3: '中立阵营', 4: '村民阵营', 5: '鬼奴阵营',
  6: '怪物阵营', 7: 'TLC 阵营', 8: '猎人阵营', 9: '猫头鹰阵营',
  10: 'DND 红队', 11: 'DND 蓝队', 12: '观战',
};

const MAP_NAMES: Record<number, string> = {
  0: '鹅教堂', 1: '马拉德庄园', 2: '连结殖民地', 3: '黑天鹅',
  4: '老妈鹅星球飞船', 5: '休息室', 6: '丛林神庙', 7: '地下室',
  8: '古代沙漠', 9: '血夜港湾', 10: '伊格尔顿', 11: '嘉年华',
  12: '哥斯拉', 13: '自定义', 15: '商场',
};

const MODE_NAMES: Record<number, string> = {
  0: '经典', 1: '猎鹅', 2: '霸王餐', 3: '不给糖就捣蛋', 4: '休闲',
  5: '轮抽', 6: '嘎嘎脆鸡肉味', 7: 'Fowl Play', 8: '腐化',
  9: '任务竞赛', 10: '捉迷藏', 11: '沙盒', 254: '教程',
};

const SPECTATOR_ROLE_ID = 47;
const SPECTATOR_FACTION_ID = 12;

export const getRoleName = (roleId: number): string =>
  ROLE_NAMES[roleId] || `未知角色（${roleId}）`;
export const getFactionName = (factionId: number): string =>
  FACTION_NAMES[factionId] || `未知阵营（${factionId}）`;
export const getMapName = (mapId: number): string =>
  MAP_NAMES[mapId] || `未知地图（${mapId}）`;
export const getModeName = (modeId: number): string =>
  MODE_NAMES[modeId] || `未知模式（${modeId}）`;
export const isSpectator = (role: number, faction?: number): boolean =>
  role === SPECTATOR_ROLE_ID || faction === SPECTATOR_FACTION_ID;

const formatNumber = (value: number | null | undefined, maximumFractionDigits = 1): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);
};

export const formatPercent = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)}%` : '—';

const toTimestamp = (value: TimestampValue): number => {
  if (typeof value === 'number') return value > 0 && value < 1_000_000_000_000
    ? value * 1000
    : value;
  const numericValue = Number(value);
  if (value.trim() && Number.isFinite(numericValue)) {
    return numericValue > 0 && numericValue < 1_000_000_000_000
      ? numericValue * 1000
      : numericValue;
  }
  return new Date(value).getTime();
};

type MatchHistoryItem = {
  matchId: string;
  role: number;
  faction: number;
  map: number;
  mode: number;
  win: boolean;
  startAt: TimestampValue;
  endAt: TimestampValue;
  playerCount: number;
  turnsSurvived: number;
  kills: number;
  votingAccuracy: number;
  winningFaction: number;
  rawData: unknown;
  timestamp?: string;
  playerData?: Record<string, unknown>;
};

type PlayerStats = {
  winRate: number;
  votingAccuracy: number;
  turnsSurvived: number;
  kills: number;
  rolesBreakdown: {
    goose: { timesPlayed: number; winRate: number };
    duck: { timesPlayed: number; winRate: number };
    neutral: { timesPlayed: number; winRate: number };
  };
  totalGamePlayed: number;
  achievement: { completed: number; total: number };
  playerLv: number;
  hasMore: boolean;
};

type PlayerData = {
  nickname: string;
  userId: string;
  role: number;
  faction: number;
  win: boolean;
  isGhost: boolean;
  kills: number;
  tasks: number;
  correctVotes: number;
  turnsSurvived: number;
  discussions: number;
  sabotages: number;
};

type RoundData = {
  startAt: TimestampValue;
  endAt: TimestampValue;
  meetingInfo?: {
    type: string;
    starter: string;
    result: string;
    votes?: Record<string, string>;
  };
};

type MatchData = {
  matchId: string;
  map: number;
  mode: number;
  winningFaction: number;
  startAt: TimestampValue;
  endAt: TimestampValue;
  playerData: Record<string, PlayerData>;
  rounds?: RoundData[];
};

type RecentPlayer = {
  userId: string;
  nickname: string;
  lastSeenAt: string;
  lastMatchId: string;
};

const RECENT_PLAYERS_STORAGE_KEY = 'ggd-recorder.recent-players.v2';

const loadRecentPlayers = (): RecentPlayer[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_PLAYERS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item && typeof item.userId === 'string' && typeof item.nickname === 'string' &&
      typeof item.lastMatchId === 'string'
    ).slice(0, 12);
  } catch {
    return [];
  }
};

const maskUserId = (userId?: string): string => {
  if (!userId) return '';
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 7)}…${userId.slice(-4)}`;
};

function StatsTab() {
  const [statsUrl] = useState('https://gaggle.fun/dashboard');
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchIdInput, setMatchIdInput] = useState('');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [matchHistoryError, setMatchHistoryError] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<GaggleAuthStatus>({ state: 'connecting' });
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>(loadRecentPlayers);

  useEffect(() => {
    let mounted = true;
    window.electronAPI.getGaggleAuthStatus().then(result => {
      if (mounted && result.success) setAuthStatus(result.status);
    }).catch(error => Logger.error('Failed to load Gaggle auth status:', error));

    const unsubscribe = window.electronAPI.onGaggleAuthStatusChanged(status => {
      if (mounted) {
        setAuthStatus(status);
        if (status.state === 'connected') setAuthError('');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const rememberPlayers = (players: Record<string, PlayerData>, matchId: string) => {
    const observedAt = new Date().toISOString();
    const discovered = Object.values(players)
      .filter(player => player.userId && player.nickname && player.userId !== authStatus.userId)
      .map(player => ({
        userId: player.userId,
        nickname: player.nickname,
        lastSeenAt: observedAt,
        lastMatchId: matchId,
      }));
    if (discovered.length === 0) return;

    setRecentPlayers(current => {
      const unique = new Map<string, RecentPlayer>();
      [...discovered, ...current].forEach(player => {
        if (!unique.has(player.userId)) unique.set(player.userId, player);
      });
      const next = Array.from(unique.values()).slice(0, 12);
      try {
        window.localStorage.setItem(RECENT_PLAYERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Recent-player shortcuts are optional when local storage is unavailable.
      }
      return next;
    });
  };

  const connectGaggle = async () => {
    setAuthActionLoading(true);
    setAuthError('');
    try {
      const result = await window.electronAPI.connectGaggle();
      if (result.success) setAuthStatus(result.status);
      else {
        setAuthError(result.error);
        emitAppError(result.error || '无法连接 Gaggle');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法打开 Gaggle 登录窗口';
      setAuthError(message);
      emitAppError(message);
    } finally {
      setAuthActionLoading(false);
    }
  };

  const disconnectGaggle = async () => {
    setAuthActionLoading(true);
    setAuthError('');
    try {
      const result = await window.electronAPI.disconnectGaggle();
      if (result.success) setAuthStatus(result.status);
      else {
        setAuthError(result.error);
        emitAppError(result.error || '断开 Gaggle 连接失败');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '断开连接失败';
      setAuthError(message);
      emitAppError(message);
    } finally {
      setAuthActionLoading(false);
    }
  };

  const useManualToken = async () => {
    if (!manualToken.trim()) {
      setAuthError('请输入 Bearer Token');
      emitAppError('请输入 Bearer Token');
      return;
    }
    setAuthActionLoading(true);
    setAuthError('');
    try {
      const result = await window.electronAPI.setManualGaggleAuth(manualToken);
      if (result.success) {
        setAuthStatus(result.status);
        setManualToken('');
      } else {
        setAuthError(result.error);
        emitAppError(result.error || 'Token 无效');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token 无效';
      setAuthError(message);
      emitAppError(message);
    } finally {
      setAuthActionLoading(false);
    }
  };

  // 在外部浏览器中打开战绩网页
  const openStatsInBrowser = () => {
    if (statsUrl) {
      window.electronAPI.openExternal(statsUrl);
    }
  };

  // 查询对局数据
  const fetchMatchData = async (matchId: string, focusPlayerId?: string) => {
    if (!matchId || !matchId.trim()) {
      setMatchError('请输入对局ID');
      return;
    }

    setMatchLoading(true);
    setMatchError('');
    setMatchData(null);

    try {
      // 通过 Electron 主进程代理请求，避免 CORS 问题
      const result = await window.electronAPI.fetchMatchData(matchId.trim());

      if (result.success) {
        const data = result.data as MatchData;

        Logger.info(`Fetch match data - Match ID: ${data.matchId || 'N/A'}`);
        Logger.info(`Fetch match data - Map: ${data.map || 'N/A'}`);
        Logger.info(`Fetch match data - Has playerData: ${!!data.playerData}`);

        setMatchData(data);
        setSelectedMatchId(data.matchId);
        setFocusedPlayerId(focusPlayerId || null);
        rememberPlayers(data.playerData || {}, data.matchId);

        Logger.info(`Fetch match data - Success: ${data.matchId}`);
        Logger.info(`Match info - Map: ${data.map}, Mode: ${data.mode}`);
        if (data.playerData) {
          Logger.info(`Player count: ${Object.keys(data.playerData).length}`);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to fetch match data: ${errMsg}`);
      setMatchError(`查询失败: ${errMsg}`);
      emitAppError(`查询失败: ${errMsg}`);

      // 开发测试：如果没有API，使用本地示例数据
      if (process.env.NODE_ENV === 'development') {
        Logger.info('Using sample match data for development');
      }
    } finally {
      setMatchLoading(false);
    }
  };

  // FetchList is scoped to the account encoded in the Bearer token.
  const fetchMyMatchHistory = async () => {
    setMatchHistoryLoading(true);
    setMatchHistoryError('');
    setMatchHistory([]);
    setPlayerStats(null);
    setMatchData(null);
    setSelectedMatchId(null);
    setFocusedPlayerId(null);

    try {
      const result = await window.electronAPI.fetchMyMatchHistory();

      if (result.success) {
        const apiData = result.data as { isSuccess: boolean; statusText?: string; body: {
          latestMatches?: Array<{
            matchId: string; role: number; faction: number; map: number; mode: number;
            win: boolean; startAt: string; endAt: string; numOfPlayers: number;
            turnsSurvived: number; kills: number; votingAccuracy: number; winningFaction: number;
          }>;
          winRate: number; votingAccuracy: number; turnsSurvived: number; kills: number;
          rolesBreakdown: { goose: { timesPlayed: number; winRate: number }; duck: { timesPlayed: number; winRate: number }; neutral: { timesPlayed: number; winRate: number } };
          totalGamePlayed: number; achievement: { completed: number; total: number };
          playerLv: number; hasMore: boolean;
        } };

        if (!apiData.isSuccess) {
          throw new Error(apiData.statusText || 'API 请求失败');
        }

        const body = apiData.body;

        // 提取对局列表
        const matches = body.latestMatches || [];

        // 转换数据格式，适配前端展示
        const formattedMatches = matches.map(match => ({
          matchId: match.matchId,
          role: match.role,
          faction: match.faction,
          map: match.map,
          mode: match.mode,
          win: match.win,
          startAt: match.startAt,
          endAt: match.endAt,
          playerCount: match.numOfPlayers,
          turnsSurvived: match.turnsSurvived,
          kills: match.kills,
          votingAccuracy: match.votingAccuracy,
          winningFaction: match.winningFaction,
          // 保留原始数据
          rawData: match
        }));

        setMatchHistory(formattedMatches);

        // 保存玩家统计数据
        setPlayerStats({
          winRate: body.winRate,
          votingAccuracy: body.votingAccuracy,
          turnsSurvived: body.turnsSurvived,
          kills: body.kills,
          rolesBreakdown: body.rolesBreakdown,
          totalGamePlayed: body.totalGamePlayed,
          achievement: body.achievement,
          playerLv: body.playerLv,
          hasMore: body.hasMore
        });

        Logger.info(`Match history fetched: ${formattedMatches.length} matches`);
        Logger.info(`Player Stats - Win Rate: ${body.winRate}%, Total Games: ${body.totalGamePlayed}, Level: ${body.playerLv}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      Logger.error('Failed to fetch match history:', error);
      const message = `获取历史失败: ${error instanceof Error ? error.message : String(error)}`;
      setMatchHistoryError(message);
      emitAppError(message);
    } finally {
      setMatchHistoryLoading(false);
    }
  };

  // 选择对局查看详情
  const handleSelectMatch = (matchId) => {
    setSelectedMatchId(matchId);
    setMatchIdInput(matchId);
    fetchMatchData(matchId);
  };

  const openRecentEncounter = (player: RecentPlayer) => {
    setMatchIdInput(player.lastMatchId);
    fetchMatchData(player.lastMatchId, player.userId);
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: TimestampValue) => {
    if (!timestamp) return '-';
    const timestampValue = toTimestamp(timestamp);
    if (!Number.isFinite(timestampValue)) return '-';
    const date = new Date(timestampValue);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 计算游戏时长
  const calculateDuration = (startAt: TimestampValue, endAt: TimestampValue) => {
    if (!startAt || !endAt) return '-';
    const durationMs = toTimestamp(endAt) - toTimestamp(startAt);
    if (!Number.isFinite(durationMs) || durationMs < 0) return '-';
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  };

  const isConnected = authStatus.state === 'connected';
  const authStateLabel = {
    disconnected: '尚未连接',
    connecting: '正在检查登录状态',
    connected: authStatus.source === 'manual' ? '已临时连接' : '已连接',
    expired: '登录已失效',
  }[authStatus.state];
  const authDescription = isConnected
    ? authStatus.source === 'manual'
      ? 'Token 仅保存在本次运行的内存中，关闭应用后自动清除。'
      : '登录状态由独立的 Gaggle 会话保存，查询时会自动使用当前账号。'
    : authStatus.state === 'connecting'
      ? '正在尝试恢复上次登录，无需打开官网查找 Token。'
      : '连接一次后，即可直接查询自己的战绩和遇到过的玩家。';

  const achievementTotal = playerStats?.achievement.total || 0;
  const achievementCompleted = playerStats?.achievement.completed || 0;
  const achievementPercent = achievementTotal > 0
    ? Math.min(100, Math.max(0, (achievementCompleted / achievementTotal) * 100))
    : 0;
  const detailPlayers = matchData ? Object.values(matchData.playerData || {}) : [];
  const focusedPlayer = focusedPlayerId
    ? detailPlayers.find(player => player.userId === focusedPlayerId) || null
    : null;
  const focusedFirst = (left: PlayerData, right: PlayerData) =>
    Number(right.userId === focusedPlayerId) - Number(left.userId === focusedPlayerId);
  const activeDetailPlayers = detailPlayers.filter(player =>
    !isSpectator(player.role, player.faction)).sort(focusedFirst);
  const spectatorDetailPlayers = detailPlayers.filter(player =>
    isSpectator(player.role, player.faction)).sort(focusedFirst);
  const factionBreakdown = playerStats ? [
    { key: 'goose', label: '鹅阵营', ...playerStats.rolesBreakdown.goose },
    { key: 'duck', label: '鸭阵营', ...playerStats.rolesBreakdown.duck },
    { key: 'neutral', label: '中立阵营', ...playerStats.rolesBreakdown.neutral },
  ] : [];
  const factionSampleSize = factionBreakdown.reduce(
    (total, faction) => total + (faction.timesPlayed || 0), 0);
  const isMatchDetailView = matchLoading || Boolean(matchData);

  return (
    <section className={`stats-section ${isMatchDetailView ? 'is-detail-view' : ''}`}>
      <div className="stats-container">
        {!isMatchDetailView && (
          <>
            <div className="stats-header">
              <div className="stats-title-group">
                <span className="stats-kicker">Gaggle Dashboard</span>
                <h2>战绩查询</h2>
                <p>生涯总览 · 最近对局 · 单局复盘</p>
              </div>
              <span className="stats-header-signal" aria-hidden="true"><i /><i /><i /><i /></span>
              <button
                className="open-browser-btn"
                onClick={openStatsInBrowser}
                title="在系统浏览器中打开官网"
              >
                <Icon name="globe" size={16} /> 打开官网
              </button>
            </div>

            <div className={`gaggle-auth-ticket state-${authStatus.state}`}>
              <div className="gaggle-auth-mark" aria-hidden="true">G</div>
              <div className="gaggle-auth-copy">
                <div className="gaggle-auth-heading">
                  <span className="gaggle-auth-state-dot" />
                  <strong>{authStateLabel}</strong>
                  {authStatus.userId && (
                    <code title={authStatus.userId}>{maskUserId(authStatus.userId)}</code>
                  )}
                </div>
                <p>{authDescription}</p>
                {authStatus.expiresAt && isConnected && (
                  <span className="gaggle-auth-expiry">
                    本次凭证预计于 {new Date(authStatus.expiresAt).toLocaleString('zh-CN', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                    })} 刷新
                  </span>
                )}
              </div>
              <div className="gaggle-auth-actions">
                {isConnected && (
                  <button
                    className="query-button gaggle-primary-action"
                    onClick={fetchMyMatchHistory}
                    disabled={matchHistoryLoading}
                  >
                    {matchHistoryLoading
                      ? '正在查询…'
                      : <><Icon name="chart" size={16} /> 查询我的战绩</>}
                  </button>
                )}
                <button
                  className="gaggle-secondary-action"
                  onClick={connectGaggle}
                  disabled={authActionLoading}
                >
                  <Icon name={isConnected ? 'refresh' : 'globe'} size={15} />
                  {isConnected
                    ? '重新连接'
                    : authStatus.state === 'connecting'
                      ? '打开登录窗口'
                      : '连接 Gaggle'}
                </button>
                {isConnected && (
                  <button
                    className="gaggle-quiet-action"
                    onClick={disconnectGaggle}
                    disabled={authActionLoading}
                  >
                    断开
                  </button>
                )}
              </div>
            </div>

            {authError && (
              <div className="gaggle-auth-error" role="alert">
                <Icon name="warning" size={16} /> {authError}
              </div>
            )}

            <details className="stats-advanced-query">
              <summary>高级查询</summary>
              <div className="stats-advanced-content">
                <p>官方战绩接口只返回 Token 所属账号；这里可以临时换用 Token，或直接打开已知对局。</p>
                <div className="advanced-query-grid">
                  <label className="advanced-query-field advanced-token-field">
                    <span>临时 Bearer Token</span>
                    <input
                      type="password"
                      className="match-id-input"
                      value={manualToken}
                      onChange={(event) => setManualToken(event.target.value)}
                      placeholder="Bearer eyJhbGciOi…"
                      autoComplete="off"
                    />
                    <button
                      className="gaggle-secondary-action"
                      onClick={useManualToken}
                      disabled={authActionLoading || !manualToken.trim()}
                    >
                      临时使用
                    </button>
                  </label>
                  <label className="advanced-query-field advanced-match-field">
                    <span>对局 ID</span>
                    <input
                      type="text"
                      className="match-id-input"
                      value={matchIdInput}
                      onChange={(event) => setMatchIdInput(event.target.value)}
                      placeholder="直接打开一场对局"
                      onKeyDown={(event) => event.key === 'Enter' && fetchMatchData(matchIdInput)}
                    />
                    <button
                      className="gaggle-secondary-action"
                      onClick={() => fetchMatchData(matchIdInput)}
                      disabled={matchLoading || !matchIdInput.trim()}
                    >
                      查询对局
                    </button>
                  </label>
                </div>
              </div>
            </details>
          </>
        )}

        {/* 历史加载状态 */}
        {matchHistoryLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>正在加载对局历史...</p>
          </div>
        )}

        {/* 历史错误提示 */}
        {matchHistoryError && !matchHistoryLoading && (
          <div className="error-state">
            <div className="error-icon"><Icon name="warning" size={28} /></div>
            <p>{matchHistoryError}</p>
          </div>
        )}

        {recentPlayers.length > 0 && !matchData && !matchLoading && !matchHistoryLoading && (
          <section className="recent-players-panel" aria-label="最近共同对局玩家">
            <div className="recent-players-heading">
              <div>
                <span>最近共同对局玩家</span>
                <small>点击后打开最近一次共同对局，不代表对方完整战绩</small>
              </div>
              <span>{recentPlayers.length}</span>
            </div>
            <div className="recent-player-list">
              {recentPlayers.map(player => (
                <button
                  key={player.userId}
                  type="button"
                  onClick={() => openRecentEncounter(player)}
                  disabled={matchLoading}
                  title={`打开与 ${player.nickname} 的最近共同对局`}
                >
                  <span className="recent-player-avatar">{player.nickname.charAt(0) || '?'}</span>
                  <span className="recent-player-copy">
                    <strong>{player.nickname}</strong>
                    <code>共同对局 · {maskUserId(player.lastMatchId)}</code>
                  </span>
                  <Icon name="arrowRight" size={14} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* The API mixes career totals with a rolling 100-match sample; keep them explicit. */}
        {playerStats && !matchHistoryLoading && !matchLoading && !matchData && (
          <div className="stats-v2-dashboard">
            <section className="stats-v2-panel" aria-labelledby="career-summary-title">
              <div className="stats-v2-section-heading">
                <div>
                  <span className="stats-v2-eyebrow">生涯数据</span>
                  <h3 id="career-summary-title">生涯总览</h3>
                </div>
                <p>账号当前的累计进度，不受最近对局范围影响</p>
              </div>
              <div className="stats-v2-career-grid">
                <article className="stats-v2-career-item">
                  <span className="stats-v2-career-label"><Icon name="gamepad" size={13} /> 总对局数</span>
                  <strong>{formatNumber(playerStats.totalGamePlayed, 0)}</strong>
                  <small>生涯累计完成的对局</small>
                </article>
                <article className="stats-v2-career-item">
                  <span className="stats-v2-career-label"><Icon name="trophy" size={13} /> 当前等级</span>
                  <strong>Lv. {formatNumber(playerStats.playerLv, 0)}</strong>
                  <small>当前游戏账号等级</small>
                </article>
                <article className="stats-v2-career-item stats-v2-achievement-item">
                  <div>
                    <span className="stats-v2-career-label"><Icon name="chart" size={13} /> 成就进度</span>
                    <strong>{achievementCompleted}<em>/ {achievementTotal || '—'}</em></strong>
                  </div>
                  <div
                    className="stats-v2-progress"
                    role="progressbar"
                    aria-label="成就完成进度"
                    aria-valuemin={0}
                    aria-valuemax={achievementTotal || 0}
                    aria-valuenow={achievementCompleted}
                  >
                    <span style={{ width: `${achievementPercent}%` }} />
                  </div>
                  <small>{achievementTotal > 0 ? `已完成 ${formatPercent(achievementPercent)}` : '暂无成就总数'}</small>
                </article>
              </div>
            </section>

            <section className="stats-v2-panel" aria-labelledby="recent-stats-title">
              <div className="stats-v2-section-heading">
                <div>
                  <span className="stats-v2-eyebrow">滚动样本</span>
                  <h3 id="recent-stats-title">最近 100 场表现</h3>
                </div>
                <p>不足 100 场时按账号已有的最近对局计算</p>
              </div>
              <div className="stats-v2-metric-grid">
                <article className="stats-v2-metric" title="最近 100 场中获胜对局所占的比例">
                  <span>胜率</span>
                  <strong>{formatPercent(playerStats.winRate)}</strong>
                  <small>获胜对局占比</small>
                </article>
                <article className="stats-v2-metric" title="最近 100 场中投票判断正确的比例">
                  <span>投票准确率</span>
                  <strong>{formatPercent(playerStats.votingAccuracy)}</strong>
                  <small>正确投票占比</small>
                </article>
                <article className="stats-v2-metric" title="最近 100 场平均每局存活的回合数">
                  <span>场均存活回合</span>
                  <strong>{formatNumber(playerStats.turnsSurvived)}</strong>
                  <small>回合 / 局</small>
                </article>
                <article className="stats-v2-metric" title="最近 100 场平均每局完成的击杀数">
                  <span>场均击杀</span>
                  <strong>{formatNumber(playerStats.kills)}</strong>
                  <small>击杀 / 局</small>
                </article>
              </div>

              <div className="stats-v2-factions">
                <div className="stats-v2-subheading">
                  <strong>阵营分布</strong>
                  <span>{factionSampleSize} 场样本</span>
                </div>
                <div className="stats-v2-faction-list">
                  {factionBreakdown.map(faction => (
                    <div className={`stats-v2-faction-row is-${faction.key}`} key={faction.key}>
                      <div className="stats-v2-faction-copy">
                        <span><i aria-hidden="true" />{faction.label}</span>
                        <strong>{formatNumber(faction.timesPlayed, 0)} 场</strong>
                      </div>
                      <div className="stats-v2-faction-track" aria-hidden="true">
                        <span style={{
                          width: `${factionSampleSize > 0
                            ? Math.min(100, (faction.timesPlayed / factionSampleSize) * 100)
                            : 0}%`
                        }} />
                      </div>
                      <small>该阵营胜率 {formatPercent(faction.winRate)}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Gaggle exposes at most 20 recent matches from the last 12 months. */}
        {matchHistory.length > 0 && !matchHistoryLoading && !matchLoading && !matchData && (
          <section className="stats-v2-history" aria-labelledby="match-history-title">
            <div className="stats-v2-history-heading">
              <div>
                <span className="stats-v2-eyebrow">过去 12 个月</span>
                <h3 id="match-history-title">最近 20 场对局</h3>
                <p>选择任意一场查看完整玩家和回合数据</p>
              </div>
              <span className="stats-v2-count">已返回 {matchHistory.length} 场</span>
            </div>
            <div className="stats-v2-match-table" role="table" aria-label="最近对局">
              <div className="stats-v2-match-head" role="row">
                <span role="columnheader">我的角色</span>
                <span role="columnheader">结果</span>
                <span role="columnheader">地图 / 模式</span>
                <span role="columnheader">开始时间</span>
                <span role="columnheader">玩家</span>
                <span role="columnheader">单局表现</span>
                <span aria-hidden="true" />
              </div>

              {matchHistory.map((match, index) => {
                const isSelected = selectedMatchId === match.matchId;
                const spectated = isSpectator(match.role, match.faction);
                const rawPlayerCount = match.playerCount ?? Object.keys(match.playerData || {}).length;
                const adjustedPlayerCount = spectated
                  ? Math.max(0, rawPlayerCount - 1)
                  : rawPlayerCount;
                const matchTimestamp = toTimestamp(match.startAt || match.timestamp || '');
                const matchDate = Number.isFinite(matchTimestamp) ? new Date(matchTimestamp) : null;
                const resultLabel = spectated ? '观战' : match.win ? '胜利' : '失败';
                const resultClass = spectated ? 'spectated' : match.win ? 'win' : 'lose';

                return (
                  <button
                    type="button"
                    role="row"
                    key={match.matchId || index}
                    className={`stats-v2-match-row faction-${match.faction} ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectMatch(match.matchId)}
                    title={`查看对局 ${match.matchId}`}
                  >
                    <span className="stats-v2-role-cell" role="cell">
                      <i className={`faction-${match.faction}`} aria-hidden="true">
                        {getRoleName(match.role).charAt(0) || '?'}
                      </i>
                      <span>
                        <strong>{getRoleName(match.role)}</strong>
                        <small>{getFactionName(match.faction)}</small>
                      </span>
                    </span>
                    <span className="stats-v2-result-cell" role="cell">
                      <em className={`is-${resultClass}`}>{resultLabel}</em>
                    </span>
                    <span className="stats-v2-location-cell" role="cell">
                      <strong>{getMapName(match.map)}</strong>
                      <small>{getModeName(match.mode)}</small>
                    </span>
                    <span className="stats-v2-date-cell" role="cell">
                      <strong>{matchDate ? matchDate.toLocaleDateString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit'
                      }) : '—'}</strong>
                      <small>{matchDate ? matchDate.toLocaleTimeString('zh-CN', {
                        hour: '2-digit', minute: '2-digit'
                      }) : ''}</small>
                    </span>
                    <span className="stats-v2-number-cell" role="cell"
                      title={spectated ? '观战局人数已排除观战者本人' : '该局实际玩家数'}>
                      <strong>{formatNumber(adjustedPlayerCount, 0)}</strong>
                      <small>人</small>
                    </span>
                    <span className="stats-v2-performance-cell" role="cell"
                      title="该局的存活回合、击杀数与投票准确率">
                      {spectated ? (
                        <strong>—</strong>
                      ) : (
                        <>
                          <strong>{formatNumber(match.turnsSurvived, 0)} 回合</strong>
                          <small>击杀 {formatNumber(match.kills, 0)} · 投票 {formatPercent(match.votingAccuracy)}</small>
                        </>
                      )}
                    </span>
                    <span className="stats-v2-row-arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 对局详情加载状态 */}
        {matchLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>正在查询对局数据...</p>
          </div>
        )}

        {/* 对局详情错误提示 */}
        {matchError && !matchLoading && (
          <div className="error-state">
            <div className="error-icon"><Icon name="warning" size={28} /></div>
            <p>{matchError}</p>
          </div>
        )}

        {/* 对局数据详情展示 */}
        {matchData && !matchLoading && (
          <div className="match-data-display">
            <div className="stats-v2-detail-toolbar">
              <button
                className="stats-v2-back-button"
                onClick={() => {
                  setMatchData(null);
                  setMatchIdInput('');
                  setFocusedPlayerId(null);
                }}
              >
                <Icon name="arrowRight" size={15} /> 返回战绩总览
              </button>
              <span>对局 ID <code title={matchData.matchId}>{matchData.matchId}</code></span>
            </div>

            <section className="stats-v2-detail-summary stats-v2-detail-hero" aria-labelledby="match-detail-title">
              <div className="stats-v2-detail-title">
                <div>
                  <span className="stats-v2-eyebrow">单局详情</span>
                  <h3 id="match-detail-title">{getMapName(matchData.map)}</h3>
                  <p>{getModeName(matchData.mode)} · {formatTimestamp(matchData.startAt)}</p>
                </div>
                <span className={`stats-v2-winning-faction faction-${matchData.winningFaction}`}>
                  {getFactionName(matchData.winningFaction)}获胜
                </span>
              </div>
              <div className="stats-v2-detail-facts">
                <div><span>实际玩家</span><strong>{activeDetailPlayers.length} 人</strong></div>
                <div><span>观战者</span><strong>{spectatorDetailPlayers.length} 人</strong></div>
                <div><span>总回合</span><strong>{matchData.rounds?.length ?? '—'}</strong></div>
                <div><span>对局时长</span><strong>{calculateDuration(matchData.startAt, matchData.endAt)}</strong></div>
                <div><span>结束时间</span><strong>{formatTimestamp(matchData.endAt)}</strong></div>
              </div>
            </section>

            <section className="stats-v2-players" aria-labelledby="match-players-title">
              <div className="stats-v2-players-heading">
                <div>
                  <h3 id="match-players-title">玩家数据</h3>
                  <p>状态指对局记录结束时是否存活；结果指该玩家是否属于获胜方</p>
                </div>
                <span>{focusedPlayer
                  ? `已定位共同对局玩家：${focusedPlayer.nickname}`
                  : '这里展示的是本场数据，不是其他玩家的生涯战绩'}</span>
              </div>
              <div className="stats-v2-player-table-scroll">
                <div className="stats-v2-player-table" role="table" aria-label="玩家单局数据">
                  <div className="stats-v2-player-head" role="row">
                    <span role="columnheader">玩家</span>
                    <span role="columnheader">角色 / 阵营</span>
                    <span role="columnheader">结束状态</span>
                    <span role="columnheader">结果</span>
                    <span role="columnheader" title="该局完成的任务数">任务</span>
                    <span role="columnheader" title="该局正确投票次数">正确投票</span>
                    <span role="columnheader">击杀</span>
                    <span role="columnheader">存活回合</span>
                    <span role="columnheader" title="该局讨论/发言统计">讨论</span>
                    <span role="columnheader">破坏</span>
                    <span aria-hidden="true" />
                  </div>
                  {activeDetailPlayers.map((player) => (
                  <div
                    key={player.userId}
                    role="row"
                    className={`stats-v2-player-row faction-${player.faction} ${
                      player.userId === focusedPlayerId ? 'is-focused' : ''}`}
                  >
                    <span className="stats-v2-player-name" role="cell">
                      <i aria-hidden="true">{player.nickname?.charAt(0) || '?'}</i>
                      <span><strong>{player.nickname || '未知玩家'}</strong><small>{maskUserId(player.userId)}</small></span>
                    </span>
                    <span className="stats-v2-player-role" role="cell">
                      <strong>{getRoleName(player.role)}</strong><small>{getFactionName(player.faction)}</small>
                    </span>
                    <span role="cell"><em className={player.isGhost ? 'is-dead' : 'is-alive'}>
                      {player.isGhost ? '已死亡' : '存活至结束'}
                    </em></span>
                    <span role="cell"><em className={player.win ? 'is-win' : 'is-loss'}>
                      {player.win ? '胜方' : '负方'}
                    </em></span>
                    <strong role="cell">{formatNumber(player.tasks, 0)}</strong>
                    <strong role="cell">{formatNumber(player.correctVotes, 0)}</strong>
                    <strong role="cell">{formatNumber(player.kills, 0)}</strong>
                    <strong role="cell">{formatNumber(player.turnsSurvived, 0)}</strong>
                    <strong role="cell">{formatNumber(player.discussions, 0)}</strong>
                    <strong role="cell">{formatNumber(player.sabotages, 0)}</strong>
                    <span className="stats-v2-row-anchor" aria-hidden="true">
                      {player.userId === focusedPlayerId ? '已定位' : ''}
                    </span>
                  </div>
                  ))}
                </div>
              </div>
            </section>

            {spectatorDetailPlayers.length > 0 && (
              <section className="stats-v2-spectators" aria-labelledby="spectators-title">
                <div>
                  <h3 id="spectators-title">观战者</h3>
                  <p>观战者不计入实际玩家人数，也不判断胜负</p>
                </div>
                <div>
                  {spectatorDetailPlayers.map(player => (
                    <div
                      key={player.userId}
                      className={`stats-v2-spectator-item ${
                        player.userId === focusedPlayerId ? 'is-focused' : ''}`}
                    >
                      <i aria-hidden="true">{player.nickname?.charAt(0) || '?'}</i>
                      <span><strong>{player.nickname || '未知玩家'}</strong><small>{maskUserId(player.userId)}</small></span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 回合信息 */}
            {matchData.rounds && matchData.rounds.length > 0 && (
              <section className="rounds-card rounds-v2" aria-labelledby="rounds-title">
                <div className="rounds-v2-heading">
                  <div>
                    <span className="stats-v2-eyebrow">MATCH TIMELINE</span>
                    <h3 id="rounds-title">回合记录</h3>
                    <p>按时间顺序查看会议发起、投票去向与最终结果</p>
                  </div>
                  <span className="rounds-v2-count">{matchData.rounds.length} 个回合</span>
                </div>
                <div className="rounds-v2-timeline">
                  {matchData.rounds.map((round, index) => {
                    const meeting = round.meetingInfo;
                    const starter = meeting ? matchData.playerData[meeting.starter] : null;
                    const resultPlayer = meeting && meeting.result !== 'skip'
                      ? matchData.playerData[meeting.result]
                      : null;
                    const voteEntries = meeting?.votes ? Object.entries(meeting.votes) : [];
                    const isSkipped = meeting?.result === 'skip';

                    return (
                      <article key={index} className="round-v2-item">
                        <div className="round-v2-rail" aria-hidden="true">
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          {index < matchData.rounds!.length - 1 && <i />}
                        </div>
                        <div className="round-v2-content">
                          <header className="round-v2-header">
                            <div>
                              <h4>第 {index + 1} 回合</h4>
                              <span>{formatTimestamp(round.startAt)} — {formatTimestamp(round.endAt)}</span>
                            </div>
                            <strong>{calculateDuration(round.startAt, round.endAt)}</strong>
                          </header>

                          {meeting ? (
                            <div className="round-v2-meeting">
                              <div className="round-v2-meeting-meta">
                                <span className={`round-v2-meeting-type ${meeting.type === 'Report' ? 'is-report' : 'is-emergency'}`}>
                                  <Icon name={meeting.type === 'Report' ? 'warning' : 'vote'} size={14} />
                                  {meeting.type === 'Report' ? '报告尸体' : '紧急会议'}
                                </span>
                                <span className="round-v2-starter">
                                  由
                                  <i className={`faction-${starter?.faction || 0}`}>{starter?.nickname?.charAt(0) || '?'}</i>
                                  <strong>{starter?.nickname || '未知玩家'}</strong>
                                  发起
                                </span>
                              </div>

                              <div className={`round-v2-outcome ${isSkipped ? 'is-skipped' : 'is-ejected'}`}>
                                <span className="round-v2-outcome-icon"><Icon name={isSkipped ? 'skip' : 'vote'} size={18} /></span>
                                <div>
                                  <small>本轮结论</small>
                                  <strong>{isSkipped ? '无人被放逐' : `${resultPlayer?.nickname || '未知玩家'} 被投票出局`}</strong>
                                </div>
                                <span>{isSkipped ? '平票或多数玩家选择跳过' : getFactionName(resultPlayer?.faction || 0)}</span>
                              </div>

                              {voteEntries.length > 0 && (
                                <div className="round-v2-votes">
                                  <div className="round-v2-votes-header">
                                    <span>投票明细</span>
                                    <small>{voteEntries.length} 票已记录</small>
                                  </div>
                                  <div className="round-v2-vote-list" role="table" aria-label={`第 ${index + 1} 回合投票明细`}>
                                    {voteEntries.map(([voterId, voteTarget]) => {
                                      const voter = matchData.playerData[voterId];
                                      const target = voteTarget !== 'skip' ? matchData.playerData[voteTarget] : null;
                                      const voteSkipped = voteTarget === 'skip';
                                      return (
                                        <div key={voterId} className="round-v2-vote-row" role="row">
                                          <span className="round-v2-vote-player" role="cell">
                                            <i className={`faction-${voter?.faction || 0}`}>{voter?.nickname?.charAt(0) || '?'}</i>
                                            <strong>{voter?.nickname || '未知玩家'}</strong>
                                          </span>
                                          <span className="round-v2-vote-direction" aria-hidden="true"><Icon name="arrowRight" size={13} /></span>
                                          <span className={`round-v2-vote-target ${voteSkipped ? 'is-skipped' : ''}`} role="cell">
                                            {voteSkipped ? (
                                              <><Icon name="skip" size={13} /><strong>跳过</strong></>
                                            ) : (
                                              <><i className={`faction-${target?.faction || 0}`}>{target?.nickname?.charAt(0) || '?'}</i><strong>{target?.nickname || '未知玩家'}</strong></>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="round-v2-no-meeting">本回合没有会议记录</div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 空状态 */}
        {!matchData && !matchLoading && !matchError && !matchHistoryLoading &&
          matchHistory.length === 0 && !playerStats && !matchHistoryError && (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="gamepad" size={42} /></div>
            <h3>{isConnected ? '账号已就绪' : '连接后直接查询'}</h3>
            <p>
              {isConnected
                ? '点击“查询我的战绩”，无需再查找 Token 或用户 ID。'
                : '应用会打开 Gaggle 登录窗口，并自动识别当前账号。'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default StatsTab;
