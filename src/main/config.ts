import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { app } from 'electron';
import logger from './logger';
import type { AppConfig, FavoritesMetadata, FavoriteGroup } from '../shared/types';

let globalConfig: AppConfig = {};

export const getGlobalConfig = (): AppConfig => globalConfig;
export const setGlobalConfig = (config: AppConfig): void => { globalConfig = config; };

const getAppConfigPath = (): string =>
  path.join(app.getPath('userData'), 'config.json');

const getFavoritesConfigPath = (): string =>
  path.join(app.getPath('userData'), 'favorites.json');

import path from 'path';

// App config
export const getAppConfig = async (): Promise<AppConfig> => {
  try {
    const configPath = getAppConfigPath();
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
};

export const saveAppConfig = async (config: AppConfig): Promise<boolean> => {
  try {
    const configPath = getAppConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    globalConfig = config;
    return true;
  } catch (error) {
    logger.error('Error saving app config:', error);
    return false;
  }
};

// Favorites config
const normalizeFavoritesConfig = (config: Record<string, unknown> = {}) => ({
  version: 2 as const,
  favorites: Array.isArray(config.favorites) ? config.favorites as string[] : [],
  notes: config.notes && typeof config.notes === 'object' ? config.notes as Record<string, string> : {},
  groups: Array.isArray(config.groups) ? config.groups as FavoriteGroup[] : [],
  recordingGroups: config.recordingGroups && typeof config.recordingGroups === 'object'
    ? config.recordingGroups as Record<string, string> : {},
});

export const getFavoritesResponse = (config: ReturnType<typeof normalizeFavoritesConfig>): FavoritesMetadata => ({
  favorites: config.favorites,
  notes: config.notes,
  groups: config.groups,
  recordingGroups: config.recordingGroups,
});

export const getFavoritesConfig = async (): Promise<ReturnType<typeof normalizeFavoritesConfig>> => {
  try {
    const favoritesPath = getFavoritesConfigPath();
    const data = await fs.readFile(favoritesPath, 'utf8');
    return normalizeFavoritesConfig(JSON.parse(data));
  } catch {
    return normalizeFavoritesConfig();
  }
};

export const saveFavoritesConfig = async (favorites: Record<string, unknown>): Promise<boolean> => {
  try {
    const favoritesPath = getFavoritesConfigPath();
    await fs.writeFile(favoritesPath, JSON.stringify(normalizeFavoritesConfig(favorites), null, 2));
    return true;
  } catch (error) {
    logger.error('Error saving favorites config:', error);
    return false;
  }
};
