import { useState, useEffect, useRef, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import Logger from '../utils/logger';
import Icon from './Icon';

const mapNameMapping: Record<number, string> = {
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

export type Position = { x: number; y: number };

export type MapMarker = {
  x: number;
  y: number;
  number: number;
  sequence: number;
  id: number;
};

export type RoleKey = 'good' | 'neutral' | 'evil';

export type Connection = {
  from: number;
  to: number;
};

type ToolMode = 'move' | 'connect' | 'trail' | 'delete';

type MapTabProps = {
  selectedMap: number;
  setSelectedMap: Dispatch<SetStateAction<number>>;
  currentSequence: number;
  setCurrentSequence: Dispatch<SetStateAction<number>>;
  mapMarkersByMap: Record<number, MapMarker[]>;
  setMapMarkersByMap: Dispatch<SetStateAction<Record<number, MapMarker[]>>>;
  roleAssignments: Record<string, RoleKey>;
  setRoleAssignments: Dispatch<SetStateAction<Record<string, RoleKey>>>;
  connectionsByMap: Record<number, Connection[]>;
  setConnectionsByMap: Dispatch<SetStateAction<Record<number, Connection[]>>>;
  markerTrailsByMap: Record<number, Record<number, Position[][]>>;
  setMarkerTrailsByMap: Dispatch<SetStateAction<Record<number, Record<number, Position[][]>>>>;
  deadMarkers: Record<string, boolean>;
  setDeadMarkers: Dispatch<SetStateAction<Record<string, boolean>>>;
};

function MapTab({
  selectedMap,
  setSelectedMap,
  currentSequence,
  setCurrentSequence,
  mapMarkersByMap,
  setMapMarkersByMap,
  roleAssignments,
  setRoleAssignments,
  connectionsByMap,
  setConnectionsByMap,
  markerTrailsByMap,
  setMarkerTrailsByMap,
  deadMarkers,
  setDeadMarkers,
}: MapTabProps) {
  // 地图辅助工具状态
  const [toolMode, setToolMode] = useState<ToolMode>('move');
  const [draggedNumber, setDraggedNumber] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingMarkerId, setDraggingMarkerId] = useState<number | null>(null);
  const [markerOffset, setMarkerOffset] = useState<Position>({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<Position>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isInDeleteZone, setIsInDeleteZone] = useState(false);
  const [selectedNumberForRole, setSelectedNumberForRole] = useState<number | null>(null);
  const [drawingConnection, setDrawingConnection] = useState<{ markerId: number; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredConnection, setHoveredConnection] = useState<number | null>(null);
  const [drawingTrailMarkerId, setDrawingTrailMarkerId] = useState<number | null>(null);
  const [activeTrailSegment, setActiveTrailSegment] = useState<Position[] | null>(null);
  const [isDrawingTrail, setIsDrawingTrail] = useState(false);
  const [mapAspectRatio, setMapAspectRatio] = useState(16 / 9);

  const mapMarkers = mapMarkersByMap[selectedMap] || [];
  const connections = connectionsByMap[selectedMap] || [];
  const markerTrails = markerTrailsByMap[selectedMap] || {};
  const currentSequenceMarkers = mapMarkers.filter(m => m.sequence === currentSequence);
  const selectedMarker = selectedNumberForRole !== null
    ? currentSequenceMarkers.find(m => m.number === selectedNumberForRole)
    : null;
  const drawingTrailMarker = drawingTrailMarkerId !== null
    ? mapMarkers.find(m => m.id === drawingTrailMarkerId)
    : null;
  const roleMeta: Record<RoleKey, { label: string; className: string; color: string }> = {
    good: { label: '好鹅', className: 'good', color: '#4ade80' },
    neutral: { label: '中立', className: 'neutral', color: '#f59e0b' },
    evil: { label: '坏鸭', className: 'evil', color: '#ef4444' }
  };

  const setCurrentMapMarkers = (updater: MapMarker[] | ((markers: MapMarker[]) => MapMarker[])) => {
    setMapMarkersByMap(prev => {
      const current = prev[selectedMap] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedMap]: next };
    });
  };

  const setCurrentConnections = (updater: Connection[] | ((connections: Connection[]) => Connection[])) => {
    setConnectionsByMap(prev => {
      const current = prev[selectedMap] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedMap]: next };
    });
  };

  const setCurrentMarkerTrails = (
    updater: Record<number, Position[][]> | ((trails: Record<number, Position[][]>) => Record<number, Position[][]>)
  ) => {
    setMarkerTrailsByMap(prev => {
      const current = prev[selectedMap] || {};
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedMap]: next };
    });
  };

  const isDead = (seq: number, num: number): boolean => {
    for (let s = 1; s <= seq; s++) {
      if (deadMarkers[`${s}-${num}`]) return true;
    }
    return false;
  };

  const getMapPoint = (e: MouseEvent): Position | null => {
    if (!mapStageRef.current) return null;
    const rect = mapStageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const shouldAddTrailPoint = (points: Position[], point: Position): boolean => {
    const last = points[points.length - 1];
    if (!last) return true;
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    return distance >= 2.5;
  };

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const deleteZoneRef = useRef<HTMLDivElement | null>(null);

  // 地图标记拖拽处理
  const handleMarkerMouseDown = (e: MouseEvent, markerId: number) => {
    e.preventDefault();
    e.stopPropagation();

    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);

    setDraggingMarkerId(markerId);
    setIsDragging(true);

    const marker = mapMarkers.find(m => m.id === markerId);
    if (marker && mapStageRef.current) {
      const stageRect = mapStageRef.current.getBoundingClientRect();
      const markerX = (marker.x / 100) * stageRect.width;
      const markerY = (marker.y / 100) * stageRect.height;

      setMarkerOffset({
        x: e.clientX - stageRect.left - markerX,
        y: e.clientY - stageRect.top - markerY
      });
    }
  };

  const handleMapMouseMove = (e: MouseEvent) => {
    if (isDrawingTrail && drawingTrailMarkerId !== null && activeTrailSegment) {
      const point = getMapPoint(e);
      if (point && shouldAddTrailPoint(activeTrailSegment, point)) {
        setActiveTrailSegment([...activeTrailSegment, point]);
      }
      return;
    }

    if (!draggingMarkerId || !mapStageRef.current) return;

    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - mouseDownPos.x, 2) +
      Math.pow(e.clientY - mouseDownPos.y, 2)
    );

    if (moveDistance > 5 && !hasMoved) {
      setHasMoved(true);
    }

    if (deleteZoneRef.current) {
      const deleteRect = deleteZoneRef.current.getBoundingClientRect();
      const inDeleteZone = (
        e.clientX >= deleteRect.left &&
        e.clientX <= deleteRect.right &&
        e.clientY >= deleteRect.top &&
        e.clientY <= deleteRect.bottom
      );
      setIsInDeleteZone(inDeleteZone);
    }

    if (hasMoved || moveDistance > 5) {
      const stageRect = mapStageRef.current.getBoundingClientRect();
      const x = ((e.clientX - stageRect.left - markerOffset.x) / stageRect.width) * 100;
      const y = ((e.clientY - stageRect.top - markerOffset.y) / stageRect.height) * 100;

      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));

      // 直接操作 DOM，跳过 React 异步批处理
      const markerEl = mapContainerRef.current.querySelector(`[data-marker-id="${draggingMarkerId}"]`) as HTMLElement;
      if (markerEl) {
        markerEl.style.left = `${clampedX}%`;
        markerEl.style.top = `${clampedY}%`;
      }

      setCurrentMapMarkers(
        mapMarkers.map(m =>
          m.id === draggingMarkerId ? { ...m, x: clampedX, y: clampedY } : m
        )
      );
    }
  };

  const handleMapMouseUp = () => {
    if (isDrawingTrail && drawingTrailMarkerId !== null && activeTrailSegment && activeTrailSegment.length > 1) {
      setCurrentMarkerTrails(prev => ({
        ...prev,
        [drawingTrailMarkerId]: [...(prev[drawingTrailMarkerId] || []), activeTrailSegment]
      }));
      setActiveTrailSegment(null);
      setIsDrawingTrail(false);
      return;
    }

    if (isDrawingTrail) {
      setActiveTrailSegment(null);
      setIsDrawingTrail(false);
      return;
    }

    if (draggingMarkerId) {
      if (isInDeleteZone) {
        removeMarker(draggingMarkerId);
        Logger.info('标记已删除');
      }

      setDraggingMarkerId(null);
      setIsDragging(false);
      setHasMoved(false);
      setIsInDeleteZone(false);
    }
  };

  // 处理数字标记点击（用于选择设置身份）
  const handleMarkerClick = (markerNumber) => {
    setSelectedNumberForRole(markerNumber);
  };

  const startTrailForMarker = (markerId: number) => {
    setSelectedNumberForRole(null);
    setDrawingConnection(null);
    setDrawingTrailMarkerId(markerId);
    setToolMode('trail');
  };

  const exitTrailMode = () => {
    setActiveTrailSegment(null);
    setIsDrawingTrail(false);
    setDrawingTrailMarkerId(null);
    setToolMode('move');
  };

  const removeMarker = (markerId: number) => {
    setCurrentMapMarkers(markers => markers.filter(m => m.id !== markerId));
    setCurrentConnections(items => items.filter(conn => conn.from !== markerId && conn.to !== markerId));
    setCurrentMarkerTrails(prev => {
      const next = { ...prev };
      delete next[markerId];
      return next;
    });
  };

  const clearCurrentMap = () => {
    setCurrentMapMarkers([]);
    setCurrentConnections([]);
    setCurrentMarkerTrails({});
    setDrawingConnection(null);
    setDrawingTrailMarkerId(null);
    setActiveTrailSegment(null);
    setIsDrawingTrail(false);
  };

  // 设置角色身份
  const handleSetRole = (role: RoleKey) => {
    if (selectedNumberForRole !== null) {
      setRoleAssignments({
        ...roleAssignments,
        [selectedNumberForRole]: role
      });
      setSelectedNumberForRole(null);
    }
  };

  // 开始绘制连线（右键按下）
  const handleConnectionStart = (e: MouseEvent, markerId: number, markerX: number, markerY: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (mapStageRef.current) {
      const rect = mapStageRef.current.getBoundingClientRect();
      setDrawingConnection({
        markerId,
        x: (markerX / 100) * rect.width,
        y: (markerY / 100) * rect.height
      });
    }
  };

  // 更新鼠标位置（用于绘制临时连线）
  const handleConnectionMouseMove = (e: MouseEvent) => {
    if (drawingConnection && mapStageRef.current) {
      const rect = mapStageRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // 完成连线（右键释放）
  const handleConnectionEnd = (e: MouseEvent, targetMarkerId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (drawingConnection && drawingConnection.markerId !== targetMarkerId) {
      const exists = connections.some(
        conn =>
          (conn.from === drawingConnection.markerId && conn.to === targetMarkerId) ||
          (conn.from === targetMarkerId && conn.to === drawingConnection.markerId)
      );

      if (!exists) {
        setCurrentConnections([
          ...connections,
          { from: drawingConnection.markerId, to: targetMarkerId }
        ]);
      }
    }

    setDrawingConnection(null);
  };

  // 取消连线
  const handleConnectionCancel = () => {
    setDrawingConnection(null);
  };

  // 删除连线
  const handleDeleteConnection = (fromId, toId) => {
    Logger.info(`Deleting connection: ${fromId} -> ${toId}`);
    setCurrentConnections(
      connections.filter(
        conn => !(conn.from === fromId && conn.to === toId)
      )
    );
  };

  const clearSelectedRole = (number: number) => {
    const nextAssignments = { ...roleAssignments };
    delete nextAssignments[number];
    setRoleAssignments(nextAssignments);
  };

  const toggleSelectedDeadState = (number: number) => {
    setDeadMarkers(prev => {
      const already = isDead(currentSequence, number);
      if (already) {
        const next = { ...prev };
        for (let s = currentSequence; s <= 10; s++) {
          delete next[`${s}-${number}`];
        }
        return next;
      }
      return { ...prev, [`${currentSequence}-${number}`]: true };
    });
  };

  // 添加全局 mouseup 事件监听，确保拖拽结束
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingMarkerId) {
        setDraggingMarkerId(null);
        setIsDragging(false);
      }
    };

    if (draggingMarkerId) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mouseleave', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [draggingMarkerId]);

  const renderInspector = () => {
    if (drawingTrailMarkerId !== null) {
      return (
        <div className="inspector-section active-inspector">
          <div className="inspector-header">
            <span className="inspector-kicker">属性检查器</span>
            <h3>数字 {drawingTrailMarker?.number ?? '?'}</h3>
          </div>
          <div className="status-row">
            <span>路径状态</span>
            <strong>绘制中</strong>
          </div>
          <p className="trail-instruction">按住左键拖动绘制，松开完成一段路径。</p>
          <div className="trail-points-list">
            {(markerTrails[drawingTrailMarkerId] || []).map((segment, i) => (
              <span key={i} className="trail-point-chip">段 {i + 1} / {segment.length}</span>
            ))}
            {activeTrailSegment && <span className="trail-point-chip active">绘制中 / {activeTrailSegment.length}</span>}
          </div>
          <div className="inspector-actions">
            <button
              className="action-btn"
              onClick={() => {
                setCurrentMarkerTrails(prev => ({
                  ...prev,
                  [drawingTrailMarkerId]: (prev[drawingTrailMarkerId] || []).slice(0, -1)
                }));
              }}
            >
              撤销上一段
            </button>
            <button
              className="action-btn danger"
              onClick={() => {
                setCurrentMarkerTrails(prev => {
                  const next = { ...prev };
                  delete next[drawingTrailMarkerId];
                  return next;
                });
                setActiveTrailSegment(null);
                setIsDrawingTrail(false);
                setDrawingTrailMarkerId(null);
              }}
            >
              清除路径
            </button>
            <button
              className="action-btn primary"
              onClick={() => {
                setActiveTrailSegment(null);
                setIsDrawingTrail(false);
                setDrawingTrailMarkerId(null);
              }}
            >
              完成
            </button>
          </div>
        </div>
      );
    }

    if (selectedNumberForRole !== null) {
      const selectedRole = roleAssignments[selectedNumberForRole];
      return (
        <div className="inspector-section active-inspector">
          <div className="inspector-header">
            <span className="inspector-kicker">属性检查器</span>
            <h3>数字 {selectedNumberForRole}</h3>
          </div>
          <div className="inspector-summary-card">
            <div className="marker-badge">{selectedNumberForRole}</div>
            <div>
              <span className="muted-label">身份</span>
              <strong>{selectedRole ? roleMeta[selectedRole].label : '未设置'}</strong>
            </div>
            <span className={`status-pill ${isDead(currentSequence, selectedNumberForRole) ? 'danger' : 'success'}`}>
              {isDead(currentSequence, selectedNumberForRole) ? '死亡' : '存活'}
            </span>
          </div>
          <div className="inspector-field-group">
            <span className="field-label">设置身份</span>
            <div className="role-buttons">
              <button className="role-btn good" onClick={() => handleSetRole('good')}>
                <span className="role-dot good"></span> 好鹅
              </button>
              <button className="role-btn neutral" onClick={() => handleSetRole('neutral')}>
                <span className="role-dot neutral"></span> 中立
              </button>
              <button className="role-btn evil" onClick={() => handleSetRole('evil')}>
                <span className="role-dot evil"></span> 坏鸭
              </button>
            </div>
          </div>
          <div className="inspector-actions">
            <button
              className={`action-btn ${isDead(currentSequence, selectedNumberForRole) ? '' : 'danger'}`}
              onClick={() => toggleSelectedDeadState(selectedNumberForRole)}
            >
              <Icon name="ghost" size={14} />
              {isDead(currentSequence, selectedNumberForRole) ? '标记复活' : '标记死亡'}
            </button>
            <button
              className="action-btn"
              onClick={() => selectedMarker && startTrailForMarker(selectedMarker.id)}
              disabled={!selectedMarker}
            >
              绘制路径
            </button>
            <button className="action-btn" onClick={() => clearSelectedRole(selectedNumberForRole)}>
              清除身份
            </button>
            <button className="cancel-btn" onClick={() => setSelectedNumberForRole(null)}>
              取消选择
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="inspector-section">
        <div className="inspector-header">
          <span className="inspector-kicker">属性检查器</span>
          <h3>当前地图</h3>
        </div>
        <div className="inspector-stats">
          <div><span>地图</span><strong>{mapNameMapping[selectedMap]}</strong></div>
          <div><span>轮次</span><strong>{currentSequence}</strong></div>
          <div><span>本轮标记</span><strong>{currentSequenceMarkers.length}</strong></div>
          <div><span>连线</span><strong>{connections.length}</strong></div>
        </div>
        <p className="role-hint">点击地图上的数字查看属性，或从左侧拖入数字创建标记。</p>
        {Object.keys(roleAssignments).length > 0 ? (
          <div className="assigned-roles">
            {Object.entries(roleAssignments).map(([number, role]) => {
              const info = roleMeta[role];
              return (
                <div key={number} className="role-item">
                  <span className="role-number">{number}</span>
                  <span className="role-info" style={{ color: info.color }}>
                    <span className={`role-dot ${info.className}`}></span> {info.label}
                  </span>
                  <button className="remove-role" title="清除身份" onClick={() => clearSelectedRole(Number(number))}>
                    <Icon name="x" size={14} strokeWidth={2.4} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无身份分配</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="entertainment-section">
      <div className="map-tool-container">
        {/* 左侧边栏 */}
        <div className="map-sidebar">
          {/* 地图选择 */}
          <div className="map-selector">
            <h3>地图选择</h3>
            <select
              className="map-select"
              value={selectedMap}
              onChange={(e) => setSelectedMap(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(mapNum => (
                <option key={mapNum} value={mapNum}>
                  {mapNameMapping[mapNum]}
                </option>
              ))}
            </select>
          </div>

          {/* 轮次 */}
          <div className="sequence-selector">
            <h3>轮次</h3>
            <div className="sequence-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seq => (
                <button
                  key={seq}
                  className={`seq-btn ${currentSequence === seq ? 'active' : ''}`}
                  onClick={() => setCurrentSequence(seq)}
                >
                  {seq}
                </button>
              ))}
            </div>
          </div>

          {/* 工具 */}
          <div className="tools-panel">
            <h3>数字标记</h3>
            <div className="number-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(num => {
                const role = roleAssignments[num];
                let iconClass = `number-icon ${selectedNumberForRole === num ? 'selected' : ''}`;

                if (role === 'good') {
                  iconClass += ' role-good';
                } else if (role === 'neutral') {
                  iconClass += ' role-neutral';
                } else if (role === 'evil') {
                  iconClass += ' role-evil';
                }

                return (
                  <div
                    key={num}
                    className={iconClass}
                    draggable
                    onDragStart={(e) => {
                      setDraggedNumber(num);
                      setIsDragging(true);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => {
                      setDraggedNumber(null);
                      setIsDragging(false);
                    }}
                    onClick={() => handleMarkerClick(num)}
                    title={`数字 ${num}${role ? ` - ${role === 'good' ? '好鹅' : role === 'neutral' ? '中立' : '坏鸭'}` : ' - 拖拽到地图，点击设置身份'}`}
                  >
                    {num}
                    {isDead(currentSequence, num) && (
                      <span className="dead-x-overlay">✕</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 中间地图显示区 */}
        <div className="map-display">
          <div className="map-header">
            <div className="map-title">
              <img src={`/img/${selectedMap}.png`} alt="地图预览" className="map-preview-thumb" />
              <h3>{mapNameMapping[selectedMap]}</h3>
            </div>
            <div className="map-actions">
              <button onClick={clearCurrentMap} className="action-btn">
                清除标记
              </button>
              <button onClick={() => { setRoleAssignments({}); setDeadMarkers({}); }} className="action-btn">
                清除身份
              </button>
            </div>
          </div>

          <div className="map-tool-mode-bar" aria-label="地图工具模式">
            {([
              ['move', '移动'],
              ['connect', '连线'],
              ['trail', '路径'],
              ['delete', '删除']
            ] as [ToolMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                className={`tool-mode-btn ${toolMode === mode ? 'active' : ''}`}
                onClick={() => {
                  setToolMode(mode);
                  setDrawingConnection(null);
                  setDrawingTrailMarkerId(null);
                  setActiveTrailSegment(null);
                  setIsDrawingTrail(false);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div
            ref={mapContainerRef}
            className={`map-canvas-container ${isDragging ? 'drag-over' : ''}`}
            onMouseMove={(e) => {
              handleMapMouseMove(e);
              handleConnectionMouseMove(e);
            }}
            onMouseUp={(e) => {
              handleMapMouseUp();
              if (e.button === 2) {
                handleConnectionCancel();
              }
            }}
            onMouseLeave={(e) => {
              handleMapMouseUp();
              handleConnectionCancel();
            }}
            onMouseDown={(e) => {
              if (drawingTrailMarkerId !== null && e.button === 0) {
                const point = getMapPoint(e);
                if (point) {
                  setActiveTrailSegment([point]);
                  setIsDrawingTrail(true);
                }
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (toolMode === 'trail' || drawingTrailMarkerId !== null) {
                exitTrailMode();
              }
            }}
          >
            {/* 删除区域（右上角）- 仅在拖拽时显示 */}
            {(draggingMarkerId || toolMode === 'delete') && (
              <div
                ref={deleteZoneRef}
                className={`delete-zone ${isInDeleteZone ? 'active' : ''}`}
              >
                <span className="delete-icon"><Icon name="trash" size={20} /></span>
                <span className="delete-text">拖拽到此删除</span>
              </div>
            )}

            <div
              ref={mapStageRef}
              className="map-stage"
              style={{ '--map-aspect-ratio': mapAspectRatio } as React.CSSProperties}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const point = getMapPoint(e as unknown as MouseEvent);

                if (draggedNumber !== null && point) {
                  const existingMarker = mapMarkers.find(
                    m => m.number === draggedNumber && m.sequence === currentSequence
                  );

                  if (existingMarker) {
                    setCurrentMapMarkers(
                      mapMarkers.map(m =>
                        m.id === existingMarker.id ? { ...m, x: point.x, y: point.y } : m
                      )
                    );
                  } else {
                    setCurrentMapMarkers([
                      ...mapMarkers,
                      {
                        x: point.x,
                        y: point.y,
                        number: draggedNumber,
                        sequence: currentSequence,
                        id: Date.now()
                      }
                    ]);
                  }
                  setDraggedNumber(null);
                  setIsDragging(false);
                }
              }}
            >

            <img
              src={`/img/${selectedMap}.png`}
              alt={`地图${selectedMap}`}
              className="map-image"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setMapAspectRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
            />

            {/* SVG 连线层 */}
            <svg className="connections-layer">
              {/* 已存在的连线 - 只显示当前序列的标记之间的连线 */}
              {connections.map((conn, index) => {
                const fromMarker = mapMarkers.find(m => m.id === conn.from);
                const toMarker = mapMarkers.find(m => m.id === conn.to);

                if (!fromMarker || !toMarker) return null;
                if (fromMarker.sequence !== currentSequence || toMarker.sequence !== currentSequence) return null;

                return (
                  <g key={index}>
                    <line
                      x1={`${fromMarker.x}%`}
                      y1={`${fromMarker.y}%`}
                      x2={`${toMarker.x}%`}
                      y2={`${toMarker.y}%`}
                      stroke="transparent"
                      strokeWidth="15"
                      strokeLinecap="round"
                      onMouseEnter={() => setHoveredConnection(index)}
                      onMouseLeave={() => setHoveredConnection(null)}
                      style={{ cursor: 'pointer' }}
                    />
                    <line
                      x1={`${fromMarker.x}%`}
                      y1={`${fromMarker.y}%`}
                      x2={`${toMarker.x}%`}
                      y2={`${toMarker.y}%`}
                      stroke="#00d4ff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity="0.8"
                    />
                  </g>
                );
              })}

              {/* 删除按钮层 - 在所有连线之上 */}
              {connections.map((conn, index) => {
                const fromMarker = mapMarkers.find(m => m.id === conn.from);
                const toMarker = mapMarkers.find(m => m.id === conn.to);

                if (!fromMarker || !toMarker) return null;
                if (fromMarker.sequence !== currentSequence || toMarker.sequence !== currentSequence) return null;
                if (hoveredConnection !== index) return null;

                return (
                  <g key={`delete-${index}`}>
                    <circle
                      cx={`${(fromMarker.x + toMarker.x) / 2}%`}
                      cy={`${(fromMarker.y + toMarker.y) / 2}%`}
                      r="8"
                      fill="#ff4757"
                      stroke="white"
                      strokeWidth="2"
                      className="connection-delete-btn"
                      onMouseEnter={() => setHoveredConnection(index)}
                      onMouseLeave={() => setHoveredConnection(null)}
                      onClick={(e) => {
                        console.log('Delete button clicked!', conn.from, conn.to);
                        Logger.info(`Delete button clicked: ${conn.from} -> ${conn.to}`);
                        e.stopPropagation();
                        handleDeleteConnection(conn.from, conn.to);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <text
                      x={`${(fromMarker.x + toMarker.x) / 2}%`}
                      y={`${(fromMarker.y + toMarker.y) / 2}%`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      ×
                    </text>
                  </g>
                );
              })}

              {/* 移动轨迹 */}
              {mapMarkers.filter(m => m.sequence === currentSequence).map(marker => {
                const segments = markerTrails[marker.id] || [];
                const drawingSegment = drawingTrailMarkerId === marker.id && activeTrailSegment ? [activeTrailSegment] : [];
                const allSegments = [...segments, ...drawingSegment];
                if (allSegments.length === 0) return null;
                return (
                  <g key={`trail-${marker.id}`}>
                    {allSegments.map((segment, segmentIndex) => {
                      const points = segmentIndex === 0 ? [{ x: marker.x, y: marker.y }, ...segment] : segment;
                      return points.slice(0, -1).map((p, i) => (
                        <line
                          key={`l-${segmentIndex}-${i}`}
                          x1={`${p.x}%`}
                          y1={`${p.y}%`}
                          x2={`${points[i + 1].x}%`}
                          y2={`${points[i + 1].y}%`}
                          stroke="#ffd700"
                          strokeWidth="2"
                          strokeDasharray={segmentIndex === segments.length ? undefined : '5,3'}
                          opacity={segmentIndex === segments.length ? '0.95' : '0.7'}
                        />
                      ));
                    })}
                    {allSegments.flat().map((p, i) => (
                      <circle
                        key={`c-${i}`}
                        cx={`${p.x}%`}
                        cy={`${p.y}%`}
                        r="3"
                        fill="#ffd700"
                        opacity="0.45"
                      />
                    ))}
                  </g>
                );
              })}

              {/* 正在绘制的临时连线 */}
              {drawingConnection && (
                <line
                  x1={drawingConnection.x}
                  y1={drawingConnection.y}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#00d4ff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.6"
                />
              )}
            </svg>

            {/* 标记点覆盖层 */}
            {mapMarkers.filter(m => m.sequence === currentSequence).map(marker => {
              const role = roleAssignments[marker.number];
              let markerClass = `map-marker-number ${draggingMarkerId === marker.id ? 'dragging' : ''}`;

              if (role === 'good') {
                markerClass += ' role-good';
              } else if (role === 'neutral') {
                markerClass += ' role-neutral';
              } else if (role === 'evil') {
                markerClass += ' role-evil';
              }

              return (
                <div
                  key={marker.id}
                  data-marker-id={marker.id}
                  className={`${markerClass} ${isDead(currentSequence, marker.number) ? 'dead' : ''}`}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  onMouseDown={(e) => {
                    if (drawingTrailMarkerId !== null || toolMode === 'delete' || toolMode === 'trail') return;
                    if (e.button === 0 && toolMode === 'move') {
                      handleMarkerMouseDown(e, marker.id);
                    } else if (e.button === 2 || toolMode === 'connect') {
                      handleConnectionStart(e, marker.id, marker.x, marker.y);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (e.button === 2 && drawingConnection) {
                      handleConnectionEnd(e, marker.id);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toolMode === 'delete') {
                      removeMarker(marker.id);
                    } else if (toolMode === 'trail') {
                      startTrailForMarker(marker.id);
                    } else if (!hasMoved && drawingTrailMarkerId === null && toolMode === 'move') {
                      handleMarkerClick(marker.number);
                    }
                  }}
                  title={`数字 ${marker.number} - 拖拽移动，点击设置身份${role ? ` (${role === 'good' ? '好鹅' : role === 'neutral' ? '中立' : '坏鸭'})` : ''}`}
                >
                  {marker.number}
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div className="map-right-panel">
          <div className="inspector-panel">
            {renderInspector()}
          </div>
          <div className="role-assignment legacy-role-assignment">
            <h3>角色身份设置</h3>

            {drawingTrailMarkerId !== null ? (
              <div className="role-selection-active">
                <p className="selection-hint">
                  正在为数字 <strong>{mapMarkers.find(m => m.id === drawingTrailMarkerId)?.number ?? '?'}</strong> 绘制路径
                </p>
                <p className="trail-instruction">按住左键拖动绘制，松开完成一段路径</p>
                <div className="trail-points-list">
                  {(markerTrails[drawingTrailMarkerId] || []).map((segment, i) => (
                    <span key={i} className="trail-point-chip">{i + 1}:{segment.length}</span>
                  ))}
                  {activeTrailSegment && <span className="trail-point-chip">绘制中:{activeTrailSegment.length}</span>}
                </div>
                <div className="trail-actions">
                  <button
                    className="action-btn"
                    onClick={() => {
                      setCurrentMarkerTrails(prev => ({
                        ...prev,
                        [drawingTrailMarkerId]: (prev[drawingTrailMarkerId] || []).slice(0, -1)
                      }));
                    }}
                  >
                    撤销上一段
                  </button>
                  <button
                    className="action-btn primary"
                    onClick={() => {
                      setCurrentMarkerTrails(prev => {
                        const next = { ...prev };
                        delete next[drawingTrailMarkerId];
                        return next;
                      });
                      setActiveTrailSegment(null);
                      setIsDrawingTrail(false);
                      setDrawingTrailMarkerId(null);
                    }}
                  >
                    清除路径
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setActiveTrailSegment(null);
                      setIsDrawingTrail(false);
                      setDrawingTrailMarkerId(null);
                    }}
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : selectedNumberForRole !== null ? (
              <div className="role-selection-active">
                <p className="selection-hint">为数字 <strong>{selectedNumberForRole}</strong> 选择身份：</p>
                <div className="role-buttons">
                  <button className="role-btn good" onClick={() => handleSetRole('good')}>
                    <span className="role-dot good"></span> 好鹅
                  </button>
                  <button className="role-btn neutral" onClick={() => handleSetRole('neutral')}>
                    <span className="role-dot neutral"></span> 中立
                  </button>
                  <button className="role-btn evil" onClick={() => handleSetRole('evil')}>
                    <span className="role-dot evil"></span> 坏鸭
                  </button>
                </div>
                <div className="trail-actions">
                  <button
                    className={`action-btn ${isDead(currentSequence, selectedNumberForRole!) ? 'danger' : ''}`}
                    onClick={() => {
                      const num = selectedNumberForRole!;
                      setDeadMarkers(prev => {
                        const already = isDead(currentSequence, num);
                        if (already) {
                          // 复活：清除当前及之后所有轮次的死亡标记
                          const next = { ...prev };
                          for (let s = currentSequence; s <= 10; s++) {
                            delete next[`${s}-${num}`];
                          }
                          return next;
                        } else {
                          // 标记死亡：仅当前轮次
                          return { ...prev, [`${currentSequence}-${num}`]: true };
                        }
                      });
                    }}
                    style={{ flex: 1 }}
                  >
                    <Icon name="ghost" size={14} /> {isDead(currentSequence, selectedNumberForRole!) ? '复活' : '标记死亡'}
                  </button>
                  <button className="cancel-btn" onClick={() => setSelectedNumberForRole(null)} style={{ flex: 0 }}>
                    取消
                  </button>
                </div>
                <hr className="panel-divider" />
                <button
                  className="action-btn primary"
                  onClick={() => {
                    const currentMarkers = mapMarkers.filter(m => m.sequence === currentSequence);
                    const marker = currentMarkers.find(m => m.number === selectedNumberForRole);
                    if (marker) startTrailForMarker(marker.id);
                  }}
                  style={{ width: '100%', marginTop: '0' }}
                >
                  绘制路径
                </button>
              </div>
            ) : (
              <div className="role-list">
                <p className="role-hint">点击地图上的数字标记来设置身份</p>
                {Object.keys(roleAssignments).length > 0 ? (
                  <div className="assigned-roles">
                    {Object.entries(roleAssignments).map(([number, role]) => {
                      const roleInfo: Record<RoleKey, { label: string; color: string }> = {
                        good: { label: '好鹅', color: '#4caf50' },
                        neutral: { label: '中立', color: '#ff9800' },
                        evil: { label: '坏鸭', color: '#f44336' }
                      };
                      const info = roleInfo[role];
                      return (
                        <div key={number} className="role-item">
                          <span className="role-number">{number}</span>
                          <span className="role-info" style={{ color: info.color }}>
                            <span className={`role-dot ${role}`}></span> {info.label}
                          </span>
                          <button
                            className="remove-role"
                            title="清除身份"
                            onClick={() => {
                              const newAssignments = { ...roleAssignments };
                              delete newAssignments[number];
                              setRoleAssignments(newAssignments);
                            }}
                          >
                            <Icon name="x" size={14} strokeWidth={2.4} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>暂无身份分配</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default MapTab;
