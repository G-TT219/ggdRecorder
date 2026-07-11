import { useState, useRef, useCallback, useEffect } from 'react';

type Tool = 'pen' | 'rect' | 'circle' | 'text' | 'eraser';
type Point = { x: number; y: number };
type Annotation = {
  type: 'pen' | 'rect' | 'circle' | 'text';
  points: Point[]; color: string; lineWidth: number;
  text?: string; fontSize?: number;
};

const COLORS = ['#ff4d63', '#00d4ff', '#ffd700', '#4ade80', '#ff9800', '#ffffff'];

function drawOne(ctx, a) {
  if (!a || !a.points) return;
  ctx.strokeStyle = a.color; ctx.fillStyle = a.color;
  ctx.lineWidth = a.lineWidth || 0; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (a.type === 'pen' && a.points.length > 1) {
    ctx.beginPath(); ctx.moveTo(a.points[0].x, a.points[0].y);
    for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
    ctx.stroke();
  } else if (a.type === 'rect' && a.points.length === 2) {
    ctx.strokeRect(Math.min(a.points[0].x, a.points[1].x), Math.min(a.points[0].y, a.points[1].y),
      Math.abs(a.points[1].x - a.points[0].x), Math.abs(a.points[1].y - a.points[0].y));
  } else if (a.type === 'circle' && a.points.length === 2) {
    ctx.beginPath(); ctx.ellipse((a.points[0].x + a.points[1].x) / 2, (a.points[0].y + a.points[1].y) / 2,
      Math.abs(a.points[1].x - a.points[0].x) / 2, Math.abs(a.points[1].y - a.points[0].y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (a.type === 'text' && a.text) {
    ctx.font = 'bold ' + (a.fontSize || 20) + 'px sans-serif';
    ctx.fillText(a.text, a.points[0].x, a.points[0].y + (a.fontSize || 20));
  }
}

function redrawAll(canvas, annotations) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const a of annotations) drawOne(ctx, a);
}

function ScreenshotTab() {
  const [screenshot, setScreenshot] = useState(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [textDisplayPos, setTextDisplayPos] = useState({ x: 0, y: 0 });
  const [textDraft, setTextDraft] = useState('');

  const canvasRef = useRef(null);
  const currentAnnotationRef = useRef(null);
  const annotationsRef = useRef([]);

  // Keep annotationsRef in sync
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const captureScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 1 } }, audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const img = new Image();
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const settings = track.getSettings();
      c.width = settings.width || 1920; c.height = settings.height || 1080;
      const video = document.createElement('video');
      video.srcObject = stream; video.play();
      await new Promise(r => { video.onloadedmetadata = r; });
      await new Promise(r => setTimeout(r, 300));
      ctx.drawImage(video, 0, 0, c.width, c.height);
      track.stop(); stream.getTracks().forEach(t => t.stop());

      img.onload = () => {
        setScreenshot(c.toDataURL());
        setAnnotations([]); setRedoStack([]);
        if (canvasRef.current) { canvasRef.current.width = img.naturalWidth; canvasRef.current.height = img.naturalHeight; }
      };
      img.src = c.toDataURL();
    } catch (e) { /* cancelled */ }
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e);
    if (tool === 'eraser') {
      // Remove last annotation
      if (annotations.length > 0) {
        const last = annotations[annotations.length - 1];
        setAnnotations(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, last]);
      }
      return;
    }
    setIsDrawing(true);
    if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      setTextDisplayPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTextInputPos(pos); setShowTextInput(true); setIsDrawing(false);
      return;
    }
    currentAnnotationRef.current = { type: tool, points: [pos], color, lineWidth: tool === 'pen' ? 3 : 3 };
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !currentAnnotationRef.current) return;
    const pos = getCanvasPos(e);
    const cur = currentAnnotationRef.current;
    if (cur.type === 'pen') cur.points.push(pos);
    else cur.points[1] = pos;
    // Draw directly to canvas without touching React state
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Redraw committed annotations then the current one
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const a of annotationsRef.current) drawOne(ctx, a);
    drawOne(ctx, cur);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotationRef.current) return;
    setIsDrawing(false);
    const cur = currentAnnotationRef.current;
    const finalA = { type: cur.type, points: [...cur.points], color: cur.color, lineWidth: cur.lineWidth };
    setAnnotations(prev => [...prev, finalA]);
    setRedoStack([]);
    currentAnnotationRef.current = null;
  };

  const confirmText = () => {
    if (!textDraft.trim()) { setShowTextInput(false); return; }
    setAnnotations(prev => [...prev, { type: 'text', points: [textInputPos], color, lineWidth: 0, text: textDraft, fontSize: 20 }]);
    setRedoStack([]); setShowTextInput(false); setTextDraft('');
  };

  const undo = () => {
    if (annotations.length === 0) return;
    setRedoStack(prev => [...prev, annotations[annotations.length - 1]]);
    setAnnotations(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    setAnnotations(prev => [...prev, redoStack[redoStack.length - 1]]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const clear = () => { setAnnotations([]); setRedoStack([]); setScreenshot(null); };

  // Redraw when committed annotations change (after mouseup/undo/redo)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) redrawAll(canvas, annotations);
  }, [annotations]);

  return (
    <section className="screenshot-section">
      <div className="screenshot-header">
        <h2>截图标注</h2>
        <button className="screenshot-capture-btn" onClick={captureScreen}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
          截屏
        </button>
      </div>
      {!screenshot ? (
        <div className="screenshot-empty"><p>点击上方截屏按钮截取游戏画面</p></div>
      ) : (
        <div className="screenshot-workspace">
          <div className="screenshot-toolbar">
            {(['pen','rect','circle','text','eraser']).map(t => (
              <button key={t} className={"screenshot-tool-btn"+(tool===t?' active':'')} onClick={()=>setTool(t)} title={{pen:'画笔',rect:'矩形',circle:'圆形',text:'文字',eraser:'橡皮擦'}[t]}>
                {t==='pen'&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>}
                {t==='rect'&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                {t==='circle'&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>}
                {t==='text'&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
                {t==='eraser'&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M21 3l-18 18"/></svg>}
              </button>
            ))}
            <div className="screenshot-toolbar-sep"/>
            {COLORS.map(c => (
              <button key={c} className={"screenshot-color-btn"+(color===c?' active':'')} style={{background:c}} onClick={()=>setColor(c)}/>
            ))}
            <div className="screenshot-toolbar-sep"/>
            <button className="screenshot-action-btn" onClick={undo} disabled={annotations.length===0} title="撤销"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
            <button className="screenshot-action-btn" onClick={redo} disabled={redoStack.length===0} title="重做"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg></button>
            <button className="screenshot-action-btn danger" onClick={clear} title="清除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
          <div className="screenshot-canvas-container">
            <img src={screenshot} alt="" style={{width:'100%',display:'block'}}
              onLoad={(e)=>{const i=e.currentTarget;const c=canvasRef.current;if(c){c.style.width=i.width+'px';c.style.height=i.height+'px';c.width=i.naturalWidth;c.height=i.naturalHeight;redrawAll(c,[]);}}}/>
            <canvas ref={canvasRef}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              style={{position:'absolute',top:0,left:0,cursor:tool==='eraser'?'pointer':tool==='text'?'text':'crosshair'}}/>
            {showTextInput && (
              <div style={{position:'absolute',left:textDisplayPos.x,top:textDisplayPos.y-10,display:'flex',gap:4,zIndex:10}}>
                <input autoFocus value={textDraft} onChange={e=>setTextDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')confirmText();if(e.key==='Escape')setShowTextInput(false);}}
                  placeholder="输入文字..." className="screenshot-text-field"/>
                <button className="screenshot-text-confirm" onClick={confirmText}>&#10003;</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
export default ScreenshotTab;
