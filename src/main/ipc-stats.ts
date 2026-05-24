import { ipcMain } from 'electron';
import logger from './logger';
import { getGlobalConfig } from './config';

export const registerStatsHandlers = (): void => {
  ipcMain.handle('fetch-match-data', async (_event, matchId: string) => {
    try {
      return await new Promise((resolve) => {
        const https = require('https');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const url = `https://ggdmatchdata.gaggle.fun/match-timelines/${matchId}.json`;
        const proxyUrl = process.env.https_proxy || process.env.http_proxy || process.env.all_proxy;
        let agent;
        if (proxyUrl) {
          if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks://')) {
            try {
              const { SocksProxyAgent } = require('socks-proxy-agent');
              agent = new SocksProxyAgent(proxyUrl);
            } catch {
              resolve({ success: false, error: 'SOCKS proxy not available' });
              return;
            }
          } else {
            agent = new HttpsProxyAgent(proxyUrl);
          }
        }
        const request = https.get(url, {
          agent,
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://gaggle.fun/',
            'Origin': 'https://gaggle.fun',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, (response: any) => {
          let data = '';
          response.on('data', (chunk: string) => { data += chunk; });
          response.on('end', () => {
            if (response.statusCode === 200) {
              resolve({ success: true, data: JSON.parse(data) });
            } else {
              resolve({ success: false, error: `HTTP Error: ${response.statusCode}`, statusCode: response.statusCode });
            }
          });
        });
        request.on('error', (error: Error) => resolve({ success: false, error: error.message }));
        request.setTimeout(10000, () => { request.destroy(); resolve({ success: false, error: 'Request timeout' }); });
      });
    } catch { return { success: false, error: 'unexpected error' }; }
  });

  ipcMain.handle('fetch-match-history', async (_event, userId: string) => {
    try {
      const https = require('https');
      const { HttpsProxyAgent } = require('https-proxy-agent');
      const url = 'https://us-central1-gaggle-staging.cloudfunctions.net/ggdPlayerMatch?action=FetchList';
      const postData = JSON.stringify({ uid: userId });
      const proxyUrl = process.env.http_proxy || process.env.https_proxy || process.env.all_proxy;
      const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
      const ggdToken = getGlobalConfig().ggdToken || '';

      const options = {
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ggdToken}`,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://gaggle.fun/',
          'Origin': 'https://gaggle.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      return await new Promise((resolve) => {
        const request = https.request(url, options, (response: any) => {
          let data = '';
          response.on('data', (chunk: string) => { data += chunk; });
          response.on('end', () => {
            if (response.statusCode === 200) {
              resolve({ success: true, data: JSON.parse(data) });
            } else {
              resolve({ success: false, error: `HTTP Error: ${response.statusCode}`, statusCode: response.statusCode });
            }
          });
        });
        request.on('error', (error: Error) => resolve({ success: false, error: error.message }));
        request.setTimeout(10000, () => { request.destroy(); resolve({ success: false, error: 'Request timeout' }); });
        request.write(postData);
        request.end();
      });
    } catch { return { success: false, error: 'unexpected error' }; }
  });
};
