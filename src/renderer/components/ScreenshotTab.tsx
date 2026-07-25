import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import Icon from './Icon';

type DrawingTool = 'pen' | 'arrow' | 'rect' | 'ellipse' | 'text';
type Tool = DrawingTool | 'eraser';
type Point = { x: number; y: number };
type ScreenshotData = { dataUrl: string; width: number; height: number };
type Annotation = {
  id: number;
  type: DrawingTool;
  points: Point[];
  color: string;
  lineWidth: number;
  text?: string;
  fontSize?: number;
};

const COLORS = ['#ef4444', '#f59e0b', '#22a06b', '#3b82c4', '#ffffff', '#17181a'];
const STROKE_WIDTHS = [2, 4, 7];
const TOOL_META: Record<Tool, { label: string; shortcut: string; hint: string }> = {
  pen: { label: '画笔', shortcut: 'P', hint: '按住拖动自由绘制' },
  arrow: { label: '箭头', shortcut: 'A', hint: '拖动标记重点方向' },
  rect: { label: '矩形', shortcut: 'R', hint: '拖动框选重点区域' },
  ellipse: { label: '椭圆', shortcut: 'O', hint: '拖动圈出重点区域' },
  text: { label: '文字', shortcut: 'T', hint: '点击图片添加文字' },
  eraser: { label: '擦除', shortcut: 'E', hint: '点击已有标注将其删除' },
};

const drawArrow = (
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  lineWidth: number
) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(12, lineWidth * 4.2);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  context.stroke();
};

const drawAnnotation = (
  context: CanvasRenderingContext2D,
  annotation: Annotation
) => {
  if (!annotation.points.length) return;
  context.save();
  context.strokeStyle = annotation.color;
  context.fillStyle = annotation.color;
  context.lineWidth = annotation.lineWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (annotation.type === 'pen' && annotation.points.length > 1) {
    context.beginPath();
    context.moveTo(annotation.points[0].x, annotation.points[0].y);
    annotation.points.slice(1).forEach(point => context.lineTo(point.x, point.y));
    context.stroke();
  } else if (annotation.type === 'arrow' && annotation.points.length === 2) {
    drawArrow(
      context,
      annotation.points[0],
      annotation.points[1],
      annotation.lineWidth
    );
  } else if (annotation.type === 'rect' && annotation.points.length === 2) {
    const [start, end] = annotation.points;
    context.strokeRect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y)
    );
  } else if (annotation.type === 'ellipse' && annotation.points.length === 2) {
    const [start, end] = annotation.points;
    context.beginPath();
    context.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      Math.abs(end.x - start.x) / 2,
      Math.abs(end.y - start.y) / 2,
      0,
      0,
      Math.PI * 2
    );
    context.stroke();
  } else if (annotation.type === 'text' && annotation.text) {
    context.font =
      '600 ' + String(annotation.fontSize || 20) + 'px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    context.textBaseline = 'top';
    context.fillText(annotation.text, annotation.points[0].x, annotation.points[0].y);
  }
  context.restore();
};

const redrawAnnotations = (
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  draft?: Annotation | null
) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  annotations.forEach(annotation => drawAnnotation(context, annotation));
  if (draft) drawAnnotation(context, draft);
};

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
};

const hitAnnotation = (
  annotation: Annotation,
  point: Point,
  threshold: number
): boolean => {
  if (annotation.type === 'pen' || annotation.type === 'arrow') {
    return annotation.points
      .slice(0, -1)
      .some((start, index) =>
        distanceToSegment(point, start, annotation.points[index + 1]) <= threshold
      );
  }
  if (annotation.type === 'text' && annotation.text) {
    const fontSize = annotation.fontSize || 20;
    const width = annotation.text.length * fontSize * 0.72;
    const start = annotation.points[0];
    return (
      point.x >= start.x - threshold &&
      point.x <= start.x + width + threshold &&
      point.y >= start.y - threshold &&
      point.y <= start.y + fontSize * 1.3 + threshold
    );
  }
  if (annotation.points.length !== 2) return false;
  const [start, end] = annotation.points;
  const left = Math.min(start.x, end.x) - threshold;
  const right = Math.max(start.x, end.x) + threshold;
  const top = Math.min(start.y, end.y) - threshold;
  const bottom = Math.max(start.y, end.y) + threshold;
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
};

