import {
  BrowserWindow,
  session,
  shell,
  type Session,
} from 'electron';
import type { GaggleAuthStatus } from '../../shared/types';
import logger from '../logger';
import {
  isGaggleTokenExpired,
  parseGaggleToken,
  type ParsedGaggleToken,
} from './gaggle-token';

const AUTH_PARTITION = 'persist:gaggle-auth';
const DASHBOARD_URL = 'https://gaggle.fun/dashboard';
const AUTH_STATUS_CHANNEL = 'gaggle-auth-status-changed';
const CAPTURE_URLS = [
  'https://gaggle.fun/*',
  'https://*.gaggle.fun/*',
  'https://us-central1-gaggle-staging.cloudfunctions.net/*',
];

type Credentials = ParsedGaggleToken & {
  source: 'session' | 'manual';
};

type CaptureWaiter = {
  resolve: (captured: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const getAuthorizationHeader = (
  headers: Record<string, string | string[] | undefined>
): string | undefined => {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'authorization');
  if (!entry) return undefined;
  return Array.isArray(entry[1]) ? entry[1][0] : entry[1];
};

const isAllowedLoginUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'gaggle.fun' ||
      hostname.endsWith('.gaggle.fun') ||
      hostname === 'accounts.google.com' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.googleapis.com');
  } catch {
    return false;
  }
};

class GaggleAuthService {
  private authSession: Session | null = null;
  private authWindow: BrowserWindow | null = null;
  private credentials: Credentials | null = null;
  private state: GaggleAuthStatus['state'] = 'disconnected';
  private captureWaiters = new Set<CaptureWaiter>();
  private listenerAttached = false;
  private proxyReady: Promise<void> | null = null;
  private restoreStarted = false;

  initialize(): void {
    if (this.authSession) return;

    this.authSession = session.fromPartition(AUTH_PARTITION);
    this.configureProxy();
    this.attachAuthorizationListener();
  }

  private configureProxy(): void {
    if (!this.authSession || this.proxyReady) return;
    const proxyUrl = process.env.https_proxy || process.env.http_proxy || process.env.all_proxy;
    if (!proxyUrl) {
      this.proxyReady = Promise.resolve();
      return;
    }

    this.proxyReady = this.authSession
      .setProxy({ proxyRules: proxyUrl })
      .then(() => {
        logger.info('Configured proxy for the Gaggle login session');
      })
      .catch(error => {
        logger.warn('Failed to configure proxy for the Gaggle login session:', error);
      });
  }

  private attachAuthorizationListener(): void {
    if (!this.authSession || this.listenerAttached) return;
    this.listenerAttached = true;

    this.authSession.webRequest.onBeforeSendHeaders(
      { urls: CAPTURE_URLS },
      (details, callback) => {
        const authorization = getAuthorizationHeader(details.requestHeaders);
        if (authorization?.toLowerCase().startsWith('bearer ')) {
          this.captureAuthorization(authorization);
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );
  }

  private captureAuthorization(authorization: string): void {
    try {
      const parsed = parseGaggleToken(authorization);
      if (isGaggleTokenExpired(parsed, 0)) {
        this.state = 'expired';
        this.emitStatus();
        return;
      }

      this.credentials = { ...parsed, source: 'session' };
      this.state = 'connected';
      logger.info(`Gaggle account connected for user ${parsed.userId}`);
      this.resolveCaptureWaiters(true);
      this.emitStatus();

      const window = this.authWindow;
      if (window && !window.isDestroyed()) {
        setTimeout(() => {
          if (!window.isDestroyed()) window.close();
        }, 350);
      }
    } catch (error) {
      logger.warn('Ignored an unsupported Bearer token from the Gaggle session:', error);
    }
  }

  private emitStatus(): void {
    const status = this.getStatus();
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(AUTH_STATUS_CHANNEL, status);
      }
    }
  }

  private resolveCaptureWaiters(captured: boolean): void {
    for (const waiter of this.captureWaiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve(captured);
    }
    this.captureWaiters.clear();
  }

  private waitForCapture(timeoutMilliseconds: number): Promise<boolean> {
    if (this.getStatus().state === 'connected') return Promise.resolve(true);

    return new Promise(resolve => {
      const waiter: CaptureWaiter = {
        resolve,
        timeout: setTimeout(() => {
          this.captureWaiters.delete(waiter);
          resolve(false);
        }, timeoutMilliseconds),
      };
      this.captureWaiters.add(waiter);
    });
  }

