import { ipcMain } from 'electron';
import type { IpcResult } from '../shared/types';
import { gaggleAuth } from './services/gaggle-auth';
import { createMatchHistoryRequestBody } from './services/gaggle-match-request';

type DataResult = IpcResult<{ data: unknown; statusCode?: number }>;

const createProxyAgent = (preferHttps = false): unknown => {
  const proxyUrl = preferHttps
    ? process.env.https_proxy || process.env.http_proxy || process.env.all_proxy
    : process.env.http_proxy || process.env.https_proxy || process.env.all_proxy;
  if (!proxyUrl) return undefined;

  const { HttpsProxyAgent } = require('https-proxy-agent');
  return new HttpsProxyAgent(proxyUrl);
};

const parseJsonResponse = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    throw new Error('服务返回了无法解析的数据');
  }
};

const fetchMatchData = async (matchId: string): Promise<DataResult> => {
  try {
    const https = require('https');
    const url = `https://ggdmatchdata.gaggle.fun/match-timelines/${encodeURIComponent(matchId)}.json`;
    const agent = createProxyAgent(true);

    return await new Promise(resolve => {
      const request = https.get(url, {
        agent,
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://gaggle.fun/',
          Origin: 'https://gaggle.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }, (response: any) => {
        let data = '';
        response.on('data', (chunk: string) => { data += chunk; });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve({
              success: false,
              error: `HTTP Error: ${response.statusCode}`,
              statusCode: response.statusCode,
            });
            return;
          }
          try {
            resolve({ success: true, data: parseJsonResponse(data) });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : '响应解析失败',
            });
          }
        });
      });
      request.on('error', (error: Error) => resolve({ success: false, error: error.message }));
      request.setTimeout(10_000, () => {
        request.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'unexpected error',
    };
  }
};

const requestMatchHistory = async (token: string, userId: string): Promise<DataResult> => {
  try {
    const https = require('https');
    const url = 'https://us-central1-gaggle-staging.cloudfunctions.net/ggdPlayerMatch?action=FetchList';
    const agent = createProxyAgent();
    const postData = createMatchHistoryRequestBody(userId);

    return await new Promise(resolve => {
      const request = https.request(url, {
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://gaggle.fun/',
          Origin: 'https://gaggle.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }, (response: any) => {
        let data = '';
        response.on('data', (chunk: string) => { data += chunk; });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve({
              success: false,
              error: response.statusCode === 401
                ? 'Gaggle 登录已失效'
                : response.statusCode === 500
                  ? 'Gaggle 战绩服务暂时无法处理请求（HTTP 500）'
                : `HTTP Error: ${response.statusCode}`,
              statusCode: response.statusCode,
            });
            return;
          }
          try {
            resolve({ success: true, data: parseJsonResponse(data) });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : '响应解析失败',
            });
          }
        });
      });
      request.on('error', (error: Error) => resolve({ success: false, error: error.message }));
      request.setTimeout(10_000, () => {
        request.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });
      request.write(postData);
      request.end();
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'unexpected error',
    };
  }
};

const fetchHistoryWithRefresh = async (): Promise<DataResult> => {
  let credentials = gaggleAuth.getCredentials();
  if (!credentials) {
    await gaggleAuth.connect();
    return {
      success: false,
      code: 'GAGGLE_AUTH_REQUIRED',
      error: '请在已打开的窗口中登录 Gaggle，连接完成后再查询',
    };
  }

  let result = await requestMatchHistory(credentials.token, credentials.userId);
  if (!result.success && result.statusCode === 401) {
    await gaggleAuth.refresh(false);
    credentials = gaggleAuth.getCredentials();
    if (credentials) {
      result = await requestMatchHistory(credentials.token, credentials.userId);
    }
    if (!result.success && result.statusCode === 401) {
      gaggleAuth.requireReconnect();
      return {
        success: false,
        code: 'GAGGLE_AUTH_EXPIRED',
        statusCode: 401,
        error: '登录已失效，已打开 Gaggle 登录窗口，请重新连接后再试',
      };
    }
  }

  return result;
};

export const registerStatsHandlers = (): void => {
  gaggleAuth.initialize();
  void gaggleAuth.restoreSession();

  ipcMain.handle('get-gaggle-auth-status', () => ({
    success: true,
    status: gaggleAuth.getStatus(),
  }));

  ipcMain.handle('connect-gaggle', async () => {
    try {
      return { success: true, status: await gaggleAuth.connect() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '无法打开 Gaggle 登录窗口',
      };
    }
  });

  ipcMain.handle('refresh-gaggle-auth', async () => {
    try {
      return { success: true, status: await gaggleAuth.refresh(false) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '刷新登录状态失败',
      };
    }
  });

  ipcMain.handle('disconnect-gaggle', async () => {
    try {
      return { success: true, status: await gaggleAuth.disconnect() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '断开 Gaggle 连接失败',
      };
    }
  });

  ipcMain.handle('set-manual-gaggle-auth', (_event, token: string) => {
    try {
      return { success: true, status: gaggleAuth.setManualToken(token) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token 无效',
      };
    }
  });

  ipcMain.handle('fetch-match-data', (_event, matchId: string) =>
    fetchMatchData(matchId));

  ipcMain.handle('fetch-my-match-history', () => fetchHistoryWithRefresh());
};