function ToolGlyph({ tool }: { tool: Tool }): ReactElement {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (tool === 'pen') {
    return <svg {...common}><path d="m4 20 4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z" /><path d="m13 6 5 5" /></svg>;
  }
  if (tool === 'arrow') {
    return <svg {...common}><path d="M5 19 19 5" /><path d="M11 5h8v8" /></svg>;
  }
  if (tool === 'rect') {
    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
  }
  if (tool === 'ellipse') {
    return <svg {...common}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>;
  }
  if (tool === 'text') {
    return <svg {...common}><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M9 20h6" /></svg>;
  }
  return <svg {...common}><path d="m4 15 7-9 9 7-6 7H8l-4-5Z" /><path d="m10 20 6-8" /></svg>;
}

function ScreenshotTab() {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState<Point>({ x: 0, y: 0 });
  const [textDisplayPos, setTextDisplayPos] = useState<Point>({ x: 0, y: 0 });
  const [textDraft, setTextDraft] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAnnotationRef = useRef<Annotation | null>(null);
  const annotationsRef = useRef<Annotation[]>([]);
  const annotationIdRef = useRef(0);

  useEffect(() => {
    annotationsRef.current = annotations;
    if (canvasRef.current) redrawAnnotations(canvasRef.current, annotations);
  }, [annotations]);

  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const fitStage = useCallback(() => {
    if (!screenshot || !viewportRef.current || !stageRef.current) return;
    const bounds = viewportRef.current.getBoundingClientRect();
    const availableWidth = Math.max(1, bounds.width - 28);
    const availableHeight = Math.max(1, bounds.height - 28);
    const ratio = screenshot.width / screenshot.height;
    let width = availableWidth;
    let height = width / ratio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }
    stageRef.current.style.width = Math.floor(width) + 'px';
    stageRef.current.style.height = Math.floor(height) + 'px';
  }, [screenshot]);

  useEffect(() => {
    if (!screenshot) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = screenshot.width;
      canvas.height = screenshot.height;
      redrawAnnotations(canvas, annotationsRef.current);
    }
    fitStage();
    const observer = new ResizeObserver(fitStage);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [screenshot, fitStage]);

  const getCanvasPosition = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const getDisplayScale = (): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? canvas.width / rect.width : 1;
  };

  const commitAnnotations = (next: Annotation[]) => {
    setUndoStack(previous => [...previous.slice(-39), annotations]);
    setRedoStack([]);
    setAnnotations(next);
  };

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(stack => [...stack, annotations]);
    setUndoStack(stack => stack.slice(0, -1));
    setAnnotations(previous);
  }, [annotations, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(stack => [...stack, annotations]);
    setRedoStack(stack => stack.slice(0, -1));
    setAnnotations(next);
  }, [annotations, redoStack]);

  const captureRegion = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.captureScreenRegion();
      if (result.success) {
        setScreenshot({
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
        });
        setAnnotations([]);
        setUndoStack([]);
        setRedoStack([]);
        setTool('pen');
      } else if (!result.canceled) {
        setMessage({ type: 'error', text: result.error || '区域截图失败' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '区域截图失败',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!screenshot || event.button !== 0) return;
    const point = getCanvasPosition(event);
    const scale = getDisplayScale();

    if (tool === 'eraser') {
      const threshold = 10 * scale;
      const index = [...annotations]
        .map((annotation, annotationIndex) => ({ annotation, annotationIndex }))
        .reverse()
        .find(item => hitAnnotation(item.annotation, point, threshold))
        ?.annotationIndex;
      if (index !== undefined) {
        commitAnnotations(annotations.filter((_, annotationIndex) => annotationIndex !== index));
      }
      return;
    }

    if (tool === 'text') {
      const rect = event.currentTarget.getBoundingClientRect();
      setTextDisplayPos({
        x: Math.max(4, Math.min(Math.max(4, rect.width - 232), event.clientX - rect.left)),
        y: Math.max(4, Math.min(Math.max(4, rect.height - 38), event.clientY - rect.top)),
      });
      setTextInputPos(point);
      setTextDraft('');
      setShowTextInput(true);
      return;
    }

    annotationIdRef.current += 1;
    currentAnnotationRef.current = {
      id: annotationIdRef.current,
      type: tool,
      points: [point],
      color,
      lineWidth: strokeWidth * scale,
    };
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotationRef.current || !canvasRef.current) return;
    const point = getCanvasPosition(event);
    const draft = currentAnnotationRef.current;
    if (draft.type === 'pen') draft.points.push(point);
    else draft.points[1] = point;
    redrawAnnotations(canvasRef.current, annotationsRef.current, draft);
  };

  const finishDrawing = () => {
    const draft = currentAnnotationRef.current;
    if (!isDrawing || !draft) return;
    setIsDrawing(false);
    currentAnnotationRef.current = null;
    if (draft.points.length > 1) commitAnnotations([...annotations, draft]);
    else if (canvasRef.current) redrawAnnotations(canvasRef.current, annotations);
  };

  const confirmText = () => {
    const text = textDraft.trim();
    setShowTextInput(false);
    if (!text) return;
    annotationIdRef.current += 1;
    const scale = getDisplayScale();
    commitAnnotations([
      ...annotations,
      {
        id: annotationIdRef.current,
        type: 'text',
        points: [textInputPos],
        color,
        lineWidth: 0,
        text,
        fontSize: 20 * scale,
      },
    ]);
    setTextDraft('');
  };

  const clearAnnotations = () => {
    if (annotations.length === 0) return;
    commitAnnotations([]);
  };

  const composeScreenshot = async (): Promise<string> => {
    if (!screenshot) throw new Error('没有可导出的截图');
    const output = document.createElement('canvas');
    output.width = screenshot.width;
    output.height = screenshot.height;
    const context = output.getContext('2d');
    if (!context) throw new Error('无法创建截图画布');
    const source = new Image();
    await new Promise<void>((resolve, reject) => {
      source.onload = () => resolve();
      source.onerror = () => reject(new Error('无法读取截图'));
      source.src = screenshot.dataUrl;
    });
    context.drawImage(source, 0, 0, output.width, output.height);
    annotations.forEach(annotation => drawAnnotation(context, annotation));
    return output.toDataURL('image/png');
  };

  const copyScreenshot = async () => {
    if (!screenshot || isExporting) return;
    setIsExporting(true);
    try {
      const result = await window.electronAPI.copyScreenshot(await composeScreenshot());
      setMessage(
        result.success
          ? { type: 'success', text: '截图已复制到剪贴板' }
          : { type: 'error', text: result.error || '复制失败' }
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '复制失败',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const saveScreenshot = async () => {
    if (!screenshot || isExporting) return;
    setIsExporting(true);
    try {
      const result = await window.electronAPI.saveScreenshot(await composeScreenshot());
      if (result.success) {
        setMessage({ type: 'success', text: '截图已保存' });
      } else if (!result.canceled) {
        setMessage({ type: 'error', text: result.error || '保存失败' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!screenshot) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea')) return;
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
      const shortcut = event.key.toUpperCase();
      const nextTool = (Object.keys(TOOL_META) as Tool[]).find(
        item => TOOL_META[item].shortcut === shortcut
      );
      if (nextTool) {
        event.preventDefault();
        setTool(nextTool);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, screenshot, undo]);

  return (
    <section className="screenshot-section screenshot-v2">
      <header className="screenshot-v2-header">
        <div className="screenshot-v2-title">
          <span>CAPTURE WORKSPACE</span>
          <h2>截图标注</h2>
          <p>选择桌面区域，添加重点标记后保存或复制。</p>
        </div>

        <div className="screenshot-v2-header-actions">
          {screenshot && (
            <span className="screenshot-v2-size">
              {screenshot.width} × {screenshot.height}
            </span>
          )}
          <button
            type="button"
            className="screenshot-v2-capture secondary"
            onClick={captureRegion}
            disabled={isCapturing}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 8V5a1 1 0 0 1 1-1h3" /><path d="M16 4h3a1 1 0 0 1 1 1v3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" /><path d="M8 20H5a1 1 0 0 1-1-1v-3" />
            </svg>
            {isCapturing ? '等待选择…' : screenshot ? '重新截图' : '选择区域截图'}
          </button>
          {screenshot && (
            <>
              <button
                type="button"
                className="screenshot-v2-export"
                onClick={copyScreenshot}
                disabled={isExporting}
              >
                <Icon name="clipboard" size={14} />
                复制
              </button>
              <button
                type="button"
                className="screenshot-v2-export primary"
                onClick={saveScreenshot}
                disabled={isExporting}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 3h12l2 2v16H5V3Z" /><path d="M8 3v6h8V3" /><path d="M8 21v-7h8v7" />
                </svg>
                保存
              </button>
            </>
          )}
        </div>
      </header>

      {!screenshot ? (
        <div className="screenshot-v2-empty">
          <div className="screenshot-v2-empty-icon" aria-hidden="true">
            <span />
          </div>
          <div>
            <h3>拖动选择要截取的桌面区域</h3>
            <p>点击后应用会暂时隐藏，并在鼠标所在显示器上显示截图框。</p>
          </div>
          <button type="button" onClick={captureRegion} disabled={isCapturing}>
            {isCapturing ? '等待选择区域…' : '开始区域截图'}
          </button>
          <div className="screenshot-v2-flow">
            <span><b>1</b> 框选区域</span>
            <i />
            <span><b>2</b> 添加标注</span>
            <i />
            <span><b>3</b> 复制或保存</span>
          </div>
        </div>
      ) : (
        <div className="screenshot-v2-workspace">
          <div className="screenshot-v2-toolbar">
            <div className="screenshot-v2-tool-group">
              <span className="screenshot-v2-toolbar-label">工具</span>
              {(Object.keys(TOOL_META) as Tool[]).map(item => (
                <button
                  type="button"
                  key={item}
                  className={tool === item ? 'active' : ''}
                  onClick={() => {
                    setTool(item);
                    setShowTextInput(false);
                  }}
                  title={TOOL_META[item].label + ' (' + TOOL_META[item].shortcut + ')'}
                  aria-label={TOOL_META[item].label}
                >
                  <ToolGlyph tool={item} />
                  <span>{TOOL_META[item].label}</span>
                </button>
              ))}
            </div>

            <div className="screenshot-v2-toolbar-divider" />

            <div className="screenshot-v2-style-group">
              <span className="screenshot-v2-toolbar-label">线宽</span>
              {STROKE_WIDTHS.map(width => (
                <button
                  type="button"
                  key={width}
                  className={strokeWidth === width ? 'active' : ''}
                  onClick={() => setStrokeWidth(width)}
                  aria-label={'线宽 ' + String(width)}
                >
                  <i style={{ width: width + 3, height: width + 3 }} />
                </button>
              ))}
            </div>

            <div className="screenshot-v2-style-group colors">
              <span className="screenshot-v2-toolbar-label">颜色</span>
              {COLORS.map(item => (
                <button
                  type="button"
                  key={item}
                  className={color === item ? 'active' : ''}
                  onClick={() => setColor(item)}
                  aria-label={'颜色 ' + item}
                >
                  <i style={{ background: item }} />
                </button>
              ))}
            </div>

            <div className="screenshot-v2-toolbar-spacer" />

            <div className="screenshot-v2-history-group">
              <button
                type="button"
                onClick={undo}
                disabled={undoStack.length === 0}
                title="撤销 (Ctrl+Z)"
                aria-label="撤销"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoStack.length === 0}
                title="重做 (Ctrl+Y)"
                aria-label="重做"
              >
                ↷
              </button>
              <button
                type="button"
                className="danger"
                onClick={clearAnnotations}
                disabled={annotations.length === 0}
                title="清除全部标注"
                aria-label="清除全部标注"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>

          <div className="screenshot-v2-canvas-viewport" ref={viewportRef}>
            <div
              className="screenshot-v2-editor-stage"
              ref={stageRef}
              style={{ aspectRatio: screenshot.width + ' / ' + screenshot.height }}
            >
              <img src={screenshot.dataUrl} alt="待标注截图" draggable={false} />
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrawing}
                onPointerCancel={finishDrawing}
                style={{
                  cursor:
                    tool === 'eraser'
                      ? 'cell'
                      : tool === 'text'
                        ? 'text'
                        : 'crosshair',
                }}
              />
              {showTextInput && (
                <div
                  className="screenshot-v2-text-editor"
                  style={{ left: textDisplayPos.x, top: textDisplayPos.y }}
                >
                  <input
                    autoFocus
                    value={textDraft}
                    onChange={event => setTextDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') confirmText();
                      if (event.key === 'Escape') setShowTextInput(false);
                    }}
                    placeholder="输入文字"
                  />
                  <button type="button" onClick={confirmText} aria-label="确认文字">
                    <Icon name="check" size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <footer className="screenshot-v2-footer">
            <span>
              <strong>{TOOL_META[tool].label}</strong>
              {TOOL_META[tool].hint}
            </span>
            <span>{annotations.length} 个标注</span>
            <span>快捷键 {TOOL_META[tool].shortcut} · 撤销 Ctrl+Z</span>
          </footer>
        </div>
      )}

      {message && (
        <div className={'screenshot-v2-message ' + message.type} role="status">
          {message.type === 'success'
            ? <Icon name="check" size={14} />
            : <Icon name="warning" size={14} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="关闭">
            ×
          </button>
        </div>
      )}
    </section>
  );
}

export default ScreenshotTab;
