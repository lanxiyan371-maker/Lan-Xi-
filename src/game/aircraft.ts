import type { AircraftId, AircraftSkill } from './types';

export interface AircraftDefinition {
  id: AircraftId;
  name: string;
  tagline: string;
  speed: number;
  startHp: number;
  maxHp: number;
  skill: AircraftSkill;
  skillName: string;
  skillDescription: string;
  skillCooldown: number;
  unlockedByDefault: boolean;
  coinCost: number;
  hullTop: string;
  hullMid: string;
  hullBottom: string;
  cockpitColor: string;
  engineColor: string;
  bulletColor: string;
}

export const AIRCRAFT_ORDER: AircraftId[] = ['falcon', 'phantom', 'fortress'];

export const AIRCRAFT: Record<AircraftId, AircraftDefinition> = {
  falcon: {
    id: 'falcon',
    name: '猎鹰',
    tagline: '攻守均衡的全能战机',
    speed: 6,
    startHp: 3,
    maxHp: 5,
    skill: 'missile_salvo',
    skillName: '导弹齐射',
    skillDescription: '向附近敌机发射追踪导弹',
    skillCooldown: 8,
    unlockedByDefault: true,
    coinCost: 0,
    hullTop: '#44ddff',
    hullMid: '#2288cc',
    hullBottom: '#115577',
    cockpitColor: '#88eeff',
    engineColor: '#0088ff',
    bulletColor: '#0ff',
  },
  phantom: {
    id: 'phantom',
    name: '幻影',
    tagline: '高速灵活，装甲薄弱',
    speed: 8,
    startHp: 2,
    maxHp: 4,
    skill: 'dash',
    skillName: '闪现突进',
    skillDescription: '向前闪现，获得短暂无敌',
    skillCooldown: 4,
    unlockedByDefault: false,
    coinCost: 500,
    hullTop: '#cc88ff',
    hullMid: '#8844cc',
    hullBottom: '#442266',
    cockpitColor: '#ddaaff',
    engineColor: '#aa44ff',
    bulletColor: '#c8f',
  },
  fortress: {
    id: 'fortress',
    name: '堡垒',
    tagline: '重型装甲，移动较慢',
    speed: 4,
    startHp: 5,
    maxHp: 6,
    skill: 'energy_shield',
    skillName: '能量护盾',
    skillDescription: '吸收伤害并强化下一次攻击',
    skillCooldown: 10,
    unlockedByDefault: false,
    coinCost: 800,
    hullTop: '#ffcc44',
    hullMid: '#cc8822',
    hullBottom: '#664411',
    cockpitColor: '#ffdd88',
    engineColor: '#ff8800',
    bulletColor: '#fc4',
  },
};

export function getAircraft(id: AircraftId): AircraftDefinition {
  return AIRCRAFT[id];
}

export function nextAircraft(id: AircraftId, direction: -1 | 1): AircraftId {
  const index = AIRCRAFT_ORDER.indexOf(id);
  const next = (index + direction + AIRCRAFT_ORDER.length) % AIRCRAFT_ORDER.length;
  return AIRCRAFT_ORDER[next];
}
