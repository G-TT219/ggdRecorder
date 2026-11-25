import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Logger from '../utils/logger';
import Icon from './Icon';
import { emitAppError, emitAppToast } from './WorkspaceShell';
import type { Recording, RecordingNotes, FavoriteGroup, FavoriteRecordingGroups, RecordingThumbnails } from '../types/electron-api';

type RecordingsTabProps = {
  recordings: Recording[];
  recordingThumbnails: RecordingThumbnails;
  favoriteRecordings: string[];
  recordingNotes: RecordingNotes;
  favoriteGroups: FavoriteGroup[];
  favoriteRecordingGroups: FavoriteRecordingGroups;
  initialSelectedRecordingId?: string | null;
  isReviewMode?: boolean;
  onConsumeInitialRecording?: () => void;
  onLoadThumbnails: (recordings: Recording[]) => void;
  onRefreshRecordings: () => void;
  onRefreshFavorites: () => Promise<void> | void;
  onEnterReview?: () => void;
};

type ParsedTimestamp = {
  label: string;
  seconds: number;
};

const formatPlaybackTimestamp = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const extractTimestampsFromNote = (text: string): ParsedTimestamp[] => {
  const regex = /\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]/g;
  const seen = new Set<number>();
  const items: ParsedTimestamp[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const h = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    if (s >= 60 || m >= 60) continue;
    const seconds = h * 3600 + m * 60 + s;
    if (!seen.has(seconds)) {
      seen.add(seconds);
      items.push({ label: formatPlaybackTimestamp(seconds), seconds });
    }
  }
  return items.sort((a, b) => a.seconds - b.seconds);
};

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

