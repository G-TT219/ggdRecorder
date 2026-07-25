import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
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

type Interaction =
  | { kind: 'idle' }
  | { kind: 'placing'; playerNumber: number }
  | { kind: 'connecting'; fromMarkerId: number; via: 'button' | 'right-drag' }
  | { kind: 'drawing-path'; markerId: number };

type ContextMenuState =
  | { kind: 'marker'; markerId: number; x: number; y: number }
  | { kind: 'connection'; connection: Connection; x: number; y: number }
  | { kind: 'canvas'; x: number; y: number };

type AnnotationSnapshot = {
  mapMarkersByMap: Record<number, MapMarker[]>;
  roleAssignments: Record<string, RoleKey>;
  connectionsByMap: Record<number, Connection[]>;
  markerTrailsByMap: Record<number, Record<number, Position[][]>>;
  deadMarkers: Record<string, boolean>;
};

type MarkerDragState = {
  markerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  snapshot: AnnotationSnapshot;
};

type RightGestureState = {
  markerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

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

const roleMeta: Record<RoleKey, { label: string; className: string; color: string }> = {
  good: { label: '好鹅', className: 'good', color: '#4f9f68' },
  neutral: { label: '中立', className: 'neutral', color: '#c58b2a' },
  evil: { label: '坏鸭', className: 'evil', color: '#d55a5d' },
};

const connectionKey = (connection: Connection): string =>
  [connection.from, connection.to].sort((a, b) => a - b).join('-');

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
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'idle' });
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const [selectedRosterNumber, setSelectedRosterNumber] = useState<number | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeTrailSegment, setActiveTrailSegment] = useState<Position[] | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<number | null>(null);
  const [rightDragFromId, setRightDragFromId] = useState<number | null>(null);
  const [rightDragTargetId, setRightDragTargetId] = useState<number | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Position>({ x: 50, y: 50 });
  const [draggedRosterNumber, setDraggedRosterNumber] = useState<number | null>(null);
  const [mapAspectRatio, setMapAspectRatio] = useState(16 / 9);
  const [clearMenuOpen, setClearMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; canUndo: boolean } | null>(null);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });

  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const markerDragRef = useRef<MarkerDragState | null>(null);
  const rightGestureRef = useRef<RightGestureState | null>(null);
  const suppressContextMenuUntilRef = useRef(0);
  const markerIdRef = useRef(Date.now());
  const undoStackRef = useRef<AnnotationSnapshot[]>([]);
  const redoStackRef = useRef<AnnotationSnapshot[]>([]);

  const mapMarkers = useMemo(
    () => mapMarkersByMap[selectedMap] || [],
    [mapMarkersByMap, selectedMap]
  );
  const connections = useMemo(
    () => connectionsByMap[selectedMap] || [],
    [connectionsByMap, selectedMap]
  );
  const markerTrails = useMemo(
    () => markerTrailsByMap[selectedMap] || {},
    [markerTrailsByMap, selectedMap]
  );
  const currentSequenceMarkers = useMemo(
    () => mapMarkers.filter(marker => marker.sequence === currentSequence),
    [mapMarkers, currentSequence]
  );
  const currentMarkerNumbers = useMemo(
    () => new Set(currentSequenceMarkers.map(marker => marker.number)),
    [currentSequenceMarkers]
  );
  const previousSequenceMarkers = useMemo(
    () => currentSequence <= 1
      ? []
      : mapMarkers.filter(
          marker =>
            marker.sequence === currentSequence - 1 &&
            !currentMarkerNumbers.has(marker.number)
        ),
    [mapMarkers, currentSequence, currentMarkerNumbers]
  );
  const selectedMarker = selectedMarkerId === null
    ? null
    : currentSequenceMarkers.find(marker => marker.id === selectedMarkerId) || null;
  const selectedPlayerNumber = selectedMarker?.number ?? selectedRosterNumber;
  const drawingMarker = interaction.kind === 'drawing-path'
    ? currentSequenceMarkers.find(marker => marker.id === interaction.markerId) || null
    : null;

  useEffect(() => {
    if (selectedMarkerId !== null) setSelectedRosterNumber(null);
  }, [selectedMarkerId]);

  useEffect(() => {
    if (selectedConnection !== null) setSelectedRosterNumber(null);
  }, [selectedConnection]);

  const cloneSnapshot = useCallback((): AnnotationSnapshot => {
    const clonedMarkers = Object.fromEntries(
      Object.entries(mapMarkersByMap).map(([mapId, markers]) => [
        Number(mapId),
        markers.map(marker => ({ ...marker })),
      ])
    );
    const clonedConnections = Object.fromEntries(
      Object.entries(connectionsByMap).map(([mapId, items]) => [
        Number(mapId),
        items.map(item => ({ ...item })),
      ])
    );
    const clonedTrails = Object.fromEntries(
      Object.entries(markerTrailsByMap).map(([mapId, trails]) => [
        Number(mapId),
        Object.fromEntries(
          Object.entries(trails).map(([markerId, segments]) => [
            Number(markerId),
            segments.map(segment => segment.map(point => ({ ...point }))),
          ])
        ),
      ])
    );

    return {
      mapMarkersByMap: clonedMarkers,
      roleAssignments: { ...roleAssignments },
      connectionsByMap: clonedConnections,
      markerTrailsByMap: clonedTrails,
      deadMarkers: { ...deadMarkers },
    };
  }, [
    mapMarkersByMap,
    roleAssignments,
    connectionsByMap,
    markerTrailsByMap,
    deadMarkers,
  ]);

  const restoreSnapshot = useCallback((snapshot: AnnotationSnapshot) => {
    setMapMarkersByMap(snapshot.mapMarkersByMap);
    setRoleAssignments(snapshot.roleAssignments);
    setConnectionsByMap(snapshot.connectionsByMap);
    setMarkerTrailsByMap(snapshot.markerTrailsByMap);
    setDeadMarkers(snapshot.deadMarkers);
  }, [
    setMapMarkersByMap,
    setRoleAssignments,
    setConnectionsByMap,
    setMarkerTrailsByMap,
    setDeadMarkers,
  ]);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, []);

  const pushHistory = useCallback((snapshot?: AnnotationSnapshot) => {
    undoStackRef.current.push(snapshot || cloneSnapshot());
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    syncHistoryState();
  }, [cloneSnapshot, syncHistoryState]);

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    redoStackRef.current.push(cloneSnapshot());
    restoreSnapshot(snapshot);
    setInteraction({ kind: 'idle' });
    setActiveTrailSegment(null);
    setSelectedConnection(null);
    setContextMenu(null);
    syncHistoryState();
  }, [cloneSnapshot, restoreSnapshot, syncHistoryState]);

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;
    undoStackRef.current.push(cloneSnapshot());
    restoreSnapshot(snapshot);
    setInteraction({ kind: 'idle' });
    setActiveTrailSegment(null);
    setSelectedConnection(null);
    setContextMenu(null);
    syncHistoryState();
  }, [cloneSnapshot, restoreSnapshot, syncHistoryState]);

  const notify = useCallback((message: string, canUndo = false) => {
    setToast({ message, canUndo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const setCurrentMapMarkers = (
    updater: MapMarker[] | ((markers: MapMarker[]) => MapMarker[])
  ) => {
    setMapMarkersByMap(previous => {
      const current = previous[selectedMap] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...previous, [selectedMap]: next };
    });
  };

  const setCurrentConnections = (
    updater: Connection[] | ((items: Connection[]) => Connection[])
  ) => {
    setConnectionsByMap(previous => {
      const current = previous[selectedMap] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...previous, [selectedMap]: next };
    });
  };

  const setCurrentMarkerTrails = (
    updater:
      | Record<number, Position[][]>
      | ((trails: Record<number, Position[][]>) => Record<number, Position[][]>)
  ) => {
    setMarkerTrailsByMap(previous => {
      const current = previous[selectedMap] || {};
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...previous, [selectedMap]: next };
    });
  };

  const isDead = (sequence: number, playerNumber: number): boolean => {
    for (let index = 1; index <= sequence; index += 1) {
      if (deadMarkers[String(index) + '-' + String(playerNumber)]) return true;
    }
    return false;
  };

  const deathRoundFor = (sequence: number, playerNumber: number): number | null => {
    for (let index = 1; index <= sequence; index += 1) {
      if (deadMarkers[String(index) + '-' + String(playerNumber)]) return index;
    }
    return null;
  };

  const getMapPoint = (clientX: number, clientY: number): Position | null => {
    if (!mapStageRef.current) return null;
    const rect = mapStageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const getMenuPoint = (clientX: number, clientY: number): Position => {
    const rect = mapStageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 12, y: 12 };
    return {
      x: Math.max(8, Math.min(rect.width - 184, clientX - rect.left)),
      y: Math.max(8, Math.min(rect.height - 168, clientY - rect.top)),
    };
  };

  const cancelInteraction = useCallback(() => {
    setInteraction({ kind: 'idle' });
    setActiveTrailSegment(null);
    setRightDragFromId(null);
    setRightDragTargetId(null);
    rightGestureRef.current = null;
  }, []);

  const placeMarker = (playerNumber: number, point: Position) => {
    pushHistory();
    const existing = currentSequenceMarkers.find(marker => marker.number === playerNumber);
    if (existing) {
      setCurrentMapMarkers(markers =>
        markers.map(marker =>
          marker.id === existing.id ? { ...marker, x: point.x, y: point.y } : marker
        )
      );
      setSelectedMarkerId(existing.id);
    } else {
      markerIdRef.current += 1;
      const marker: MapMarker = {
        id: markerIdRef.current,
        number: playerNumber,
        sequence: currentSequence,
        x: point.x,
        y: point.y,
      };
      setCurrentMapMarkers(markers => [...markers, marker]);
      setSelectedMarkerId(marker.id);
    }
    setSelectedRosterNumber(null);
    setSelectedConnection(null);
    setInteraction({ kind: 'idle' });
    notify('玩家 ' + String(playerNumber) + ' 已放置', true);
  };

  const selectRosterPlayer = (playerNumber: number) => {
    const marker = currentSequenceMarkers.find(item => item.number === playerNumber);
    setContextMenu(null);
    setSelectedConnection(null);
    setSelectedRosterNumber(playerNumber);
    setInteraction({ kind: 'idle' });
    if (marker) {
      setSelectedMarkerId(marker.id);
    } else {
      setSelectedMarkerId(null);
    }
  };

  const startPlacingPlayer = (playerNumber: number) => {
    setContextMenu(null);
    setSelectedConnection(null);
    setSelectedMarkerId(null);
    setSelectedRosterNumber(playerNumber);
    setInteraction({ kind: 'placing', playerNumber });
  };

  const addConnection = (fromMarkerId: number, toMarkerId: number) => {
    if (fromMarkerId === toMarkerId) {
      cancelInteraction();
      return;
    }
    const fromMarker = currentSequenceMarkers.find(marker => marker.id === fromMarkerId);
    const toMarker = currentSequenceMarkers.find(marker => marker.id === toMarkerId);
    if (!fromMarker || !toMarker) {
      cancelInteraction();
      return;
    }
    const exists = connections.some(connection =>
      (connection.from === fromMarkerId && connection.to === toMarkerId) ||
      (connection.from === toMarkerId && connection.to === fromMarkerId)
    );
    if (exists) {
      notify('这两个玩家已经连接');
      cancelInteraction();
      return;
    }
    pushHistory();
    const connection = { from: fromMarkerId, to: toMarkerId };
    setCurrentConnections(items => [...items, connection]);
    setSelectedConnection(connection);
    setSelectedMarkerId(null);
    cancelInteraction();
    notify(
      '已连接玩家 ' + String(fromMarker.number) + ' 和 ' + String(toMarker.number),
      true
    );
  };

  const startConnection = (markerId: number) => {
    setSelectedMarkerId(markerId);
    setSelectedConnection(null);
    setContextMenu(null);
    setInteraction({ kind: 'connecting', fromMarkerId: markerId, via: 'button' });
  };

  const removeConnection = (connection: Connection) => {
    pushHistory();
    const key = connectionKey(connection);
    setCurrentConnections(items => items.filter(item => connectionKey(item) !== key));
    setSelectedConnection(null);
    setContextMenu(null);
    Logger.info('地图连线已删除: ' + key);
    notify('连线已删除', true);
  };

  const removeMarker = (markerId: number) => {
    const marker = mapMarkers.find(item => item.id === markerId);
    if (!marker) return;
    pushHistory();
    setCurrentMapMarkers(markers => markers.filter(item => item.id !== markerId));
    setCurrentConnections(items =>
      items.filter(connection => connection.from !== markerId && connection.to !== markerId)
    );
    setCurrentMarkerTrails(trails => {
      const next = { ...trails };
      delete next[markerId];
      return next;
    });
    if (selectedMarkerId === markerId) setSelectedMarkerId(null);
    setContextMenu(null);
    cancelInteraction();
    Logger.info('玩家地图标记已删除: ' + String(marker.number));
    notify('玩家 ' + String(marker.number) + ' 的本轮标记已删除', true);
  };

  const setPlayerRole = (playerNumber: number, role?: RoleKey) => {
    pushHistory();
    setRoleAssignments(previous => {
      const next = { ...previous };
      if (role) next[playerNumber] = role;
      else delete next[playerNumber];
      return next;
    });
  };

  const toggleDeadState = (playerNumber: number) => {
    pushHistory();
    setDeadMarkers(previous => {
      const alreadyDead = isDead(currentSequence, playerNumber);
      if (alreadyDead) {
        const next = { ...previous };
        for (let sequence = currentSequence; sequence <= 10; sequence += 1) {
          delete next[String(sequence) + '-' + String(playerNumber)];
        }
        return next;
      }
      return {
        ...previous,
        [String(currentSequence) + '-' + String(playerNumber)]: true,
      };
    });
  };

  const startDrawingPath = (markerId: number) => {
    setSelectedMarkerId(markerId);
    setSelectedConnection(null);
    setContextMenu(null);
    setActiveTrailSegment(null);
    setInteraction({ kind: 'drawing-path', markerId });
  };

  const finishDrawingPath = () => {
    setActiveTrailSegment(null);
    setInteraction({ kind: 'idle' });
    notify('路径绘制已完成');
  };

  const undoLastPathSegment = (markerId: number) => {
    const segments = markerTrails[markerId] || [];
    if (segments.length === 0) return;
    pushHistory();
    setCurrentMarkerTrails(previous => ({
      ...previous,
      [markerId]: (previous[markerId] || []).slice(0, -1),
    }));
  };

  const clearMarkerPath = (markerId: number) => {
    if (!(markerTrails[markerId] || []).length) return;
    pushHistory();
    setCurrentMarkerTrails(previous => {
      const next = { ...previous };
      delete next[markerId];
      return next;
    });
    setActiveTrailSegment(null);
    notify('玩家路径已清除', true);
  };

  const inheritMarker = (sourceMarker: MapMarker, recordHistory = true) => {
    if (recordHistory) pushHistory();
    markerIdRef.current += 1;
    const marker: MapMarker = {
      ...sourceMarker,
      id: markerIdRef.current,
      sequence: currentSequence,
    };
    setCurrentMapMarkers(markers => [...markers, marker]);
    setSelectedMarkerId(marker.id);
    setInteraction({ kind: 'idle' });
  };

  const inheritPreviousRound = () => {
    if (previousSequenceMarkers.length === 0) return;
    pushHistory();
    const inherited = previousSequenceMarkers.map(source => {
      markerIdRef.current += 1;
      return {
        ...source,
        id: markerIdRef.current,
        sequence: currentSequence,
      };
    });
    setCurrentMapMarkers(markers => [...markers, ...inherited]);
    notify('已沿用上一轮的 ' + String(inherited.length) + ' 个位置', true);
  };

  const clearCurrentRound = () => {
    if (currentSequenceMarkers.length === 0) return;
    pushHistory();
    const removedIds = new Set(currentSequenceMarkers.map(marker => marker.id));
    setCurrentMapMarkers(markers =>
      markers.filter(marker => marker.sequence !== currentSequence)
    );
    setCurrentConnections(items =>
      items.filter(
        connection => !removedIds.has(connection.from) && !removedIds.has(connection.to)
      )
    );
    setCurrentMarkerTrails(previous => {
      const next = { ...previous };
      removedIds.forEach(markerId => delete next[markerId]);
      return next;
    });
    setSelectedMarkerId(null);
    setSelectedConnection(null);
    cancelInteraction();
    setClearMenuOpen(false);
    notify('第 ' + String(currentSequence) + ' 轮标注已清除', true);
  };

  const clearCurrentMap = () => {
    if (mapMarkers.length === 0) return;
    if (!window.confirm('清除当前地图全部轮次的标记、路径和连线？')) return;
    pushHistory();
    setCurrentMapMarkers([]);
    setCurrentConnections([]);
    setCurrentMarkerTrails({});
    setSelectedMarkerId(null);
    setSelectedConnection(null);
    cancelInteraction();
    setClearMenuOpen(false);
    notify('当前地图标注已清除', true);
  };

  const clearIdentityData = () => {
    if (Object.keys(roleAssignments).length === 0 && Object.keys(deadMarkers).length === 0) return;
    if (!window.confirm('清除整场所有玩家的身份和生死状态？')) return;
    pushHistory();
    setRoleAssignments({});
    setDeadMarkers({});
    setClearMenuOpen(false);
    notify('玩家身份信息已清除', true);
  };

  const openMarkerMenu = (
    event: ReactMouseEvent<HTMLElement>,
    markerId: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() < suppressContextMenuUntilRef.current) return;
    const point = getMenuPoint(event.clientX, event.clientY);
    setSelectedMarkerId(markerId);
    setSelectedConnection(null);
    setContextMenu({ kind: 'marker', markerId, x: point.x, y: point.y });
  };

  const openConnectionMenu = (
    event: ReactMouseEvent<SVGLineElement>,
    connection: Connection
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const point = getMenuPoint(event.clientX, event.clientY);
    setSelectedConnection(connection);
    setSelectedMarkerId(null);
    setContextMenu({ kind: 'connection', connection, x: point.x, y: point.y });
  };

  const beginMarkerMouseDown = (
    event: ReactMouseEvent<HTMLButtonElement>,
    marker: MapMarker
  ) => {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      rightGestureRef.current = {
        markerId: marker.id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      setSelectedMarkerId(marker.id);
      setSelectedConnection(null);
      return;
    }

    if (event.button !== 0) return;
    if (interaction.kind === 'connecting') {
      event.preventDefault();
      event.stopPropagation();
      addConnection(interaction.fromMarkerId, marker.id);
      return;
    }
    if (interaction.kind === 'drawing-path') return;

    event.preventDefault();
    event.stopPropagation();
    const rect = mapStageRef.current?.getBoundingClientRect();
    if (!rect) return;
    markerDragRef.current = {
      markerId: marker.id,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left - (marker.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (marker.y / 100) * rect.height,
      moved: false,
      snapshot: cloneSnapshot(),
    };
    setDraggingMarkerId(marker.id);
    setSelectedMarkerId(marker.id);
    setSelectedConnection(null);
    setInteraction({ kind: 'idle' });
    setContextMenu(null);
  };

  const handleStageMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || interaction.kind !== 'drawing-path') return;
    if ((event.target as Element).closest('.map-v2-context-menu, .map-v2-mode-banner')) return;
    const point = getMapPoint(event.clientX, event.clientY);
    const marker = currentSequenceMarkers.find(item => item.id === interaction.markerId);
    if (!point || !marker) return;
    event.preventDefault();
    const existingSegments = markerTrails[marker.id] || [];
    setActiveTrailSegment(
      existingSegments.length === 0
        ? [{ x: marker.x, y: marker.y }, point]
        : [point]
    );
  };

  const handleStageMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const point = getMapPoint(event.clientX, event.clientY);
    if (point) setCursorPoint(point);

    if (interaction.kind === 'drawing-path' && activeTrailSegment && point) {
      const last = activeTrailSegment[activeTrailSegment.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 0.8) {
        setActiveTrailSegment(previous => previous ? [...previous, point] : [point]);
      }
    }

    const markerDrag = markerDragRef.current;
    if (markerDrag && mapStageRef.current) {
      const distance = Math.hypot(
        event.clientX - markerDrag.startX,
        event.clientY - markerDrag.startY
      );
      if (distance > 4) markerDrag.moved = true;
      if (markerDrag.moved) {
        const rect = mapStageRef.current.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(
            100,
            ((event.clientX - rect.left - markerDrag.offsetX) / rect.width) * 100
          )
        );
        const y = Math.max(
          0,
          Math.min(
            100,
            ((event.clientY - rect.top - markerDrag.offsetY) / rect.height) * 100
          )
        );
        setCurrentMapMarkers(markers =>
          markers.map(marker =>
            marker.id === markerDrag.markerId ? { ...marker, x, y } : marker
          )
        );
      }
    }

    const rightGesture = rightGestureRef.current;
    if (rightGesture) {
      const distance = Math.hypot(
        event.clientX - rightGesture.startX,
        event.clientY - rightGesture.startY
      );
      if (distance > 4 && !rightGesture.moved) {
        rightGesture.moved = true;
        setRightDragFromId(rightGesture.markerId);
        setInteraction({
          kind: 'connecting',
          fromMarkerId: rightGesture.markerId,
          via: 'right-drag',
        });
      }
      if (rightGesture.moved) {
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-map-marker-id]') as HTMLElement | null;
        const targetId = target ? Number(target.dataset.mapMarkerId) : null;
        setRightDragTargetId(
          targetId && targetId !== rightGesture.markerId ? targetId : null
        );
      }
    }
  };

  const finishMarkerDrag = () => {
    const markerDrag = markerDragRef.current;
    if (markerDrag?.moved) {
      pushHistory(markerDrag.snapshot);
      notify('标记位置已更新', true);
    }
    markerDragRef.current = null;
    setDraggingMarkerId(null);
  };

  const finishRightGesture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rightGesture = rightGestureRef.current;
    if (!rightGesture) return;
    if (rightGesture.moved) {
      suppressContextMenuUntilRef.current = Date.now() + 300;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-map-marker-id]') as HTMLElement | null;
      const targetId = target ? Number(target.dataset.mapMarkerId) : null;
      if (targetId && targetId !== rightGesture.markerId) {
        addConnection(rightGesture.markerId, targetId);
      } else {
        cancelInteraction();
      }
    }
    rightGestureRef.current = null;
    setRightDragFromId(null);
    setRightDragTargetId(null);
  };

  const handleStageMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      event.button === 0 &&
      interaction.kind === 'drawing-path' &&
      activeTrailSegment
    ) {
      if (activeTrailSegment.length > 1) {
        pushHistory();
        const markerId = interaction.markerId;
        setCurrentMarkerTrails(previous => ({
          ...previous,
          [markerId]: [...(previous[markerId] || []), activeTrailSegment],
        }));
      }
      setActiveTrailSegment(null);
    }
    if (event.button === 0) finishMarkerDrag();
    if (event.button === 2) finishRightGesture(event);
  };

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(
      '.map-v2-marker, .map-v2-ghost-marker, .map-v2-context-menu, .map-v2-mode-banner'
    )) return;
    setContextMenu(null);
    setClearMenuOpen(false);
    if (interaction.kind === 'placing') {
      const point = getMapPoint(event.clientX, event.clientY);
      if (point) placeMarker(interaction.playerNumber, point);
      return;
    }
    if (interaction.kind === 'connecting') {
      cancelInteraction();
      return;
    }
    if (interaction.kind !== 'drawing-path') {
      setSelectedMarkerId(null);
      setSelectedRosterNumber(null);
      setSelectedConnection(null);
    }
  };

  const handleRosterDragStart = (
    event: DragEvent<HTMLButtonElement>,
    playerNumber: number
  ) => {
    setDraggedRosterNumber(playerNumber);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', String(playerNumber));
  };

  const handleRosterDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const playerNumber =
      draggedRosterNumber || Number(event.dataTransfer.getData('text/plain'));
    const point = getMapPoint(event.clientX, event.clientY);
    if (playerNumber && point) placeMarker(playerNumber, point);
    setDraggedRosterNumber(null);
  };

  const changeSequence = (sequence: number) => {
    cancelInteraction();
    setSelectedMarkerId(null);
    setSelectedRosterNumber(null);
    setSelectedConnection(null);
    setContextMenu(null);
    setCurrentSequence(sequence);
  };

  useEffect(() => {
    cancelInteraction();
    setSelectedMarkerId(null);
    setSelectedRosterNumber(null);
    setSelectedConnection(null);
    setContextMenu(null);
    setClearMenuOpen(false);
  }, [selectedMap, currentSequence, cancelInteraction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (interaction.kind !== 'idle') cancelInteraction();
        else {
          setSelectedMarkerId(null);
          setSelectedRosterNumber(null);
          setSelectedConnection(null);
        }
        setContextMenu(null);
        setClearMenuOpen(false);
        return;
      }
      if (event.key === 'Enter' && interaction.kind === 'drawing-path') {
        event.preventDefault();
        finishDrawingPath();
        return;
      }
      if (event.key === 'Delete') {
        if (selectedConnection) {
          event.preventDefault();
          removeConnection(selectedConnection);
        } else if (selectedMarkerId !== null) {
          event.preventDefault();
          removeMarker(selectedMarkerId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const getMarkerNumber = (markerId: number): number | null =>
    mapMarkers.find(marker => marker.id === markerId)?.number ?? null;

  const activeConnectionFromMarker = interaction.kind === 'connecting'
    ? currentSequenceMarkers.find(marker => marker.id === interaction.fromMarkerId) || null
    : null;
  const currentConnections = connections.filter(connection => {
    const from = currentSequenceMarkers.some(marker => marker.id === connection.from);
    const to = currentSequenceMarkers.some(marker => marker.id === connection.to);
    return from && to;
  });

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const style = { left: contextMenu.x, top: contextMenu.y };

    if (contextMenu.kind === 'marker') {
      const marker = currentSequenceMarkers.find(item => item.id === contextMenu.markerId);
      if (!marker) return null;
      return (
        <div
          className="map-v2-context-menu"
          style={style}
          role="menu"
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <div className="map-v2-context-title">玩家 {marker.number}</div>
          <button type="button" onClick={() => startConnection(marker.id)}>
            连接到其他玩家
            <span>右键拖动</span>
          </button>
          <button type="button" onClick={() => startDrawingPath(marker.id)}>
            绘制路径
          </button>
          <button type="button" onClick={() => {
            toggleDeadState(marker.number);
            setContextMenu(null);
          }}>
            {isDead(currentSequence, marker.number) ? '标记复活' : '标记死亡'}
          </button>
          <div className="map-v2-context-separator" />
          <button
            type="button"
            className="danger"
            onClick={() => removeMarker(marker.id)}
          >
            删除本轮标记
          </button>
        </div>
      );
    }

    if (contextMenu.kind === 'connection') {
      const fromNumber = getMarkerNumber(contextMenu.connection.from);
      const toNumber = getMarkerNumber(contextMenu.connection.to);
      return (
        <div
          className="map-v2-context-menu compact"
          style={style}
          role="menu"
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <div className="map-v2-context-title">
            玩家 {fromNumber ?? '?'} ↔ {toNumber ?? '?'}
          </div>
          <button
            type="button"
            className="danger"
            onClick={() => removeConnection(contextMenu.connection)}
          >
            <Icon name="trash" size={13} />
            删除连线
          </button>
        </div>
      );
    }

    return (
      <div
        className="map-v2-context-menu compact"
        style={style}
        role="menu"
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      >
        <div className="map-v2-context-title">画布操作</div>
        <button type="button" disabled={historyState.undo === 0} onClick={undo}>
          撤销
          <span>Ctrl Z</span>
        </button>
        <button type="button" disabled={historyState.redo === 0} onClick={redo}>
          重做
          <span>Ctrl Y</span>
        </button>
        <div className="map-v2-context-separator" />
        <button type="button" className="danger" onClick={clearCurrentRound}>
          清除当前轮次
        </button>
      </div>
    );
  };

  const renderInspector = () => {
    if (selectedPlayerNumber === null) {
      return (
        <div className="map-v2-inspector-empty">
          <div className="map-v2-inspector-heading">
            <span>当前场景</span>
            <h3>{mapNameMapping[selectedMap]}</h3>
          </div>
          <div className="map-v2-scene-stats">
            <div><span>轮次</span><strong>{currentSequence}</strong></div>
            <div><span>玩家</span><strong>{currentSequenceMarkers.length}</strong></div>
            <div><span>连线</span><strong>{currentConnections.length}</strong></div>
            <div>
              <span>路径</span>
              <strong>
                {currentSequenceMarkers.reduce(
                  (count, marker) => count + (markerTrails[marker.id] || []).length,
                  0
                )}
              </strong>
            </div>
          </div>
          <div className="map-v2-empty-guide">
            <strong>从玩家开始</strong>
            <p>点击左侧玩家即可先设置身份；需要上图时再拖入地图或使用放置按钮。</p>
          </div>
          <div className="map-v2-shortcuts">
            <span><kbd>右键拖动</kbd> 创建连线</span>
            <span><kbd>Delete</kbd> 删除选中项</span>
            <span><kbd>Esc</kbd> 取消当前操作</span>
          </div>
        </div>
      );
    }

    const role = roleAssignments[selectedPlayerNumber];
    const dead = isDead(currentSequence, selectedPlayerNumber);
    const deathRound = deathRoundFor(currentSequence, selectedPlayerNumber);
    const trailSegments = selectedMarker ? markerTrails[selectedMarker.id] || [] : [];
    const drawingThisMarker =
      selectedMarker !== null &&
      interaction.kind === 'drawing-path' && interaction.markerId === selectedMarker.id;
    const connectingThisMarker =
      selectedMarker !== null &&
      interaction.kind === 'connecting' && interaction.fromMarkerId === selectedMarker.id;
    const placingThisPlayer =
      interaction.kind === 'placing' && interaction.playerNumber === selectedPlayerNumber;

    return (
      <div className="map-v2-inspector-active">
        <div className="map-v2-player-summary">
          <div className={'map-v2-player-avatar ' + (role ? roleMeta[role].className : '')}>
            {selectedPlayerNumber}
          </div>
          <div>
            <span>{selectedMarker ? '当前玩家 · 已放置' : '当前玩家 · 未放置'}</span>
            <h3>玩家 {selectedPlayerNumber}</h3>
          </div>
          <span
            className={
              'map-v2-life-pill ' + (!selectedMarker ? 'unplaced' : dead ? 'dead' : 'alive')
            }
          >
            {!selectedMarker ? '未上图' : dead ? '死亡' : '存活'}
          </span>
        </div>

        <div className="map-v2-inspector-section">
          <div className="map-v2-field-label">身份</div>
          <div className="map-v2-role-grid">
            <button
              type="button"
              className={!role ? 'active unknown' : ''}
              onClick={() => setPlayerRole(selectedPlayerNumber)}
            >
              未知
            </button>
            {(Object.keys(roleMeta) as RoleKey[]).map(roleKey => (
              <button
                type="button"
                key={roleKey}
                className={
                  (role === roleKey ? 'active ' : '') + roleMeta[roleKey].className
                }
                onClick={() => setPlayerRole(selectedPlayerNumber, roleKey)}
              >
                <span className={'map-v2-role-dot ' + roleMeta[roleKey].className} />
                {roleMeta[roleKey].label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-v2-inspector-section">
          <div className="map-v2-field-label">本轮状态</div>
          <button
            type="button"
            className={'map-v2-status-toggle ' + (dead ? 'dead' : 'alive')}
            onClick={() => toggleDeadState(selectedPlayerNumber)}
          >
            <Icon name="ghost" size={14} />
            <span>
              <strong>{dead ? '标记复活' : '标记死亡'}</strong>
              <small>
                {dead && deathRound
                  ? '死亡状态始于第 ' + String(deathRound) + ' 轮'
                  : '从当前轮次开始生效'}
              </small>
            </span>
          </button>
        </div>

        {selectedMarker ? (
          <>
            <div className="map-v2-inspector-section">
              <div className="map-v2-field-label">地图操作</div>
              <div className="map-v2-inspector-actions">
                <button
                  type="button"
                  className={drawingThisMarker ? 'active' : ''}
                  onClick={() =>
                    drawingThisMarker
                      ? finishDrawingPath()
                      : startDrawingPath(selectedMarker.id)
                  }
                >
                  {drawingThisMarker ? '完成路径' : '绘制路径'}
                  {trailSegments.length > 0 && <span>{trailSegments.length}</span>}
                </button>
                <button
                  type="button"
                  className={connectingThisMarker ? 'active' : ''}
                  onClick={() =>
                    connectingThisMarker
                      ? cancelInteraction()
                      : startConnection(selectedMarker.id)
                  }
                >
                  {connectingThisMarker ? '取消连接' : '连接玩家'}
                </button>
              </div>
              {trailSegments.length > 0 && (
                <div className="map-v2-path-actions">
                  <button type="button" onClick={() => undoLastPathSegment(selectedMarker.id)}>
                    撤销上一段
                  </button>
                  <button type="button" onClick={() => clearMarkerPath(selectedMarker.id)}>
                    清除路径
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="map-v2-delete-marker"
              onClick={() => removeMarker(selectedMarker.id)}
            >
              <Icon name="trash" size={14} />
              删除本轮标记
            </button>

            <div className="map-v2-inspector-tip">
              右键打开快捷菜单，右键拖到另一位玩家可直接连线。
            </div>
          </>
        ) : (
          <>
            <div className="map-v2-inspector-section">
              <div className="map-v2-field-label">地图标记</div>
              <button
                type="button"
                className={'map-v2-place-player ' + (placingThisPlayer ? 'active' : '')}
                onClick={() =>
                  placingThisPlayer
                    ? cancelInteraction()
                    : startPlacingPlayer(selectedPlayerNumber)
                }
              >
                <span>{placingThisPlayer ? '等待地图落点' : '放置到地图'}</span>
                <small>
                  {placingThisPlayer ? '点击地图确定位置，Esc 取消' : '也可以从左侧直接拖入地图'}
                </small>
              </button>
            </div>

            <div className="map-v2-inspector-tip">
              身份已独立保存；现在不放置标记，也不会丢失设置。
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="entertainment-section map-v2">
      <div className="map-v2-commandbar">
        <label className="map-v2-map-select">
          <span>地图</span>
          <select
            value={selectedMap}
            onChange={event => setSelectedMap(Number(event.target.value))}
          >
            {Object.entries(mapNameMapping).map(([mapId, mapName]) => (
              <option key={mapId} value={mapId}>{mapName}</option>
            ))}
          </select>
        </label>

        <div className="map-v2-rounds" aria-label="轮次时间线">
          <span className="map-v2-rounds-label">轮次</span>
          <div className="map-v2-round-list">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(sequence => {
              const count = mapMarkers.filter(marker => marker.sequence === sequence).length;
              const hasDeathEvent = Object.keys(deadMarkers).some(
                key => key.startsWith(String(sequence) + '-')
              );
              return (
                <button
                  type="button"
                  key={sequence}
                  className={currentSequence === sequence ? 'active' : ''}
                  onClick={() => changeSequence(sequence)}
                  title={'第 ' + String(sequence) + ' 轮，' + String(count) + ' 个标记'}
                >
                  <span>{sequence}</span>
                  {count > 0 && <small>{count}</small>}
                  {hasDeathEvent && <i aria-label="本轮有状态事件" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-v2-command-actions">
          <button
            type="button"
            className="map-v2-history-button"
            disabled={historyState.undo === 0}
            onClick={undo}
            title="撤销 Ctrl+Z"
          >
            ↶
          </button>
          <button
            type="button"
            className="map-v2-history-button"
            disabled={historyState.redo === 0}
            onClick={redo}
            title="重做 Ctrl+Y"
          >
            ↷
          </button>
          <div className="map-v2-clear-wrap">
            <button
              type="button"
              className="map-v2-clear-trigger"
              onClick={() => setClearMenuOpen(open => !open)}
            >
              清除
              <span aria-hidden="true">⌄</span>
            </button>
            {clearMenuOpen && (
              <div className="map-v2-clear-menu">
                <button type="button" onClick={clearCurrentRound}>
                  清除第 {currentSequence} 轮
                  <span>{currentSequenceMarkers.length} 个标记</span>
                </button>
                <button type="button" onClick={clearCurrentMap}>
                  清除当前地图全部轮次
                </button>
                <button type="button" className="danger" onClick={clearIdentityData}>
                  清除整场身份信息
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="map-v2-layout">
        <aside className="map-v2-roster">
          <div className="map-v2-panel-heading">
            <div>
              <span>PLAYERS</span>
              <h3>玩家</h3>
            </div>
            <strong>{currentSequenceMarkers.length}/16</strong>
          </div>
          <p className="map-v2-roster-hint">点击玩家设置身份；需要上图时直接拖入地图。</p>
          <div className="map-v2-player-grid">
            {Array.from({ length: 16 }, (_, index) => index + 1).map(playerNumber => {
              const marker = currentSequenceMarkers.find(
                item => item.number === playerNumber
              );
              const role = roleAssignments[playerNumber];
              const dead = isDead(currentSequence, playerNumber);
              const placing =
                interaction.kind === 'placing' &&
                interaction.playerNumber === playerNumber;
              const selected = playerNumber === selectedPlayerNumber;
              const className = [
                marker ? 'placed' : 'unplaced',
                placing ? 'placing' : '',
                selected ? 'selected' : '',
                role ? 'role-' + roleMeta[role].className : '',
                dead ? 'dead' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  key={playerNumber}
                  className={className}
                  onClick={() => selectRosterPlayer(playerNumber)}
                  aria-pressed={selected}
                  draggable
                  onDragStart={event => handleRosterDragStart(event, playerNumber)}
                  onDragEnd={() => setDraggedRosterNumber(null)}
                  title={
                    marker
                      ? '玩家 ' + String(playerNumber) + ' 已放置，点击查看身份与地图操作'
                      : '玩家 ' + String(playerNumber) + ' 未放置，点击设置身份，拖动可放置'
                  }
                >
                  <span>{playerNumber}</span>
                  <i className="map-v2-player-status" />
                  {dead && <b>×</b>}
                </button>
              );
            })}
          </div>
          <div className="map-v2-roster-legend">
            <span><i className="placed" /> 已放置</span>
            <span><i /> 未放置</span>
          </div>
        </aside>

        <main className="map-v2-canvas-panel">
          <div className="map-v2-canvas-header">
            <div className="map-v2-map-title">
              <img src={'/img/' + String(selectedMap) + '.png'} alt="" />
              <div>
                <span>当前地图 · 第 {currentSequence} 轮</span>
                <h3>{mapNameMapping[selectedMap]}</h3>
              </div>
            </div>
            <div className="map-v2-canvas-help">
              拖动标记移动 · 右键拖动连线
            </div>
          </div>

          {previousSequenceMarkers.length > 0 && (
            <div className="map-v2-inherit-bar">
              <span>
                上一轮还有 {previousSequenceMarkers.length} 位玩家未放置
              </span>
              <button type="button" onClick={inheritPreviousRound}>
                全部沿用
              </button>
            </div>
          )}

          <div className="map-v2-canvas-shell">
            <div
              ref={mapStageRef}
              className={[
                'map-v2-stage',
                interaction.kind === 'placing' ? 'is-placing' : '',
                interaction.kind === 'drawing-path' ? 'is-drawing' : '',
                interaction.kind === 'connecting' ? 'is-connecting' : '',
                draggedRosterNumber !== null ? 'is-drag-over' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--map-aspect-ratio': mapAspectRatio } as CSSProperties}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onMouseLeave={() => {
                finishMarkerDrag();
                if (rightGestureRef.current?.moved) cancelInteraction();
                rightGestureRef.current = null;
                setRightDragFromId(null);
                setRightDragTargetId(null);
              }}
              onClick={handleCanvasClick}
              onContextMenu={event => {
                event.preventDefault();
                if (Date.now() < suppressContextMenuUntilRef.current) return;
                if ((event.target as Element).closest(
                  '.map-v2-marker, .map-v2-connection-hit, .map-v2-context-menu'
                )) return;
                const point = getMenuPoint(event.clientX, event.clientY);
                setContextMenu({ kind: 'canvas', x: point.x, y: point.y });
              }}
              onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleRosterDrop}
            >
              <img
                className="map-v2-image"
                src={'/img/' + String(selectedMap) + '.png'}
                alt={mapNameMapping[selectedMap]}
                draggable={false}
                onLoad={event => {
                  const image = event.currentTarget;
                  if (image.naturalWidth && image.naturalHeight) {
                    setMapAspectRatio(image.naturalWidth / image.naturalHeight);
                  }
                }}
              />

              <svg
                className="map-v2-annotation-layer"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="地图连线和路径"
              >
                {currentSequenceMarkers.map(marker => {
                  const segments = markerTrails[marker.id] || [];
                  const drafts =
                    interaction.kind === 'drawing-path' &&
                    interaction.markerId === marker.id &&
                    activeTrailSegment
                      ? [activeTrailSegment]
                      : [];
                  const color = roleAssignments[marker.number]
                    ? roleMeta[roleAssignments[marker.number]].color
                    : '#567da7';
                  return [...segments, ...drafts].map((segment, index) => (
                    <polyline
                      key={'trail-' + String(marker.id) + '-' + String(index)}
                      points={segment.map(point => String(point.x) + ',' + String(point.y)).join(' ')}
                      fill="none"
                      stroke={color}
                      strokeWidth="0.55"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={index >= segments.length ? '1.2 1' : undefined}
                      opacity={index >= segments.length ? 0.72 : 0.88}
                    />
                  ));
                })}

                {currentConnections.map(connection => {
                  const from = currentSequenceMarkers.find(
                    marker => marker.id === connection.from
                  );
                  const to = currentSequenceMarkers.find(
                    marker => marker.id === connection.to
                  );
                  if (!from || !to) return null;
                  const selected =
                    selectedConnection &&
                    connectionKey(selectedConnection) === connectionKey(connection);
                  return (
                    <g key={connectionKey(connection)}>
                      <line
                        className="map-v2-connection-hit"
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="transparent"
                        strokeWidth="2.5"
                        role="button"
                        tabIndex={0}
                        aria-label={
                          '玩家 ' + String(from.number) + ' 与玩家 ' + String(to.number) + ' 的连线'
                        }
                        onClick={event => openConnectionMenu(event, connection)}
                        onContextMenu={event => openConnectionMenu(event, connection)}
                        onKeyDown={event => {
                          if (event.key === 'Delete' || event.key === 'Backspace') {
                            event.preventDefault();
                            removeConnection(connection);
                          }
                        }}
                      />
                      <line
                        className={'map-v2-connection-line ' + (selected ? 'selected' : '')}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        strokeWidth={selected ? 0.72 : 0.5}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {interaction.kind === 'connecting' && activeConnectionFromMarker && (
                  <line
                    className="map-v2-connection-preview"
                    x1={activeConnectionFromMarker.x}
                    y1={activeConnectionFromMarker.y}
                    x2={cursorPoint.x}
                    y2={cursorPoint.y}
                    strokeWidth="0.5"
                    pointerEvents="none"
                  />
                )}
              </svg>

              {previousSequenceMarkers.map(marker => (
                <button
                  type="button"
                  key={'ghost-' + String(marker.id)}
                  className="map-v2-ghost-marker"
                  style={{ left: String(marker.x) + '%', top: String(marker.y) + '%' }}
                  onClick={event => {
                    event.stopPropagation();
                    inheritMarker(marker);
                  }}
                  title={'沿用玩家 ' + String(marker.number) + ' 的上一轮位置'}
                >
                  {marker.number}
                </button>
              ))}

              {currentSequenceMarkers.map(marker => {
                const role = roleAssignments[marker.number];
                const className = [
                  'map-v2-marker',
                  role ? 'role-' + roleMeta[role].className : '',
                  marker.id === selectedMarkerId ? 'selected' : '',
                  marker.id === draggingMarkerId ? 'dragging' : '',
                  marker.id === rightDragFromId ? 'connection-source' : '',
                  marker.id === rightDragTargetId ? 'connection-target' : '',
                  isDead(currentSequence, marker.number) ? 'dead' : '',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    type="button"
                    key={marker.id}
                    data-map-marker-id={marker.id}
                    className={className}
                    style={{ left: String(marker.x) + '%', top: String(marker.y) + '%' }}
                    onMouseDown={event => beginMarkerMouseDown(event, marker)}
                    onClick={event => event.stopPropagation()}
                    onContextMenu={event => openMarkerMenu(event, marker.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedMarkerId(marker.id);
                      }
                    }}
                    aria-label={'玩家 ' + String(marker.number)}
                  >
                    {marker.number}
                    {isDead(currentSequence, marker.number) && <span>×</span>}
                  </button>
                );
              })}

              {interaction.kind === 'placing' && (
                <div
                  className="map-v2-placement-cursor"
                  style={{ left: String(cursorPoint.x) + '%', top: String(cursorPoint.y) + '%' }}
                >
                  {interaction.playerNumber}
                </div>
              )}

              {interaction.kind !== 'idle' && (
                <div
                  className="map-v2-mode-banner"
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => event.stopPropagation()}
                >
                  <div>
                    <strong>
                      {interaction.kind === 'placing' &&
                        '放置玩家 ' + String(interaction.playerNumber)}
                      {interaction.kind === 'connecting' &&
                        '连接玩家 ' + String(activeConnectionFromMarker?.number ?? '?')}
                      {interaction.kind === 'drawing-path' &&
                        '为玩家 ' + String(drawingMarker?.number ?? '?') + ' 绘制路径'}
                    </strong>
                    <span>
                      {interaction.kind === 'placing' && '点击地图确定位置'}
                      {interaction.kind === 'connecting' && '点击目标玩家，或按 Esc 取消'}
                      {interaction.kind === 'drawing-path' && '按住左键绘制，松开完成一段'}
                    </span>
                  </div>
                  {interaction.kind === 'drawing-path' && drawingMarker && (
                    <button
                      type="button"
                      onClick={() => undoLastPathSegment(drawingMarker.id)}
                      disabled={(markerTrails[drawingMarker.id] || []).length === 0}
                    >
                      撤销一段
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      interaction.kind === 'drawing-path'
                        ? finishDrawingPath()
                        : cancelInteraction()
                    }
                  >
                    {interaction.kind === 'drawing-path' ? '完成' : '取消'}
                  </button>
                </div>
              )}

              {renderContextMenu()}
            </div>
          </div>
        </main>

        <aside className="map-v2-inspector">
          {renderInspector()}
        </aside>
      </div>

      {toast && (
        <div className="map-v2-toast" role="status">
          <span>{toast.message}</span>
          {toast.canUndo && historyState.undo > 0 && (
            <button type="button" onClick={() => {
              undo();
              setToast(null);
            }}>
              撤销
            </button>
          )}
          <button
            type="button"
            className="close"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}

export default MapTab;
