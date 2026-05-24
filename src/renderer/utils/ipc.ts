import type { IpcResult, IpcSuccess, IpcFailure } from '../types/electron-api';

export function isSuccess<T>(result: IpcResult<T>): result is IpcSuccess<T> {
  return result.success === true;
}

export function isFailure<T>(result: IpcResult<T>): result is IpcFailure {
  return !result.success;
}