function RecordingsTab({
  recordings,
  recordingThumbnails,
  favoriteRecordings,
  recordingNotes = {},
  favoriteGroups = [],
  favoriteRecordingGroups = {},
  initialSelectedRecordingId,
  isReviewMode = false,
  onConsumeInitialRecording,
  onLoadThumbnails,
  onRefreshRecordings,
  onRefreshFavorites,
  onEnterReview,
}: RecordingsTabProps) {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [selectedRecordings, setSelectedRecordings] = useState<Recording[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string>('all'); // 'all' | 'favorites' | 'ungrouped' | groupId
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordingsPerPage] = useState(18);

  const recordingsListRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedScrollTopRef = useRef(0);

  const loadRecordingUrl = async (filePath: string) => {
    try {
      const result = await window.electronAPI.getRecordingUrl(filePath);
      if (result.success) {
        setRecordingUrl(result.url);
      } else {
        Logger.error('Error loading recording URL:', result.error);
        emitAppError('无法读取录像流地址');
      }
    } catch (error) {
      Logger.error('Error loading recording URL:', error);
    }
  };

  useEffect(() => {
    if (!initialSelectedRecordingId) return;
    const found = recordings.find(item => item.id === initialSelectedRecordingId);
    if (found) {
      setSelectedRecording(found);
      onConsumeInitialRecording?.();
    }
  }, [initialSelectedRecordingId, recordings, onConsumeInitialRecording]);

  useEffect(() => {
    if (selectedRecording) {
      loadRecordingUrl(selectedRecording.filePath);
      setNoteDraft(recordingNotes[selectedRecording.id] || '');
      setPlaybackRate(1);
    } else {
      setRecordingUrl(null);
      setNoteDraft('');
    }
  }, [selectedRecording, recordingNotes]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, recordingUrl]);

  // Keyboard shortcuts inside Cinema Player (Space play/pause, Left/Right ±5s, Ctrl+S save note)
  const saveRecordingNote = useCallback(async () => {
    if (!selectedRecording) return;
    try {
      setNoteSaving(true);
      const result = await window.electronAPI.saveRecordingNote(selectedRecording.id, noteDraft);
      if (result.success) {
        onRefreshFavorites();
        Logger.info('Recording note saved');
        emitAppToast('复盘笔记已保存', 'success');
      } else {
        Logger.error('Failed to save note:', result.error);
        emitAppError('保存备注失败: ' + result.error);
      }
    } catch (error) {
      Logger.error('Error saving recording note:', error);
      emitAppError('保存备注时发生错误: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setNoteSaving(false);
    }
  }, [noteDraft, onRefreshFavorites, selectedRecording]);

  useEffect(() => {
    if (!selectedRecording) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRecordingNote();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const video = videoRef.current;
      if (!video) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (video.paused) video.play().catch(() => undefined);
        else video.pause();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        video.currentTime = Math.min(video.duration || video.currentTime + 5, video.currentTime + 5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveRecordingNote, selectedRecording]);

  const selectedFavoriteGroup = favoriteGroups.find(group => group.id === collectionFilter);
  const noteTimestamps = useMemo(() => extractTimestampsFromNote(noteDraft), [noteDraft]);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const megabytes = bytes / (1024 * 1024);
    return megabytes >= 1024
      ? `${(megabytes / 1024).toFixed(1)} GB`
      : `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
  };

  const filteredRecordings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return recordings.filter(recording => {
      const recordingDate = new Date(recording.date);

      if (q) {
        const noteText = (recordingNotes[recording.id] || '').toLowerCase();
        if (!recording.name.toLowerCase().includes(q) && !noteText.includes(q)) return false;
      }

      if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        if (recordingDate < startDateObj) return false;
      }

      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        if (recordingDate > endDateObj) return false;
      }

      if (collectionFilter !== 'all') {
        if (!favoriteRecordings.includes(recording.id)) return false;
        if (collectionFilter === 'ungrouped') return !favoriteRecordingGroups[recording.id];
        if (collectionFilter !== 'favorites') return favoriteRecordingGroups[recording.id] === collectionFilter;
      }

      return true;
    });
  }, [recordings, searchQuery, recordingNotes, startDate, endDate, collectionFilter, favoriteRecordings, favoriteRecordingGroups]);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredRecordings.length / recordingsPerPage));
    setTotalPages(pages);
    if (currentPage > pages) setCurrentPage(1);
  }, [filteredRecordings.length, recordingsPerPage, currentPage]);

  const currentPageRecordings = useMemo(() => {
    if (collectionFilter !== 'all') return filteredRecordings;
    const startIndex = (currentPage - 1) * recordingsPerPage;
    return filteredRecordings.slice(startIndex, startIndex + recordingsPerPage);
  }, [filteredRecordings, currentPage, recordingsPerPage, collectionFilter]);

  useEffect(() => {
    onLoadThumbnails(currentPageRecordings);
  }, [currentPageRecordings, onLoadThumbnails]);

  const insertCurrentTimestamp = () => {
    const currentSeconds = videoRef.current?.currentTime || 0;
    const stamp = `[${formatPlaybackTimestamp(currentSeconds)}] `;
    setNoteDraft(prev => {
      const prefix = prev.length > 0 && !prev.endsWith('\n') ? `${prev}\n` : prev;
      return `${prefix}${stamp}`;
    });
    requestAnimationFrame(() => {
      const el = noteTextareaRef.current;
      if (el) {
        el.focus();
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      }
    });
  };

  const seekToSeconds = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => undefined);
    }
  };

  const deleteRecording = async (recording: Recording) => {
    try {
      const isFavorite = favoriteRecordings.includes(recording.id);
      if (isFavorite) {
        const confirmed = window.confirm(`${recording.name} 已被收藏\n\n确定要删除这个收藏的录像吗？此操作不可恢复。`);
        if (!confirmed) return;
      }
      const result = await window.electronAPI.deleteRecording(recording.id);
      if (result.success) {
        Logger.info('Recording deleted successfully');
        emitAppToast('录像已删除', 'info');
        onRefreshRecordings();
        onRefreshFavorites();
        if (selectedRecording && selectedRecording.id === recording.id) {
          setSelectedRecording(null);
          setRecordingUrl(null);
        }
        setSelectedRecordings(prev => prev.filter(r => r.id !== recording.id));
      } else {
        Logger.error('Failed to delete recording:', result.error);
        emitAppError('删除录像失败');
      }
    } catch (error) {
      Logger.error('Error deleting recording:', error);
    }
  };

  const toggleFavoriteRecording = async (recording: Recording) => {
    try {
      const isFavorite = favoriteRecordings.includes(recording.id);
      const result = await window.electronAPI.toggleFavoriteRecording(recording.id, !isFavorite);
      if (result.success) {
        onRefreshFavorites();
        emitAppToast(!isFavorite ? '已加入收藏' : '已取消收藏', 'success');
      } else {
        Logger.error('Failed to toggle favorite:', result.error);
      }
    } catch (error) {
      Logger.error('Error toggling favorite recording:', error);
    }
  };

  const createFavoriteGroup = async () => {
    const groupName = newGroupName.trim();
    if (!groupName) {
      emitAppError('请先输入分组名称');
      return;
    }
    try {
      setIsCreatingGroup(true);
      const result = await window.electronAPI.createFavoriteGroup(groupName);
      if (result.success) {
        setNewGroupName('');
        setShowNewGroupInput(false);
        await onRefreshFavorites();
        emitAppToast(`已创建收藏分组「${groupName}」`, 'success');
      } else {
        emitAppError('创建分组失败: ' + result.error);
      }
    } catch (error) {
      emitAppError('创建分组时发生错误: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const renameFavoriteGroup = async () => {
    if (!selectedFavoriteGroup) return;
    const name = window.prompt('输入新的分组名称', selectedFavoriteGroup.name);
    if (!name || !name.trim()) return;
    try {
      const result = await window.electronAPI.renameFavoriteGroup(selectedFavoriteGroup.id, name.trim());
      if (result.success) {
        onRefreshFavorites();
        emitAppToast(`分组已重命名为「${name.trim()}」`, 'success');
      } else {
        emitAppError('重命名分组失败: ' + result.error);
      }
    } catch (error) {
      emitAppError('重命名分组失败');
    }
  };

  const deleteFavoriteGroup = async () => {
    if (!selectedFavoriteGroup) return;
    if (!window.confirm(`确定要删除收藏分组「${selectedFavoriteGroup.name}」吗？分组内录像仍会保持收藏。`)) return;
    try {
      const result = await window.electronAPI.deleteFavoriteGroup(selectedFavoriteGroup.id);
      if (result.success) {
        setCollectionFilter('favorites');
        onRefreshFavorites();
        emitAppToast('收藏分组已删除', 'info');
      } else {
        emitAppError('删除分组失败: ' + result.error);
      }
    } catch (error) {
      emitAppError('删除分组失败');
    }
  };

  const setRecordingFavoriteGroup = async (recording: Recording, groupId: string) => {
    try {
      const result = await window.electronAPI.setRecordingFavoriteGroup(recording.id, groupId || null);
      if (result.success) {
        onRefreshFavorites();
      } else {
        emitAppError('设置分组失败: ' + result.error);
      }
    } catch (error) {
      emitAppError('设置分组失败');
    }
  };

  const handleOpenPlayer = (recording: Recording, openReview = false) => {
    if (recordingsListRef.current) {
      savedScrollTopRef.current = recordingsListRef.current.scrollTop;
    }
    setSelectedRecording(recording);
    if (openReview && onEnterReview) {
      onEnterReview();
    }
  };

  const handleReturnToList = () => {
    setSelectedRecording(null);
    setRecordingUrl(null);
    requestAnimationFrame(() => {
      if (recordingsListRef.current) {
        recordingsListRef.current.scrollTop = savedScrollTopRef.current;
      }
    });
  };

  const saveFavoriteToDirectory = async (recording: Recording) => {
    try {
      const result = await window.electronAPI.saveFavoriteToDirectory(recording.filePath, recording.name);
      if (result.success) {
        emitAppToast(`已导出至 ${result.savePath}`, 'success', '另存成功');
      } else if (!result.canceled) {
        emitAppError('保存录像失败: ' + result.error);
      }
    } catch (error) {
      emitAppError('保存录像时发生错误');
    }
  };

  const batchDeleteRecordings = async () => {
    if (selectedRecordings.length === 0) {
      emitAppError('请先选择要删除的录像');
      return;
    }
    const favorited = selectedRecordings.filter(r => favoriteRecordings.includes(r.id));
    const toDelete = selectedRecordings.filter(r => !favoriteRecordings.includes(r.id));
    if (!window.confirm(`确定要删除选中的 ${toDelete.length} 个录像吗？已自动保护 ${favorited.length} 个收藏录像。此操作不可恢复。`)) {
      return;
    }
    let successCount = 0;
    let failCount = 0;
    for (const recording of toDelete) {
      const result = await window.electronAPI.deleteRecording(recording.id);
      if (result.success) successCount++;
      else failCount++;
    }
    setSelectedRecordings([]);
    setIsSelectMode(false);
    onRefreshRecordings();
    emitAppToast(`已删除 ${successCount} 个录像${failCount > 0 ? `，${failCount} 个失败` : ''}`, failCount > 0 ? 'warning' : 'success');
  };

  const toggleSelectMode = () => {
    if (isSelectMode) setSelectedRecordings([]);
    setIsSelectMode(!isSelectMode);
  };

  const toggleRecordingSelection = (recording: Recording) => {
    setSelectedRecordings(prev =>
      prev.some(r => r.id === recording.id)
        ? prev.filter(r => r.id !== recording.id)
        : [...prev, recording]
    );
  };

  const selectAllRecordings = () => {
    if (selectedRecordings.length === filteredRecordings.length) setSelectedRecordings([]);
    else setSelectedRecordings([...filteredRecordings]);
  };

  return (
    <section className={`cinema-section ${isReviewMode ? 'is-review-pane' : ''}`} ref={recordingsListRef}>
      {selectedRecording ? (
        <div className="cinema-theater">
          <div className="cinema-theater-bar">
            <button type="button" className="cinema-pill-btn" onClick={handleReturnToList}>
              <span aria-hidden="true">←</span>
              <span>返回影院</span>
            </button>
            <div className="cinema-theater-title">
              <h3>{selectedRecording.name}</h3>
              <small>
                {new Date(selectedRecording.date).toLocaleString('zh-CN')} · {formatFileSize(selectedRecording.size)}
              </small>
            </div>
            <div className="cinema-theater-controls">
              <div className="cinema-speed-group" aria-label="倍速播放">
                {PLAYBACK_RATES.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    className={playbackRate === rate ? 'is-active' : ''}
                    onClick={() => setPlaybackRate(rate)}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
              {onEnterReview && !isReviewMode && (
                <button type="button" className="cinema-primary-btn" onClick={onEnterReview}>
                  <Icon name="split" size={14} />
                  <span>地图分屏复盘</span>
                </button>
              )}
            </div>
          </div>

          <div className="cinema-theater-grid">
            <div className="cinema-stage-well">
              {recordingUrl ? (
                <>
                  <div className="cinema-video-frame">
                    <video ref={videoRef} controls autoPlay src={recordingUrl}>
                      您的浏览器不支持视频播放。
                    </video>
                  </div>
                  <div className="cinema-player-hints">
                    <span><kbd>Space</kbd> 播放 / 暂停</span>
                    <span><kbd>←</kbd> <kbd>→</kbd> 快退 / 快进 5 秒</span>
                    <span><kbd>Ctrl</kbd>+<kbd>S</kbd> 保存笔记</span>
                  </div>
                </>
              ) : (
                <div className="player-loading">
                  <div className="loading-spinner" />
                  <span>正在加载录像流…</span>
                </div>
              )}
            </div>

            <aside className="cinema-notebook">
              <div className="cinema-notebook-head">
                <div>
                  <span className="studio-card-eyebrow">REVIEW NOTES</span>
                  <h4>复盘笔记</h4>
                </div>
                <div className="cinema-notebook-quick">
                  <button
                    type="button"
                    className={`cinema-icon-pill ${favoriteRecordings.includes(selectedRecording.id) ? 'is-favorited' : ''}`}
                    onClick={() => toggleFavoriteRecording(selectedRecording)}
                    title={favoriteRecordings.includes(selectedRecording.id) ? '取消收藏' : '加入收藏'}
                  >
                    <Icon name={favoriteRecordings.includes(selectedRecording.id) ? 'starFilled' : 'star'} size={14} />
                  </button>
                  {favoriteRecordings.includes(selectedRecording.id) && (
                    <button
                      type="button"
                      className="cinema-icon-pill"
                      onClick={() => saveFavoriteToDirectory(selectedRecording)}
                      title="另存到指定目录"
                    >
                      <Icon name="folder" size={14} />
                    </button>
                  )}
                </div>
              </div>

              {favoriteRecordings.includes(selectedRecording.id) && favoriteGroups.length > 0 && (
                <div className="cinema-notebook-group">
                  <span>收藏分组</span>
                  <select
                    value={favoriteRecordingGroups[selectedRecording.id] || ''}
                    onChange={e => setRecordingFavoriteGroup(selectedRecording, e.target.value)}
                  >
                    <option value="">未分组</option>
                    {favoriteGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="cinema-timestamp-bar">
                <button type="button" className="cinema-stamp-btn" onClick={insertCurrentTimestamp}>
                  <Icon name="clock" size={13} />
                  <span>+ 插入当前时间戳</span>
                </button>
                <button
                  type="button"
                  className="cinema-save-note-btn"
                  onClick={saveRecordingNote}
                  disabled={noteSaving}
                >
                  {noteSaving ? '保存中…' : '保存笔记'}
                </button>
              </div>

              {noteTimestamps.length > 0 && (
                <div className="cinema-timestamp-chips" aria-label="笔记时间跳转点">
                  {noteTimestamps.map(item => (
                    <button
                      key={item.seconds}
                      type="button"
                      className="cinema-time-chip"
                      onClick={() => seekToSeconds(item.seconds)}
                      title={`跳转到 ${item.label}`}
                    >
                      <Icon name="play" size={10} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={noteTextareaRef}
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                rows={isReviewMode ? 5 : 10}
                className="cinema-notebook-textarea"
                placeholder="点击上方“+ 插入当前时间戳”记录关键事件，例如：&#10;[02:18] 3号和7号双人进电力室&#10;[04:05] 警长误刀，鸭子趁乱钻管道"
              />
            </aside>
          </div>
        </div>
      ) : (
        <div className="cinema-library">
          {/* Top Collection Bar */}
          <div className="cinema-toolbar">
            <div className="cinema-collection-pills" role="tablist" aria-label="录像合集筛选">
              <button
                type="button"
                role="tab"
                aria-selected={collectionFilter === 'all'}
                className={collectionFilter === 'all' ? 'is-active' : ''}
                onClick={() => setCollectionFilter('all')}
              >
                全部录像 <span>{recordings.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={collectionFilter === 'favorites'}
                className={collectionFilter === 'favorites' ? 'is-active' : ''}
                onClick={() => setCollectionFilter('favorites')}
              >
                <Icon name="starFilled" size={12} /> 全部收藏 <span>{favoriteRecordings.length}</span>
              </button>
              {favoriteGroups.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={collectionFilter === 'ungrouped'}
                  className={collectionFilter === 'ungrouped' ? 'is-active' : ''}
                  onClick={() => setCollectionFilter('ungrouped')}
                >
                  未分组
                </button>
              )}
              {favoriteGroups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={collectionFilter === group.id}
                  className={collectionFilter === group.id ? 'is-active' : ''}
                  onClick={() => setCollectionFilter(group.id)}
                >
                  {group.name}
                </button>
              ))}

              {showNewGroupInput ? (
                <div className="cinema-inline-group-form">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createFavoriteGroup();
                      if (e.key === 'Escape') setShowNewGroupInput(false);
                    }}
                    placeholder="分组名称…"
                    maxLength={24}
                  />
                  <button type="button" onClick={createFavoriteGroup} disabled={isCreatingGroup}>创建</button>
                  <button type="button" className="is-cancel" onClick={() => setShowNewGroupInput(false)}>×</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cinema-add-group-pill"
                  onClick={() => setShowNewGroupInput(true)}
                >
                  + 新建分组
                </button>
              )}
            </div>

            <div className="cinema-toolbar-actions">
              <div className="cinema-search-box">
                <Icon name="search" size={13} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索录像或备注…"
                  aria-label="搜索录像或备注"
                />
              </div>
              <button
                type="button"
                className={`cinema-pill-btn ${showDateFilters || startDate || endDate ? 'is-active' : ''}`}
                onClick={() => setShowDateFilters(v => !v)}
                title="按日期范围筛选"
              >
                <Icon name="clock" size={13} />
                <span>日期</span>
              </button>
              <button
                type="button"
                className={`cinema-pill-btn ${isSelectMode ? 'is-active' : ''}`}
                onClick={toggleSelectMode}
              >
                <Icon name="check" size={13} />
                <span>{isSelectMode ? '退出批量' : '批量管理'}</span>
              </button>
              <button type="button" className="cinema-pill-btn" onClick={onRefreshRecordings} title="刷新录像列表">
                <Icon name="refresh" size={13} />
              </button>
            </div>
          </div>

          {selectedFavoriteGroup && (
            <div className="cinema-subbar">
              <span>当前分组：<strong>{selectedFavoriteGroup.name}</strong></span>
              <div className="cinema-subbar-actions">
                <button type="button" onClick={renameFavoriteGroup}>重命名分组</button>
                <button type="button" className="is-danger" onClick={deleteFavoriteGroup}>删除分组</button>
              </div>
            </div>
          )}

          {(showDateFilters || isSelectMode) && (
            <div className="cinema-subbar">
              {showDateFilters && (
                <div className="cinema-date-range">
                  <label>
                    <span>开始</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </label>
                  <span>—</span>
                  <label>
                    <span>结束</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </label>
                  {(startDate || endDate) && (
                    <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }}>清空日期</button>
                  )}
                </div>
              )}

              {isSelectMode && (
                <div className="cinema-batch-bar">
                  <span>已选 <strong>{selectedRecordings.length}</strong> / {filteredRecordings.length}</span>
                  <button type="button" onClick={selectAllRecordings}>
                    {selectedRecordings.length === filteredRecordings.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={selectedRecordings.length === 0}
                    onClick={batchDeleteRecordings}
                  >
                    <Icon name="trash" size={13} /> 删除所选
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 16:9 Cinema Poster Grid */}
          {filteredRecordings.length === 0 ? (
            <div className="cinema-empty-card">
              <img src="./assets/role-icons/Detective.png" alt="" draggable={false} />
              <strong>{recordings.length === 0 ? '录像影院还是空的' : '当前筛选下没有匹配的录像'}</strong>
              <p>
                {recordings.length === 0
                  ? '前往「录制台」锁定鹅鸭杀窗口，按下 Ctrl+Shift+S 录下你的高光对局。'
                  : '试试切换“全部录像”或清空搜索关键词与日期筛选。'}
              </p>
            </div>
          ) : (
            <div className="cinema-poster-grid">
              {currentPageRecordings.map(recording => {
                const isFav = favoriteRecordings.includes(recording.id);
                const isChecked = selectedRecordings.some(r => r.id === recording.id);
                const note = recordingNotes[recording.id];
                return (
                  <article
                    key={recording.id}
                    className={`cinema-card ${isFav ? 'is-favorite' : ''} ${isSelectMode ? 'is-selectable' : ''} ${isChecked ? 'is-checked' : ''}`}
                    onClick={() => isSelectMode && toggleRecordingSelection(recording)}
                  >
                    <div
                      className="cinema-poster"
                      onClick={() => !isSelectMode && handleOpenPlayer(recording, false)}
                    >
                      {recordingThumbnails[recording.id] ? (
                        <img
                          src={`data:image/png;base64,${recordingThumbnails[recording.id]}`}
                          alt={recording.name}
                          className="cinema-poster-img"
                        />
                      ) : (
                        <div className="cinema-poster-placeholder">
                          <Icon name="film" size={28} />
                        </div>
                      )}

                      <span className="cinema-size-pill">{formatFileSize(recording.size)}</span>

                      {isFav && (
                        <span className="cinema-fav-ribbon" title="已收藏">
                          <Icon name="starFilled" size={13} />
                        </span>
                      )}

                      {isSelectMode && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={e => e.stopPropagation()}
                          onChange={() => toggleRecordingSelection(recording)}
                          className="cinema-checkbox"
                          aria-label={`选择 ${recording.name}`}
                        />
                      )}

                      {!isSelectMode && (
                        <div className="cinema-poster-overlay">
                          <button
                            type="button"
                            className="cinema-overlay-play"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenPlayer(recording, false);
                            }}
                          >
                            <Icon name="play" size={14} /> 播放
                          </button>
                          {onEnterReview && !isReviewMode && (
                            <button
                              type="button"
                              className="cinema-overlay-review"
                              onClick={e => {
                                e.stopPropagation();
                                handleOpenPlayer(recording, true);
                              }}
                            >
                              <Icon name="split" size={13} /> 分屏复盘
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="cinema-card-body">
                      <h3 title={recording.name}>{recording.name}</h3>
                      <div className="cinema-card-meta">
                        <span>{new Date(recording.date).toLocaleString('zh-CN')}</span>
                      </div>
                      {note && (
                        <p className="cinema-note-snippet" title={note}>
                          {note}
                        </p>
                      )}
                      {isFav && favoriteGroups.length > 0 && !isSelectMode && (
                        <div className="cinema-card-group">
                          <select
                            value={favoriteRecordingGroups[recording.id] || ''}
                            onChange={e => setRecordingFavoriteGroup(recording, e.target.value)}
                            aria-label="选择收藏分组"
                          >
                            <option value="">未分组</option>
                            {favoriteGroups.map(group => (
                              <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {!isSelectMode && (
                        <div className="cinema-card-footer">
                          <button
                            type="button"
                            className={`cinema-mini-btn ${isFav ? 'is-favorited' : ''}`}
                            onClick={() => toggleFavoriteRecording(recording)}
                            title={isFav ? '取消收藏' : '加入收藏'}
                          >
                            <Icon name={isFav ? 'starFilled' : 'star'} size={13} />
                          </button>
                          {isFav && (
                            <button
                              type="button"
                              className="cinema-mini-btn"
                              onClick={() => saveFavoriteToDirectory(recording)}
                              title="另存到指定目录"
                            >
                              <Icon name="folder" size={13} />
                            </button>
                          )}
                          {onEnterReview && !isReviewMode && (
                            <button
                              type="button"
                              className="cinema-mini-btn is-text"
                              onClick={() => handleOpenPlayer(recording, true)}
                              title="与地图分屏复盘"
                            >
                              <Icon name="split" size={12} /> 复盘
                            </button>
                          )}
                          <button
                            type="button"
                            className="cinema-mini-btn is-danger"
                            onClick={() => deleteRecording(recording)}
                            title="删除录像"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredRecordings.length > recordingsPerPage && collectionFilter === 'all' && (
            <div className="cinema-pagination">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                ← 上一页
              </button>
              <span>{currentPage} / {totalPages} · 共 {filteredRecordings.length} 部录像</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                下一页 →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default RecordingsTab;
