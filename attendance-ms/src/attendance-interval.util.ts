import { BadRequestException } from '@nestjs/common';
import { InflexionType } from './entities/presence-inflexion.entity';
import type { PresenceInflexion } from './entities/presence-inflexion.entity';

export function sortInflexions(
  inflexions: PresenceInflexion[],
): PresenceInflexion[] {
  return [...inflexions].sort((a, b) => {
    const diff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (diff !== 0) {
      return diff;
    }
    if (a.type === InflexionType.ENTRY && b.type === InflexionType.EXIT) {
      return -1;
    }
    if (a.type === InflexionType.EXIT && b.type === InflexionType.ENTRY) {
      return 1;
    }
    return a.id - b.id;
  });
}

export function validateInflexionTimeline(
  inflexions: PresenceInflexion[],
): void {
  const sorted = sortInflexions(inflexions);
  let lastType: InflexionType | null = null;
  let lastEntryTime: Date | null = null;
  let lastClosedExit: Date | null = null;

  for (const inf of sorted) {
    const ts = new Date(inf.timestamp);
    if (Number.isNaN(ts.getTime())) {
      throw new BadRequestException('Timestamp invalid în presence_inflexion');
    }

    if (inf.type === InflexionType.ENTRY) {
      if (lastType === InflexionType.ENTRY) {
        throw new BadRequestException(
          'Două intrări consecutive nu sunt permise',
        );
      }
      if (lastClosedExit && ts < lastClosedExit) {
        throw new BadRequestException('Intervale suprapuse');
      }
      lastEntryTime = ts;
      lastType = InflexionType.ENTRY;
      continue;
    }

    if (inf.type === InflexionType.EXIT) {
      if (lastType !== InflexionType.ENTRY || !lastEntryTime) {
        throw new BadRequestException('Ieșire fără intrare deschisă');
      }
      if (ts < lastEntryTime) {
        throw new BadRequestException(
          'Ieșirea trebuie să fie după intrarea asociată',
        );
      }
      lastClosedExit = ts;
      lastEntryTime = null;
      lastType = InflexionType.EXIT;
      continue;
    }

    throw new BadRequestException(`Tip inflexion necunoscut: ${inf.type}`);
  }
}

export function buildClosedIntervalMinutes(
  inflexions: PresenceInflexion[],
): number {
  const sorted = sortInflexions(inflexions);
  let openEntry: Date | null = null;
  let totalMinutes = 0;

  for (const inf of sorted) {
    const ts = new Date(inf.timestamp);
    if (inf.type === InflexionType.ENTRY) {
      openEntry = ts;
    } else if (inf.type === InflexionType.EXIT && openEntry) {
      totalMinutes += Math.round(
        (ts.getTime() - openEntry.getTime()) / 60000,
      );
      openEntry = null;
    }
  }

  return totalMinutes;
}

export function findOpenEntryInflexion(
  inflexions: PresenceInflexion[],
): PresenceInflexion | null {
  const sorted = sortInflexions(inflexions);
  let openEntry: PresenceInflexion | null = null;

  for (const inf of sorted) {
    if (inf.type === InflexionType.ENTRY) {
      openEntry = inf;
    } else if (inf.type === InflexionType.EXIT) {
      openEntry = null;
    }
  }

  return openEntry;
}
