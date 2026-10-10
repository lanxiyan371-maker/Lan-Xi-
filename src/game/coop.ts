import type { AircraftId, CoopLoadout, GameData, Player } from './types';
import { getAircraft } from './aircraft';

/** True when the current mode is the 2-player co-op endless mode. */
export function isCoopMode(g: GameData): boolean {
  return g.gameMode === 'coop_endless';
}

/** Ships currently in play: both ships in co-op with a joined guest, else solo. */
export function activePlayers(g: GameData): Player[] {
  return g.player2 ? [g.player, g.player2] : [g.player];
}

/** True when the run should end: either ship down in co-op, or the lone ship down in solo. */
export function shouldTeamWipe(g: GameData): boolean {
  if (!isCoopMode(g) || !g.player2) return g.player.hp <= 0;
  return g.player.hp <= 0 || g.player2.hp <= 0;
}

export type CoopSeat = 'host' | 'guest';

/**
 * Which coop seat a ship occupies on this client.
 * Host frame: `player` = host, `player2` = guest.
 * Guest frame (after snapshot remap): `player` = guest (self), `player2` = host.
 */
export function coopSeatForShip(g: GameData, p: Player): CoopSeat | null {
  if (!isCoopMode(g) || !g.player2) return null;
  if (g.coopRole === 'host') return p === g.player ? 'host' : 'guest';
  if (g.coopRole === 'guest') return p === g.player ? 'guest' : 'host';
  return null;
}

export interface ShipPalette {
  hullTop: string;
  hullMid: string;
  hullBottom: string;
  cockpitColor: string;
  engineColor: string;
  accent: string;
}

/** Host = cyan team, guest = amber team — always distinct even with the same craft. */
const COOP_SEAT_PALETTE: Record<CoopSeat, ShipPalette> = {
  host: {
    hullTop: '#4de8ff',
    hullMid: '#1a8fd4',
    hullBottom: '#0a4a7a',
    cockpitColor: '#b8f6ff',
    engineColor: '#00aaff',
    accent: '#4df',
  },
  guest: {
    hullTop: '#ffb347',
    hullMid: '#e07020',
    hullBottom: '#8a3a08',
    cockpitColor: '#ffe0a8',
    engineColor: '#ff8800',
    accent: '#fa4',
  },
};

/** Resolves draw colors for a ship; coop seats override craft hull tints. */
export function resolveCoopShipPalette(aircraftId: AircraftId, seat: CoopSeat | null): ShipPalette {
  if (seat) return COOP_SEAT_PALETTE[seat];
  const craft = getAircraft(aircraftId);
  return {
    hullTop: craft.hullTop,
    hullMid: craft.hullMid,
    hullBottom: craft.hullBottom,
    cockpitColor: craft.cockpitColor,
    engineColor: craft.engineColor,
    accent: craft.hullTop,
  };
}

/** Room-relayed lobby state, shaped like the `lobby` net message. */
export interface CoopLobbySnapshot {
  hostPresent: boolean;
  guestPresent: boolean;
  canStart: boolean;
  hostLoadout?: CoopLoadout;
  guestLoadout?: CoopLoadout;
}

/** Applies a `lobby` message onto menu-facing GameData fields. */
export function applyLobbyMessage(g: GameData, msg: CoopLobbySnapshot): void {
  g.coopHostPresent = msg.hostPresent;
  g.coopGuestPresent = msg.guestPresent;
  g.coopLobbyCanStart = msg.canStart;
  g.coopHostLoadout = msg.hostLoadout ?? null;
  g.coopGuestLoadout = msg.guestLoadout ?? null;
  g.coopError = null;
  if (msg.canStart) {
    g.coopLobbyStatus = 'ready';
  } else {
    g.coopLobbyStatus = g.coopRole === 'guest' ? 'waiting_for_host' : 'waiting_for_guest';
  }
}

/** Applies an `error` message (e.g. `room_full`, `role_taken`, `game_started`). */
export function applyCoopError(g: GameData, message: string): void {
  g.coopError = message;
  g.coopLobbyStatus = 'error';
}

const COOP_ERROR_LABELS: Record<string, string> = {
  room_full: '房间已满',
  role_taken: '该位置已被占用',
  game_started: '该房间已开始游戏',
  invalid_code: '请输入有效的 6 位房间码',
  disconnected: '已与房间断开连接',
  connection_failed: '无法连接合作服务器，请检查连接配置',
};

/** Human-readable text for a coop `error` message code. */
export function describeCoopError(code: string): string {
  return COOP_ERROR_LABELS[code] ?? code;
}

export interface CoopLobbyCopy {
  value: string;
  detail: string;
}

/** Menu-facing copy for the current coop lobby phase. */
export function describeCoopLobby(g: GameData): CoopLobbyCopy {
  if (g.coopLobbyStatus === 'error' && g.coopError) {
    return {
      value: describeCoopError(g.coopError).toUpperCase(),
      detail: 'H 创建房间 · J 加入房间',
    };
  }
  switch (g.coopLobbyStatus) {
    case 'entering_code': {
      const draft = g.coopCodeDraft.padEnd(6, '_');
      return {
        value: `房间码  ${draft.split('').join(' ')}`,
        detail: '输入字母或数字 · 退格删除 · 回车加入 · Esc 取消',
      };
    }
    case 'connecting':
      return { value: '正在连接…', detail: '' };
    case 'waiting_for_guest':
      return {
        value: `房间 ${g.coopRoomCode} · 等待队友`,
        detail: '分享房间码，队友按 J 输入后加入',
      };
    case 'waiting_for_host':
      return {
        value: `房间 ${g.coopRoomCode} · 等待房主`,
        detail: '准备好后，由房主按空格开始',
      };
    case 'ready':
      return g.coopRole === 'host'
        ? { value: `房间 ${g.coopRoomCode} · 已就绪`, detail: '按空格开始' }
        : { value: `房间 ${g.coopRoomCode} · 已就绪`, detail: '等待房主开始' };
    case 'idle':
    default:
      return {
        value: 'H 创建房间 · J 加入房间',
        detail: '按 J 输入 6 位房间码，再按回车加入',
      };
  }
}

/** Clears session/lobby fields back to their pre-connect defaults. */
export function resetCoopLobby(g: GameData): void {
  g.coopRole = null;
  g.coopRoomCode = '';
  g.coopCodeDraft = '';
  g.coopHostPresent = false;
  g.coopGuestPresent = false;
  g.coopLobbyCanStart = false;
  g.coopHostLoadout = null;
  g.coopGuestLoadout = null;
  g.coopError = null;
  g.coopLobbyStatus = 'idle';
}
