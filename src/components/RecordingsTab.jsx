import { useState, useEffect, useRef, useMemo } from 'react';
import Logger from '../utils/logger';
import Icon from './Icon';

function RecordingsTab({
  recordings,
  recordingThumbnails,
  favoriteRecordings,
  onLoadThumbnails,
  onRefreshRecordings,
  onRefreshFavorites,
}) {
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordingsPerPage] = useState(20);

  const recordingsListRef = useRef(null);

  const loadRecordingUrl = async (filePath) => {
    try {
      const result = await window.electronAPI.getRecordingUrl(filePath);
      if (result.success) {
        setRecordingUrl(result.url);
      } else {
        Logger.error('Error loading recording URL:', result.error);
      }
    } catch (error) {
      Logger.error('Error loading recording URL:', error);
    }
  };

  useEffect(() => {
    if (selectedRecording) {
      loadRecordingUrl(selectedRecording.filePath);
    } else {
      setRecordingUrl(null);
    }
  }, [selectedRecording]);

  // Computed: filtered recordings with useMemo
  const filteredRecordings = useMemo(() => {
    if (!startDate && !endDate && !showFavoritesOnly) {
      return recordings;
    }
    return recordings.filter(recording => {
      const recordingDate = new Date(recording.date);

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

      if (showFavoritesOnly && !favoriteRecordings.includes(recording.id)) {
        return false;
      }

      return true;
    });
  }, [recordings, startDate, endDate, showFavoritesOnly, favoriteRecordings]);

  // Effect: recompute pagination when recordings or filter changes
  useEffect(() => {
    const { pages } = calculatePagination(filteredRecordings, recordingsPerPage);
    setTotalPages(pages);
    if (currentPage > pages) {
      setCurrentPage(1);
    }
  }, [filteredRecordings, recordingsPerPage]);

  // Delete a single recording
  const deleteRecording = async (recording) => {
    try {
      const isFavorite = favoriteRecordings.includes(recording.id);
      if (isFavorite) {
        const confirmed = window.confirm(`${recording.name} 已被收藏\n\n确定要删除这个收藏的录像吗？此操作不可恢复。`);
        if (!confirmed) {
          return;
        }
      }

      const result = await window.electronAPI.deleteRecording(recording.id);
      if (result.success) {
        Logger.info('Recording deleted successfully');
        onRefreshRecordings();
        onRefreshFavorites();
        if (selectedRecording && selectedRecording.id === recording.id) {
          setSelectedRecording(null);
          setRecordingUrl(null);
        }
        setSelectedRecordings(prev => prev.filter(r => r.id !== recording.id));
      } else {
        Logger.error('Failed to delete recording:', result.error);
      }
    } catch (error) {
      Logger.error('Error deleting recording:', error);
    }
  };

  // Toggle favorite status
  const toggleFavoriteRecording = async (recording) => {
    try {
      const isFavorite = favoriteRecordings.includes(recording.id);
      const result = await window.electronAPI.toggleFavoriteRecording(recording.id, !isFavorite);
      if (result.success) {
        onRefreshFavorites();
        Logger.info(`Recording ${!isFavorite ? 'added to' : 'removed from'} favorites`);
      } else {
        Logger.error('Failed to toggle favorite:', result.error);
      }
    } catch (error) {
      Logger.error('Error toggling favorite recording:', error);
    }
  };

  // Navigate to player view
  const handleNavigateToPlayer = (recording) => {
    setSelectedRecording(recording);
  };

  // Return to list view
  const handleReturnToList = () => {
    setSelectedRecording(null);
    setRecordingUrl(null);
  };

  // Pagination helpers
  const calculatePagination = (filteredRecs, perPage) => {
    const total = filteredRecs.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    return { total, pages };
  };

  const getCurrentPageRecordings = (allRecordings, page, perPage) => {
    if (showFavoritesOnly) return allRecordings;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return allRecordings.slice(startIndex, endIndex);
  };

  const currentPageRecordings = useMemo(() => {
    return getCurrentPageRecordings(filteredRecordings, currentPage, recordingsPerPage);
  }, [filteredRecordings, currentPage, recordingsPerPage, showFavoritesOnly]);

  useEffect(() => {
    onLoadThumbnails(currentPageRecordings);
  }, [currentPageRecordings, onLoadThumbnails]);

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
      if (recordingsListRef.current) {
        recordingsListRef.current.scrollTop = 0;
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  // Save favorite to directory
  const saveFavoriteToDirectory = async (recording) => {
    try {
      const result = await window.electronAPI.saveFavoriteToDirectory(recording.filePath, recording.name);
      if (result.success) {
        Logger.info(`Recording saved to: ${result.savePath}`);
        alert(`录像已保存到: ${result.savePath}`);
      } else if (!result.canceled) {
        Logger.error('Failed to save recording:', result.error);
        alert('保存录像失败: ' + result.error);
      }
    } catch (error) {
      Logger.error('Error saving favorite recording:', error);
      alert('保存录像时发生错误: ' + error.message);
    }
  };

  // Batch delete recordings
  const batchDeleteRecordings = async () => {
    if (selectedRecordings.length === 0) {
      alert('请先选择要删除的录像');
      return;
    }
    const favoritedRecordings = selectedRecordings.filter(recording => favoriteRecordings.includes(recording.id));
    const recordingsToDelete = selectedRecordings.filter(recording => !favoriteRecordings.includes(recording.id));

    if (!window.confirm(`确定要删除选中的 ${recordingsToDelete.length} 个录像吗？已排除 ${favoritedRecordings.length} 个收藏的录像。此操作不可恢复。`)) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const recording of recordingsToDelete) {
        const result = await window.electronAPI.deleteRecording(recording.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          Logger.error(`Failed to delete ${recording.name}:`, result.error);
        }
      }

      Logger.info(`Batch delete completed: ${successCount} succeeded, ${failCount} failed`);

      setSelectedRecordings([]);
      setIsSelectMode(false);
      onRefreshRecordings();

      if (selectedRecording && selectedRecordings.some(r => r.id === selectedRecording.id)) {
        setSelectedRecording(null);
        setRecordingUrl(null);
      }

      alert(`成功删除 ${successCount} 个录像，${failCount} 个删除失败`);
    } catch (error) {
      Logger.error('Error batch deleting recordings:', error);
      alert('批量删除时发生错误：' + error.message);
    }
  };

  // Toggle selection mode
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedRecordings([]);
      setStartDate('');
      setEndDate('');
    }
    setIsSelectMode(!isSelectMode);
  };

  // Date change handlers
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    if (endDate && newStartDate > endDate) {
      alert('开始日期不能晚于结束日期！');
      return;
    }
    setStartDate(newStartDate);
  };

  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    if (startDate && newEndDate < startDate) {
      alert('结束日期不能早于开始日期！');
      return;
    }
    setEndDate(newEndDate);
  };

  // Toggle recording selection
  const toggleRecordingSelection = (recording) => {
    if (selectedRecordings.some(r => r.id === recording.id)) {
      setSelectedRecordings(selectedRecordings.filter(r => r.id !== recording.id));
    } else {
      setSelectedRecordings([...selectedRecordings, recording]);
    }
  };

  // Select all recordings
  const selectAllRecordings = () => {
    if (selectedRecordings.length === filteredRecordings.length) {
      setSelectedRecordings([]);
    } else {
      setSelectedRecordings([...filteredRecordings]);
    }
  };

  // Analyze recording
  const analyzeRecording = async (recording) => {
    const analyzeResult = {
      recording: recording
    };
    try {
      setAnalyzeStatus('analyzing');
      const result = await window.electronAPI.analyzeRecording(recording.filePath);
      setAnalyzeStatus('');
      if (result.success) {
        analyzeResult.text = result.text;
        setAnalysisResult(analyzeResult);
        Logger.info('Recording analysis completed successfully');
      } else {
        Logger.error('Recording analysis failed:', result.error);
        analyzeResult.text = `分析失败: ${result.error}`;
        setAnalysisResult(analyzeResult);
      }
    } catch (error) {
      Logger.error('Error analyzing recording:', error);
      analyzeResult.text = `分析过程中出现错误: ${error.message}`;
      setAnalysisResult(analyzeResult);
    }
  };

  return (
    <section className="recordings-section" ref={recordingsListRef}>
      {selectedRecording ? (
        <div className="viewer">
          <div className="viewer-header">
            <button className="back-btn" onClick={handleReturnToList}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              返回列表
            </button>
            <h3>{selectedRecording.name}</h3>
          </div>
          <div className="video-container">
            {recordingUrl ? (
              <>
                <div className="video-player-card">
                  <video controls autoPlay src={recordingUrl}>
                    您的浏览器不支持视频播放。
                  </video>
                </div>
                <div className="analysis-bar">
                  <button className="analyze-btn" onClick={() => analyzeRecording(selectedRecording)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    分析录像
                  </button>
                  {analyzeStatus === 'analyzing' && (
                    <span className="analyze-status">AI 分析中</span>
                  )}
                </div>
                {analysisResult && analysisResult.recording.id === selectedRecording.id && (
                  <div className="analysis-result">
                    <h4>分析结果</h4>
                    <textarea
                      value={analysisResult.text}
                      readOnly
                      rows={4}
                      className="analysis-textarea"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="player-loading">
                <div className="loading-spinner"></div>
                <span>正在加载录像...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="recordings-list">
          <div className="recordings-list-header">
            <h2 data-count={recordings.length}>录像列表</h2>
            <div className="batch-controls">
              {!isSelectMode ? (
                <div className="view-controls">
                  <button onClick={() => onRefreshRecordings()} title="刷新列表">
                    <Icon name="refresh" size={14} /> 刷新
                  </button>
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={showFavoritesOnly ? 'active' : ''}
                    title={showFavoritesOnly ? '仅显示收藏' : '显示收藏'}
                  >
                    <Icon name={showFavoritesOnly ? 'starFilled' : 'star'} size={14} /> {showFavoritesOnly ? '仅收藏' : '收藏'}
                  </button>
                  <button onClick={toggleSelectMode} className="select-mode-button">
                    批量操作
                  </button>
                </div>
              ) : (
                <div className="batch-mode-inner">
                  <span className="selected-count">已选择 {selectedRecordings.length} / {filteredRecordings.length} 项</span>
                  <button onClick={selectAllRecordings} className="select-all-button">
                    {selectedRecordings.length === filteredRecordings.length ? '取消全选' : '全选'}
                  </button>
                  <button onClick={batchDeleteRecordings} className="batch-delete-button" disabled={selectedRecordings.length === 0}>
                    批量删除
                  </button>
                  <div className="date-filter-row">
                    <input
                      type="date"
                      value={startDate}
                      onChange={handleStartDateChange}
                      className="date-filter-input"
                      title="开始日期"
                    />
                    <span className="date-separator">至</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={handleEndDateChange}
                      className="date-filter-input"
                      title="结束日期"
                    />
                  </div>
                  <button onClick={toggleSelectMode} className="cancel-select-button">
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pagination Controls - Outside header */}
          {filteredRecordings.length > recordingsPerPage && !showFavoritesOnly && (
            <div className="pagination-bar">
              <div className="pagination-controls">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  ← 上一页
                </button>
                <span className="page-info">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                >
                  下一页 →
                </button>
              </div>
              <span className="total-count">共 {filteredRecordings.length} 条</span>
            </div>
          )}

          {recordings.length === 0 ? (
            <p>暂无录像文件</p>
          ) : (
            currentPageRecordings.map(recording => (
              <div
                key={recording.id}
                className={`recording-item ${isSelectMode ? 'clickable' : ''} ${isSelectMode && selectedRecordings.some(r => r.id === recording.id) ? 'selected' : ''} ${favoriteRecordings.includes(recording.id) ? 'favorite' : ''}`}
                onClick={() => isSelectMode && toggleRecordingSelection(recording)}
              >
                <div className="recording-thumbnail">
                  {isSelectMode && (
                    <input
                      type="checkbox"
                      checked={selectedRecordings.some(r => r.id === recording.id)}
                      onChange={(e) => e.stopPropagation()}
                      className="recording-checkbox"
                    />
                  )}
                  {recordingThumbnails[recording.id] ? (
                    <img
                      src={`data:image/png;base64,${recordingThumbnails[recording.id]}`}
                      alt={`${recording.name} thumbnail`}
                      className="recording-thumbnail-image"
                    />
                  ) : (
                    <div className="play-icon"><Icon name="play" size={44} /></div>
                  )}
                  {favoriteRecordings.includes(recording.id) && (
                    <div className="favorite-indicator"><Icon name="starFilled" size={16} /></div>
                  )}
                </div>
                <div className="recording-info" onClick={(e) => e.stopPropagation()}>
                  <h3>{recording.name}</h3>
                  <p>{new Date(recording.date).toLocaleString('zh-CN')}</p>
                  {!isSelectMode && (
                    <div className="recording-actions">
                      <button
                        className="play-button"
                        onClick={() => handleNavigateToPlayer(recording)}
                      >
                        播放
                      </button>
                      <button
                        className={`favorite-button ${favoriteRecordings.includes(recording.id) ? 'favorited' : ''}`}
                        onClick={() => toggleFavoriteRecording(recording)}
                        title={favoriteRecordings.includes(recording.id) ? '取消收藏' : '添加收藏'}
                      >
                        <Icon name={favoriteRecordings.includes(recording.id) ? 'starFilled' : 'star'} size={16} />
                      </button>
                      {favoriteRecordings.includes(recording.id) && (
                        <button
                          className="save-favorite-button"
                          onClick={() => saveFavoriteToDirectory(recording)}
                          title="另存到指定目录"
                        >
                          另存为
                        </button>
                      )}
                      <button
                        className="delete-button"
                        onClick={() => deleteRecording(recording)}
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

export default RecordingsTab;
