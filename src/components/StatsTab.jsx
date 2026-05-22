import { useState } from 'react';
import Logger from '../utils/logger';

const mapNameMapping = {
  1: '地下室',
  2: '鹅教堂',
  3: '马拉德庄园',
  4: '连结殖民地',
  5: '黑天鹅',
  6: '鹅飞船',
  7: '神庙',
  8: '沙漠',
  9: '血夜港湾',
  10: '伊格尔顿泉',
  11: '伊格尔顿泉-下水道',
  12: '嘉年华',
  13: '绿头鸭',
};

function StatsTab() {
  const [statsUrl] = useState('https://gaggle.fun/dashboard');
  const [matchData, setMatchData] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchIdInput, setMatchIdInput] = useState('');
  const [matchHistory, setMatchHistory] = useState([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [matchHistoryError, setMatchHistoryError] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);

  // 在外部浏览器中打开战绩网页
  const openStatsInBrowser = () => {
    if (statsUrl) {
      window.electronAPI.openExternal(statsUrl);
    }
  };

  // 查询对局数据
  const fetchMatchData = async (matchId) => {
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
        Logger.info(`Fetch match data - Match ID: ${result.data?.matchId || 'N/A'}`);
        Logger.info(`Fetch match data - Map: ${result.data?.map || 'N/A'}`);
        Logger.info(`Fetch match data - Has playerData: ${!!result.data?.playerData}`);

        setMatchData(result.data);
        setSelectedMatchId(result.data.matchId);

        Logger.info(`Fetch match data - Success: ${result.data.matchId}`);
        Logger.info(`Match info - Map: ${result.data.map}, Mode: ${result.data.mode}`);
        if (result.data.playerData) {
          Logger.info(`Player count: ${Object.keys(result.data.playerData).length}`);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      Logger.error(`Failed to fetch match data: ${error.message}`);
      setMatchError(`查询失败: ${error.message}`);

      // 开发测试：如果没有API，使用本地示例数据
      if (process.env.NODE_ENV === 'development') {
        Logger.info('Using sample match data for development');
      }
    } finally {
      setMatchLoading(false);
    }
  };

  // 获取对局历史列表
  const fetchMatchHistory = async (userId) => {
    if (!userId || !userId.trim()) {
      setMatchHistoryError('请输入用户ID');
      return;
    }

    setMatchHistoryLoading(true);
    setMatchHistoryError('');
    setMatchHistory([]);

    try {
      const result = await window.electronAPI.fetchMatchHistory(userId.trim());

      if (result.success) {
        const apiData = result.data;

        // 检查 API 返回结构
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
      setMatchHistoryError(`获取历史失败: ${error.message}`);
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

  // 获取角色名称映射
  const getRoleName = (roleId) => {
    const roleMap = {
      1: '鹅',
      2: '鸭子',
      3: '中立',
      8: '追踪者',
      11: '通灵者',
      13: '告密者',
      16: '秃鹫',
      17: '刺客',
      20: '保镖',
      23: '猎鹰',
      31: '正义使者',
      33: '忍者',
      50: '呆呆鸟',
      56: '警长',
      61: '加拿大鹅',
      66: '亡命徒',
      102: '模仿者',
      111: '食鸟'
    };
    return roleMap[roleId] || `未知(${roleId})`;
  };

  // 获取阵营名称
  const getFactionName = (factionId) => {
    const factionMap = {
      1: '鹅阵营',
      2: '鸭子阵营',
      3: '中立阵营',
      16: '特殊阵营'
    };
    return factionMap[factionId] || `未知(${factionId})`;
  };

  // 获取地图名称
  const getMapName = (mapId) => {
    return mapNameMapping[mapId] || `地图${mapId}`;
  };

  // 获取模式名称
  const getModeName = (modeId) => {
    const modeMap = {
      1: '标准模式',
      5: '快速模式'
    };
    return modeMap[modeId] || `模式${modeId}`;
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
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
  const calculateDuration = (startAt, endAt) => {
    if (!startAt || !endAt) return '-';
    const durationMs = endAt - startAt;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  };

  // 获取事件类型名称
  const getEventTypeName = (typeId) => {
    const typeMap = {
      0: '游戏结束',
      1: '玩家存活',
      2: '击杀',
      3: '投票踢出',
      6: '发现尸体',
      1002: '自爆',
      1013: '攻击',
      1014: '使用技能',
      1015: '特殊击杀'
    };
    return typeMap[typeId] || `事件(${typeId})`;
  };

  return (
    <section className="stats-section">
      <div className="stats-container">
        <div className="stats-header">
          <h2>战绩查询</h2>
          <button
            className="open-browser-btn"
            onClick={openStatsInBrowser}
            title="在系统浏览器中打开官网"
          >
            🌐 打开官网
          </button>
        </div>

        {/* 用户ID输入区域 */}
        <div className="match-query-section">
          <div className="query-input-group">
            <input
              type="text"
              className="match-id-input"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="输入用户ID (例如: EAeQEOfRs1PeDzJc7yKjjvpmDf42)"
              onKeyPress={(e) => e.key === 'Enter' && fetchMatchHistory(userIdInput)}
            />
            <button
              className="query-button"
              onClick={() => fetchMatchHistory(userIdInput)}
              disabled={matchHistoryLoading}
            >
              {matchHistoryLoading ? '加载中...' : '查询历史'}
            </button>
          </div>

          {/* 对局ID快速查询 */}
          <div className="query-input-group" style={{ marginTop: '10px' }}>
            <input
              type="text"
              className="match-id-input"
              value={matchIdInput}
              onChange={(e) => setMatchIdInput(e.target.value)}
              placeholder="或直接输入对局ID快速查询 (例如: V05628042026637780784)"
              onKeyPress={(e) => e.key === 'Enter' && fetchMatchData(matchIdInput)}
            />
            <button
              className="query-button"
              onClick={() => fetchMatchData(matchIdInput)}
              disabled={matchLoading}
            >
              {matchLoading ? '加载中...' : '查询对局'}
            </button>
          </div>
        </div>

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
            <div className="error-icon">⚠️</div>
            <p>{matchHistoryError}</p>
          </div>
        )}

        {/* 玩家统计卡片 - 仅在没有查看详情时显示 */}
        {playerStats && !matchHistoryLoading && !matchData && (
          <div className="player-stats-card">
            <div className="stats-header-section">
              <div className="player-level">
                <span className="level-badge">Lv.{playerStats.playerLv}</span>
                <span className="total-games">总场次: {playerStats.totalGamePlayed}</span>
              </div>
              <div className="achievement-progress">
                <span>成就: {playerStats.achievement.completed}/{playerStats.achievement.total}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(playerStats.achievement.completed / playerStats.achievement.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{playerStats.winRate}%</div>
                <div className="stat-label">胜率</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{playerStats.votingAccuracy}%</div>
                <div className="stat-label">投票准确率</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{playerStats.turnsSurvived}</div>
                <div className="stat-label">平均存活回合</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{playerStats.kills}</div>
                <div className="stat-label">平均击杀</div>
              </div>
            </div>

            <div className="roles-breakdown">
              <h4>角色分布</h4>
              <div className="role-stats">
                <div className="role-stat-item goose">
                  <span className="role-label">🪿 鹅</span>
                  <span className="role-detail">
                    {playerStats.rolesBreakdown.goose.timesPlayed}场 / {playerStats.rolesBreakdown.goose.winRate}%胜率
                  </span>
                </div>
                <div className="role-stat-item duck">
                  <span className="role-label">🦆 鸭</span>
                  <span className="role-detail">
                    {playerStats.rolesBreakdown.duck.timesPlayed}场 / {playerStats.rolesBreakdown.duck.winRate}%胜率
                  </span>
                </div>
                <div className="role-stat-item neutral">
                  <span className="role-label">🎭 中立</span>
                  <span className="role-detail">
                    {playerStats.rolesBreakdown.neutral.timesPlayed}场 / {playerStats.rolesBreakdown.neutral.winRate}%胜率
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 对局历史列表 - 仅在没有查看详情时显示 */}
        {matchHistory.length > 0 && !matchHistoryLoading && !matchData && (
          <div className="match-history-section">
            <div className="match-history-header">
              <h3>📋 最近20场对局</h3>
              <span className="match-count">共 {matchHistory.length} 场</span>
            </div>
            <div className="match-history-list">
              {/* 表头 */}
              <div className="match-history-header-row">
                <div className="header-player">玩家</div>
                <div className="header-result">胜/负</div>
                <div className="header-date">日期</div>
                <div className="header-players">玩家人数</div>
                <div className="header-turns">存活回合</div>
                <div className="header-arrow"></div>
              </div>

              {matchHistory.map((match, index) => {
                const isSelected = selectedMatchId === match.matchId;
                const matchDate = new Date(match.startAt || match.timestamp);

                return (
                  <div
                    key={match.matchId || index}
                    className={`match-history-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectMatch(match.matchId)}
                  >
                    <div className="match-role-info">
                      <div className="role-avatar">
                        <span className="role-icon">🎭</span>
                      </div>
                      <div className="role-details">
                        <span className="role-name">{getRoleName(match.role) || '未知角色'}</span>
                        <span className="role-map">{getMapName(match.map)} | {getModeName(match.mode)}</span>
                      </div>
                    </div>

                    <div className="match-result">
                      <span className={`result-badge ${match.win ? 'win' : 'lose'}`}>
                        {match.win ? '胜利' : '失败'}
                      </span>
                    </div>

                    <div className="match-date">
                      {matchDate.toLocaleDateString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric'
                      })}
                    </div>

                    <div className="match-players">
                      {match.playerCount || Object.keys(match.playerData || {}).length}
                    </div>

                    <div className="match-turns">
                      {match.turnsSurvived || '-'}
                    </div>

                    <div className="match-arrow">
                      →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <div className="error-icon">⚠️</div>
            <p>{matchError}</p>
          </div>
        )}

        {/* 对局数据详情展示 */}
        {matchData && !matchLoading && (
          <div className="match-data-display">
            {/* 返回按钮 */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className="query-button"
                onClick={() => {
                  setMatchData(null);
                  setMatchIdInput('');
                }}
                style={{ background: '#666', border: 'none', padding: '8px 16px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                ← 返回历史列表
              </button>
              <span style={{ color: '#00d4ff', fontSize: '14px' }}>正在查看对局详情: {matchData.matchId}</span>
            </div>

            {/* 对局基本信息 */}
            <div className="match-info-card">
              <h3>📊 对局信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">对局ID:</span>
                  <span className="info-value">{matchData.matchId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">地图:</span>
                  <span className="info-value">{getMapName(matchData.map)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">模式:</span>
                  <span className="info-value">{getModeName(matchData.mode)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">获胜方:</span>
                  <span className="info-value">{getFactionName(matchData.winningFaction)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">开始时间:</span>
                  <span className="info-value">{formatTimestamp(matchData.startAt)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">结束时间:</span>
                  <span className="info-value">{formatTimestamp(matchData.endAt)}</span>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">游戏时长:</span>
                  <span className="info-value">{calculateDuration(matchData.startAt, matchData.endAt)}</span>
                </div>
              </div>
            </div>

            {/* 玩家列表 */}
            <div className="players-card">
              <h3>玩家列表 ({Object.keys(matchData.playerData).length}人)</h3>
              <div className="players-list">
                {Object.values(matchData.playerData).map((player) => (
                  <div
                    key={player.userId}
                    className={`player-card ${player.win ? 'winner' : ''} faction-${player.faction}`}
                  >
                    <div className="player-header">
                      <div className="player-info">
                        <span className="player-nickname">{player.nickname}</span>
                        <span className={`player-role role-${player.faction}`}>
                          {getRoleName(player.role)}
                        </span>
                      </div>
                      <div className="player-status">
                        {player.isGhost && <span className="status-ghost">👻 已死亡</span>}
                        {!player.isGhost && <span className="status-alive">✅ 存活</span>}
                        {player.win && <span className="status-win">🏆 胜利</span>}
                      </div>
                    </div>
                    <div className="player-stats">
                      <div className="stat-item">
                        <span className="stat-label">击杀:</span>
                        <span className="stat-value">{player.kills}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">任务:</span>
                        <span className="stat-value">{player.tasks}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">正确投票:</span>
                        <span className="stat-value">{player.correctVotes}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">存活回合:</span>
                        <span className="stat-value">{player.turnsSurvived}</span>
                      </div>
                      {player.discussions > 0 && (
                        <div className="stat-item">
                          <span className="stat-label">发言:</span>
                          <span className="stat-value">{player.discussions}</span>
                        </div>
                      )}
                      {player.sabotages > 0 && (
                        <div className="stat-item">
                          <span className="stat-label">破坏:</span>
                          <span className="stat-value">{player.sabotages}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 回合信息 */}
            {matchData.rounds && matchData.rounds.length > 0 && (
              <div className="rounds-card">
                <h3>回合信息 ({matchData.rounds.length}回合)</h3>
                <div className="rounds-list">
                  {matchData.rounds.map((round, index) => (
                    <div key={index} className="round-card">
                      <div className="round-header">
                        <h4>第 {index + 1} 回合</h4>
                        <span className="round-duration">
                          {calculateDuration(round.startAt, round.endAt)}
                        </span>
                      </div>

                      {/* 会议信息 */}
                      {round.meetingInfo && (
                        <div className="meeting-info">
                          <div className="meeting-header">
                            <div className="meeting-type">
                              <span className="meeting-icon">
                                {round.meetingInfo.type === 'Report' ? '📢' : '🚨'}
                              </span>
                              <span className="meeting-type-text">
                                {round.meetingInfo.type === 'Report' ? '报告尸体' : '紧急会议'}
                              </span>
                            </div>
                            <div className="meeting-starter">
                              <span className="label">发起人:</span>
                              <span
                                className={`player-name-tag faction-${matchData.playerData[round.meetingInfo.starter]?.faction || 0}`}
                              >
                                {matchData.playerData[round.meetingInfo.starter]?.nickname || '未知'}
                              </span>
                            </div>
                          </div>

                          <div className="meeting-result-section">
                            <div className="result-label">投票结果</div>
                            <div className={`result-value ${round.meetingInfo.result === 'skip' ? 'skip' : ''}`}>
                              {round.meetingInfo.result === 'skip' ? '⏭️ 平票/跳过' :
                               <>
                                 <span className="result-icon">🗳️</span>
                                 <span
                                   className={`player-name-tag faction-${matchData.playerData[round.meetingInfo.result]?.faction || 0}`}
                                 >
                                   {matchData.playerData[round.meetingInfo.result]?.nickname || '未知'}
                                 </span>
                                 <span className="result-action">被投票出局</span>
                               </>}
                            </div>
                          </div>

                          {/* 投票详情 - 优化版 */}
                          {round.meetingInfo.votes && (
                            <div className="votes-detail-enhanced">
                              <div className="votes-header">
                                <span className="votes-title">📊 投票详情</span>
                                <span className="votes-count">
                                  共 {Object.keys(round.meetingInfo.votes).length} 人投票
                                </span>
                              </div>
                              <div className="votes-grid-enhanced">
                                {Object.entries(round.meetingInfo.votes).map(([voterId, voteTarget]) => {
                                  const voter = matchData.playerData[voterId];
                                  const target = voteTarget !== 'skip' ? matchData.playerData[voteTarget] : null;
                                  const isSkip = voteTarget === 'skip';

                                  return (
                                    <div key={voterId} className={`vote-card ${isSkip ? 'vote-skip' : ''}`}>
                                      <div className="vote-row">
                                        <div className="voter-section">
                                          <span
                                            className={`voter-avatar faction-${voter?.faction || 0}`}
                                          >
                                            {voter?.nickname?.charAt(0) || '?'}
                                          </span>
                                          <span
                                            className={`voter-name faction-${voter?.faction || 0}`}
                                          >
                                            {voter?.nickname || '未知'}
                                          </span>
                                        </div>
                                        <div className="vote-arrow-container">
                                          <span className="vote-arrow">▶</span>
                                        </div>
                                        <div className="target-section">
                                          {isSkip ? (
                                            <span className="target-skip">⏭️ 跳过</span>
                                          ) : (
                                            <>
                                              <span
                                                className={`target-avatar faction-${target?.faction || 0}`}
                                              >
                                                {target?.nickname?.charAt(0) || '?'}
                                              </span>
                                              <span
                                                className={`target-name faction-${target?.faction || 0}`}
                                              >
                                                {target?.nickname || '未知'}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 空状态 */}
        {!matchData && !matchLoading && !matchError && (
          <div className="empty-state">
            <div className="empty-icon">🎮</div>
            <h3>请输入对局ID或用户ID查询战绩</h3>
            <p>• 输入用户ID查询历史对局列表<br/>• 直接输入对局ID快速查询详细数据<br/>• 或从历史列表中点击对局查看详情</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default StatsTab;
