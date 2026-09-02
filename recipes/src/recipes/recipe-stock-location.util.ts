import { BadRequestException } from '@nestjs/common';

/**
 * Recipe stock operations must be scoped to a single work location.
 * No global fallback, no "first location" heuristic.
 */
export function resolveRecipeStockLocationId(
  locationId: unknown,
): number {
  const parsed = Number(locationId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException(
      'location_id este obligatoriu pentru operațiile pe stoc ale rețetei',
    );
  }
  return parsed;
}
