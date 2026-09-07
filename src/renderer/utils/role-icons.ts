// Official role enums and asset naming, verified 2026-09-08:
// https://gaggle.fun/main.15d885d4e8b5d6e6.js
// Bundled by Vite from public/assets/role-icons, also available offline.
import iconSources from '../public/assets/role-icons/sources.json';

const availableIcons = new Set(iconSources.assets.map(asset => asset.name));
const ROLE_ASSET_NAMES: Record<number, string> = {
  1: 'Goose', 2: 'Duck', 3: 'Dodo', 4: 'Gravy', 5: 'Mechanic', 6: 'Technician',
  7: 'Medium', 8: 'Vigilante', 9: 'Cannibal', 10: 'Morphling', 11: 'Sheriff',
  12: 'Silencer', 13: 'Canadian', 14: 'LoverDuck', 15: 'LoverGoose', 16: 'Vulture',
  17: 'Professional', 18: 'Spy', 19: 'Mimic', 20: 'Detective', 21: 'Pigeon',
  22: 'Birdwatcher', 23: 'Assassin', 24: 'Falcon', 25: 'Hitman', 26: 'Bodyguard',
  27: 'Snitch', 28: 'Politician', 29: 'Locksmith', 30: 'Mortician', 31: 'Celebrity',
  32: 'Party', 33: 'Demolitionist', 34: 'DuelingDodo', 35: 'Goose', 36: 'Duck',
  37: 'Gravy', 38: 'Duck', 39: 'Falcon', 40: 'Vulture', 41: 'Morphling',
  42: 'Goose', 43: 'Goose', 44: 'Vampire', 45: 'Villager', 46: 'Thrall',
  47: 'Spectator', 48: 'IdentityThief', 49: 'Adventurer', 50: 'Avenger',
  51: 'Ninja', 52: 'Undertaker', 53: 'Snoop', 54: 'Esper', 55: 'Invisibility',
  56: 'Astral', 57: 'Pelican', 58: 'EThrall', 59: 'Mummy', 60: 'SerialKiller',
  61: 'Engineer', 62: 'Warlock', 63: 'StreetUrchin', 64: 'Tracker', 65: 'EsperDuck',
  66: 'Stalker', 67: 'Preacher', 68: 'Inquisitor', 69: 'Saint', 70: 'HighPriest',
  71: 'DemonHunter', 72: 'Initiate', 73: 'Seamstress', 74: 'Crow', 75: 'SinEater',
  76: 'Goose', 77: 'Chicken', 78: 'Bodyguard', 79: 'IdentityThief', 80: 'Undertaker',
  81: 'CamoDuck', 82: 'Cupid', 83: 'Survivalist', 84: 'Carrier', 85: 'Parasite',
  86: 'Drone', 87: 'Scientist', 88: 'Role', 89: 'Owl', 90: 'Spotter', 91: 'Sniper',
  92: 'Lobbyist', 93: 'LostDuckling', 94: 'FortuneTeller', 95: 'Mime', 96: 'Raven',
  97: 'Rabbit', 98: 'LucidDreamer', 99: 'Clown', 100: 'Soldier', 101: 'Coroner',
  102: 'Sensor', 103: 'Looter', 104: 'Sniper', 105: 'Delusional', 106: 'Hawk',
  107: 'AI', 108: 'DrTurducken', 109: 'TurduckensMonster', 110: 'WitchDoctor',
  111: 'Cuckoo', 112: 'Swordsman', 113: 'Magpie',
};

export function getRoleIconCandidates(roleId: number): string[] {
  const name = ROLE_ASSET_NAMES[roleId];
  if (!name || !availableIcons.has(name)) return [];
  return [`${import.meta.env.BASE_URL}assets/role-icons/${name}.png`];
}