  private async openAuthWindow(interactive: boolean): Promise<void> {
    this.initialize();
    await this.proxyReady;

    if (this.authWindow && !this.authWindow.isDestroyed()) {
      if (interactive) {
        this.authWindow.show();
        this.authWindow.focus();
      }
      return;
    }

    this.state = 'connecting';
    this.emitStatus();

    const authWindow = new BrowserWindow({
      width: 1040,
      height: 760,
      minWidth: 760,
      minHeight: 620,
      show: false,
      title: '连接 Gaggle',
      backgroundColor: '#ffffff',
      autoHideMenuBar: true,
      webPreferences: {
        partition: AUTH_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    this.authWindow = authWindow;
    authWindow.setMenu(null);

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedLoginUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              partition: AUTH_PARTITION,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          },
        };
      }
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    authWindow.once('ready-to-show', () => {
      if (interactive && !authWindow.isDestroyed()) {
        authWindow.show();
        authWindow.focus();
      }
    });

    authWindow.once('closed', () => {
      if (this.authWindow === authWindow) this.authWindow = null;
      if (this.state === 'connecting') {
        this.state = this.credentials ? 'expired' : 'disconnected';
        this.resolveCaptureWaiters(false);
        this.emitStatus();
      }
    });

    try {
      await this.loadDashboardWithFallback(authWindow);
    } catch (error) {
      if (!authWindow.isDestroyed()) authWindow.close();
      logger.warn('Failed to load the Gaggle dashboard:', error);
      if (interactive) throw error;
    }
  }

  /**
   * The dashboard is also used for interactive login. Some local HTTP/SOCKS
   * proxies accept the CONNECT tunnel but close the TLS connection afterwards,
   * which Electron reports as ERR_CONNECTION_CLOSED. Retry once without a
   * proxy so a healthy direct connection can still open the login window.
   */
  private async loadDashboardWithFallback(authWindow: BrowserWindow): Promise<void> {
    try {
      await authWindow.loadURL(DASHBOARD_URL);
      return;
    } catch (proxyError) {
      const proxyUrl = process.env.https_proxy || process.env.http_proxy || process.env.all_proxy;
      if (!proxyUrl || !this.authSession) throw proxyError;

      logger.warn('Gaggle dashboard load failed through the configured proxy; retrying direct:', proxyError);
      await this.authSession.setProxy({ mode: 'direct' });
      try {
        await authWindow.loadURL(DASHBOARD_URL);
        logger.info('Loaded the Gaggle dashboard through a direct connection');
      } catch (directError) {
        logger.warn('Direct Gaggle dashboard retry failed:', directError);
        throw directError;
      }
    }
  }

  getStatus(): GaggleAuthStatus {
    if (this.credentials && isGaggleTokenExpired(this.credentials)) {
      this.state = 'expired';
    }

    return {
      state: this.state,
      userId: this.credentials?.userId,
      expiresAt: this.credentials?.expiresAt,
      source: this.credentials?.source,
    };
  }

  getCredentials(): { token: string; userId: string } | null {
    if (!this.credentials || this.getStatus().state !== 'connected') return null;
    return { token: this.credentials.token, userId: this.credentials.userId };
  }

  async connect(): Promise<GaggleAuthStatus> {
    await this.openAuthWindow(true);
    return this.getStatus();
  }

  async refresh(interactive = false): Promise<GaggleAuthStatus> {
    const previousState = this.credentials ? 'expired' : 'disconnected';
    await this.openAuthWindow(interactive);
    if (interactive) return this.getStatus();

    const captured = await this.waitForCapture(15_000);
    if (!captured) {
      const window = this.authWindow;
      if (window && !window.isDestroyed() && !window.isVisible()) window.close();
      if (this.state !== 'connected') {
        this.state = previousState;
        this.emitStatus();
      }
    }
    return this.getStatus();
  }

  async restoreSession(): Promise<void> {
    if (this.restoreStarted) return;
    this.restoreStarted = true;
    await this.refresh(false);
  }

  async disconnect(): Promise<GaggleAuthStatus> {
    this.credentials = null;
    this.state = 'disconnected';
    this.resolveCaptureWaiters(false);

    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
    }
    this.initialize();
    await this.authSession?.clearStorageData();
    await this.authSession?.clearCache();
    this.emitStatus();
    return this.getStatus();
  }

  setManualToken(value: string): GaggleAuthStatus {
    const parsed = parseGaggleToken(value);
    if (isGaggleTokenExpired(parsed, 0)) {
      throw new Error('Token 已过期');
    }

    this.credentials = { ...parsed, source: 'manual' };
    this.state = 'connected';
    this.resolveCaptureWaiters(true);
    if (this.authWindow && !this.authWindow.isDestroyed()) this.authWindow.close();
    this.emitStatus();
    return this.getStatus();
  }

  requireReconnect(): void {
    this.state = 'expired';
    this.emitStatus();
    void this.connect();
  }
}

export const gaggleAuth = new GaggleAuthService();
