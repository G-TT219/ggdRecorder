import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  APP_TOAST_EVENT,
  CommandPalette,
  StudioTopBar,
  TopErrorToast,
  TopStatusToast,
  emitAppError,
  emitAppToast,
} from './WorkspaceShell';

describe('studio top bar and shell navigation', () => {
  const baseTopBarProps = {
    activeWorkspace: 'recordings' as const,
    recordingsCount: 4,
    isRecording: false,
    isPaused: false,
    recordingTimeLabel: '00:00:00',
    theme: 'noir' as const,
    miniMode: false,
    isMaximized: false,
    onNavigate: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleMiniMode: vi.fn(),
    onOpenCommand: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onClose: vi.fn(),
  };

  it('keeps the active workspace pill highlighted and routes navigation', () => {
    const onNavigate = vi.fn();
    render(<StudioTopBar {...baseTopBarProps} onNavigate={onNavigate} />);

    expect(screen.getByRole('button', { name: /录像影院/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /战绩档案/ }));
    expect(onNavigate).toHaveBeenCalledWith('stats');
  });

  it('toggles theme, mini mode, command palette, and shows live recording capsule', () => {
    const onToggleTheme = vi.fn();
    const onToggleMiniMode = vi.fn();
    const onOpenCommand = vi.fn();
    render(
      <StudioTopBar
        {...baseTopBarProps}
        activeWorkspace="games"
        isRecording={true}
        recordingTimeLabel="00:03:18"
        onToggleTheme={onToggleTheme}
        onToggleMiniMode={onToggleMiniMode}
        onOpenCommand={onOpenCommand}
      />
    );

    expect(screen.getByText('REC')).toBeInTheDocument();
    expect(screen.getByText('00:03:18')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /奶油桌游浅色主题/ }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /迷你侧边录制窗/ }));
    expect(onToggleMiniMode).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /打开命令面板/ }));
    expect(onOpenCommand).toHaveBeenCalledTimes(1);
  });

  it('cycles persona sticker on click and emits a status toast', () => {
    window.localStorage.clear();
    const toastListener = vi.fn();
    window.addEventListener(APP_TOAST_EVENT, toastListener);

    render(<StudioTopBar {...baseTopBarProps} activeWorkspace="games" />);
    fireEvent.click(screen.getByRole('button', { name: /当前身份：侦探鹅/ }));

    expect(screen.getByRole('button', { name: /当前身份：警长鹅/ })).toBeInTheDocument();
    expect(toastListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(APP_TOAST_EVENT, toastListener);
  });

  it('filters commands and supports Enter execution in the command palette', () => {
    const runFirst = vi.fn();
    const runSecond = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        actions={[
          { id: 'record', label: '打开录制台', detail: '双栏导播台', run: runFirst },
          { id: 'theme', label: '切换奶油桌游浅色主题', detail: '双主题切换', run: runSecond },
        ]}
      />
    );

    const searchInput = screen.getByRole('textbox', { name: /搜索动作或工作区/ });
    fireEvent.change(searchInput, { target: { value: '奶油' } });
    expect(screen.queryByRole('option', { name: /打开录制台/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /切换奶油桌游浅色主题/ })).toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(runSecond).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders dismissible error and status toasts via shared channels', () => {
    const errListener = vi.fn();
    window.addEventListener('ggd-app-error', errListener);
    emitAppError('测试错误');
    expect(errListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('ggd-app-error', errListener);

    const onCloseErr = vi.fn();
    render(<TopErrorToast message="无法连接 Gaggle" onClose={onCloseErr} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法连接 Gaggle');
    fireEvent.click(screen.getByRole('button', { name: '关闭错误提示' }));
    expect(onCloseErr).toHaveBeenCalledTimes(1);

    const toastListener = vi.fn();
    window.addEventListener(APP_TOAST_EVENT, toastListener);
    emitAppToast('复盘笔记已保存', 'success');
    expect(toastListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(APP_TOAST_EVENT, toastListener);

    const onCloseToast = vi.fn();
    render(
      <TopStatusToast
        toast={{ id: 1, message: '复盘笔记已保存', tone: 'success' }}
        onClose={onCloseToast}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('复盘笔记已保存');
    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));
    expect(onCloseToast).toHaveBeenCalledTimes(1);
  });
});
