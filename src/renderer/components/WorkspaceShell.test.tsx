import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, ContextBar, TopErrorToast, WorkspaceRail, emitAppError } from './WorkspaceShell';

describe('workspace shell navigation', () => {
  it('keeps the active workspace visible in the rail and routes recordings', () => {
    const onNavigate = vi.fn();
    render(
      <WorkspaceRail
        activeWorkspace="recordings"
        recordingsCount={4}
        isRecording={false}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByRole('button', { name: /录像库/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /战绩分析/ }));
    expect(onNavigate).toHaveBeenCalledWith('stats');
  });

  it('opens the command palette from the context bar', () => {
    const onOpenCommand = vi.fn();
    render(
      <ContextBar
        activeWorkspace="games"
        isRecording={true}
        onNavigate={vi.fn()}
        onOpenCommand={onOpenCommand}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /命令面板/ }));
    expect(onOpenCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('runs a command and closes the palette', () => {
    const run = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        actions={[{ id: 'test', label: '测试动作', detail: '验证命令执行', run }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /测试动作/ }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a dismissible top-level error toast', () => {
    const onClose = vi.fn();
    render(<TopErrorToast message="无法连接 Gaggle" onClose={onClose} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无法连接 Gaggle');
    fireEvent.click(screen.getByRole('button', { name: '关闭错误提示' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('emits app errors through the shared event channel', () => {
    const listener = vi.fn();
    window.addEventListener('ggd-app-error', listener);
    emitAppError('测试错误');
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail.message).toBe('测试错误');
    window.removeEventListener('ggd-app-error', listener);
  });
});
