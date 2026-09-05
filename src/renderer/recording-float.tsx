import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { RecordingFloatState } from '../shared/types';
import './recording-float.css';

const initialState: RecordingFloatState = {
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  gameName: '',
};

const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
};

function RecordingFloat() {
  const [state, setState] = useState<RecordingFloatState>(initialState);

  useEffect(() => window.electronAPI.onRecordingFloatState(nextState => {
    setState({ ...initialState, ...nextState });
  }), []);

  const action = (value: 'toggle-pause' | 'stop' | 'show-main') => {
    window.electronAPI.sendRecordingFloatAction(value);
  };

  return (
    <main className={`recording-float ${state.isPaused ? 'is-paused' : ''}`}>
      <div className="recording-float-drag" aria-hidden="true" />
      <div className="recording-float-status">
        <span className="recording-float-dot" aria-hidden="true" />
        <div className="recording-float-copy">
          <strong>{state.isPaused ? '录制已暂停' : '正在录制'}</strong>
          <span title={state.gameName || '当前游戏'}>{state.gameName || '当前游戏'}</span>
        </div>
        <time dateTime={`PT${state.recordingTime}S`}>{formatTime(state.recordingTime)}</time>
      </div>
      <div className="recording-float-actions">
        <button type="button" className="float-button float-button-quiet" onClick={() => action('toggle-pause')}>
          <span className="float-button-icon" aria-hidden="true">{state.isPaused ? '▶' : 'Ⅱ'}</span>
          <span>{state.isPaused ? '继续' : '暂停'}</span>
        </button>
        <button type="button" className="float-button float-button-stop" onClick={() => action('stop')}>
          <span className="float-button-icon" aria-hidden="true">■</span>
          <span>结束</span>
        </button>
        <button type="button" className="float-button float-button-main" onClick={() => action('show-main')} title="返回主界面">
          <span className="float-button-icon" aria-hidden="true">↗</span>
          <span>主界面</span>
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><RecordingFloat /></StrictMode>,
);
