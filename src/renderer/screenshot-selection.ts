import './screenshot-selection.css';
import type { ScreenshotSelectionInit, ScreenshotSelectionRect } from '../shared/types';

type Point = { x: number; y: number };
type DragState =
  | { kind: 'create'; start: Point }
  | { kind: 'move'; start: Point; initial: ScreenshotSelectionRect }
  | { kind: 'resize'; start: Point; initial: ScreenshotSelectionRect; handle: string };

const app = document.querySelector<HTMLElement>('#selection-app')!;
const image = document.querySelector<HTMLImageElement>('#screen-image')!;
const box = document.querySelector<HTMLElement>('#selection-box')!;
const hole = document.querySelector<SVGRectElement>('#selection-hole')!;
const sizeLabel = document.querySelector<HTMLElement>('#selection-size')!;
const help = document.querySelector<HTMLElement>('#selection-help')!;
const toolbar = document.querySelector<HTMLElement>('#selection-toolbar')!;
const resetButton = document.querySelector<HTMLButtonElement>('#selection-reset')!;
const cancelButton = document.querySelector<HTMLButtonElement>('#selection-cancel')!;
const confirmButton = document.querySelector<HTMLButtonElement>('#selection-confirm')!;

let selection: ScreenshotSelectionRect | null = null;
let dragState: DragState | null = null;
let isCompleting = false;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const pointFromEvent = (event: PointerEvent): Point => ({
  x: clamp(event.clientX, 0, window.innerWidth),
  y: clamp(event.clientY, 0, window.innerHeight),
});

const normalizedRect = (start: Point, end: Point): ScreenshotSelectionRect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

const positionToolbar = (rect: ScreenshotSelectionRect) => {
  if (toolbar.hidden) return;
  const toolbarWidth = toolbar.offsetWidth;
  const toolbarHeight = toolbar.offsetHeight;
  const left = clamp(
    rect.x + rect.width - toolbarWidth,
    8,
    window.innerWidth - toolbarWidth - 8
  );
  const below = rect.y + rect.height + 10;
  const top = below + toolbarHeight <= window.innerHeight - 8
    ? below
    : Math.max(8, rect.y - toolbarHeight - 10);
  toolbar.style.left = left + 'px';
  toolbar.style.top = top + 'px';
};

const renderSelection = () => {
  if (!selection || selection.width < 1 || selection.height < 1) {
    box.hidden = true;
    toolbar.hidden = true;
    help.hidden = false;
    hole.setAttribute('width', '0');
    hole.setAttribute('height', '0');
    return;
  }

  box.hidden = false;
  box.style.left = selection.x + 'px';
  box.style.top = selection.y + 'px';
  box.style.width = selection.width + 'px';
  box.style.height = selection.height + 'px';
  hole.setAttribute('x', String(selection.x));
  hole.setAttribute('y', String(selection.y));
  hole.setAttribute('width', String(selection.width));
  hole.setAttribute('height', String(selection.height));
  sizeLabel.textContent =
    Math.round(selection.width) + ' × ' + Math.round(selection.height);
  sizeLabel.style.top = selection.y < 32 ? '6px' : '-28px';
  help.hidden = true;

  if (!dragState) {
    toolbar.hidden = false;
    requestAnimationFrame(() => selection && positionToolbar(selection));
  } else {
    toolbar.hidden = true;
  }
};

const moveSelection = (point: Point, state: Extract<DragState, { kind: 'move' }>) => {
  const deltaX = point.x - state.start.x;
  const deltaY = point.y - state.start.y;
  return {
    ...state.initial,
    x: clamp(state.initial.x + deltaX, 0, window.innerWidth - state.initial.width),
    y: clamp(state.initial.y + deltaY, 0, window.innerHeight - state.initial.height),
  };
};

const resizeSelection = (
  point: Point,
  state: Extract<DragState, { kind: 'resize' }>
): ScreenshotSelectionRect => {
  let left = state.initial.x;
  let top = state.initial.y;
  let right = state.initial.x + state.initial.width;
  let bottom = state.initial.y + state.initial.height;
  if (state.handle.includes('w')) left = point.x;
  if (state.handle.includes('e')) right = point.x;
  if (state.handle.includes('n')) top = point.y;
  if (state.handle.includes('s')) bottom = point.y;
  return normalizedRect(
    { x: clamp(left, 0, window.innerWidth), y: clamp(top, 0, window.innerHeight) },
    { x: clamp(right, 0, window.innerWidth), y: clamp(bottom, 0, window.innerHeight) }
  );
};

const resetSelection = () => {
  selection = null;
  dragState = null;
  renderSelection();
};

const cancelSelection = async () => {
  if (isCompleting) return;
  isCompleting = true;
  await window.electronAPI.cancelScreenshotSelection();
};

const completeSelection = async () => {
  if (!selection || selection.width < 8 || selection.height < 8 || isCompleting) return;
  isCompleting = true;
  confirmButton.disabled = true;
  const result = await window.electronAPI.completeScreenshotSelection({
    x: Math.round(selection.x),
    y: Math.round(selection.y),
    width: Math.round(selection.width),
    height: Math.round(selection.height),
  });
  if (!result.success) {
    isCompleting = false;
    confirmButton.disabled = false;
  }
};

app.addEventListener('pointerdown', event => {
  if ((event.target as Element).closest('#selection-toolbar')) return;
  const point = pointFromEvent(event);
  const handle = (event.target as HTMLElement).dataset.handle;
  if (handle && selection) {
    dragState = { kind: 'resize', start: point, initial: { ...selection }, handle };
  } else if ((event.target as Element).closest('#selection-box') && selection) {
    dragState = { kind: 'move', start: point, initial: { ...selection } };
  } else {
    selection = { x: point.x, y: point.y, width: 0, height: 0 };
    dragState = { kind: 'create', start: point };
  }
  toolbar.hidden = true;
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  renderSelection();
});

window.addEventListener('pointermove', event => {
  if (!dragState) return;
  const point = pointFromEvent(event);
  if (dragState.kind === 'create') {
    selection = normalizedRect(dragState.start, point);
  } else if (dragState.kind === 'move') {
    selection = moveSelection(point, dragState);
  } else {
    selection = resizeSelection(point, dragState);
  }
  renderSelection();
});

window.addEventListener('pointerup', () => {
  if (!dragState) return;
  dragState = null;
  if (selection && (selection.width < 8 || selection.height < 8)) selection = null;
  renderSelection();
});

box.addEventListener('dblclick', event => {
  event.preventDefault();
  void completeSelection();
});

resetButton.addEventListener('click', resetSelection);
cancelButton.addEventListener('click', () => void cancelSelection());
confirmButton.addEventListener('click', () => void completeSelection());

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    void cancelSelection();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    void completeSelection();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetSelection();
  }
});

window.electronAPI.onScreenshotSelectionInit((payload: ScreenshotSelectionInit) => {
  image.onload = () => {
    app.classList.remove('is-loading');
    resetSelection();
  };
  image.src = payload.dataUrl;
});
