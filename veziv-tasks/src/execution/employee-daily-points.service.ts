import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { normalizeWorkDate } from './daily-points.util';

@Injectable()
export class EmployeeDailyPointsService {
  constructor(
    @InjectRepository(EmployeeDailyPoints)
    private readonly dailyPointsRepo: Repository<EmployeeDailyPoints>,
    @InjectRepository(EmployeeDailyTaskPoints)
    private readonly taskPointsRepo: Repository<EmployeeDailyTaskPoints>,
  ) {}

  /** Găsește toate rândurile pentru (angajat, zi, locație). */
  async findRowsForDay(
    employeeId: number,
    workDate: string | Date,
    locationId: number,
  ): Promise<EmployeeDailyPoints[]> {
    const workDateStr = normalizeWorkDate(workDate);
    return this.dailyPointsRepo
      .createQueryBuilder('edp')
      .where('edp.employee_id = :employeeId', { employeeId })
      .andWhere('edp.location_id = :locationId', { locationId })
      .andWhere('DATE(edp.work_date) = :workDate', { workDate: workDateStr })
      .orderBy('edp.id', 'ASC')
      .getMany();
  }

  /**
   * Dacă există duplicate legacy, păstrează rândul cu cele mai multe task-uri,
   * mută legăturile de task și șterge orphan-urile fără task-uri.
   */
  async mergeDuplicatesIfNeeded(
    employeeId: number,
    workDate: string | Date,
    locationId: number,
  ): Promise<EmployeeDailyPoints | null> {
    const rows = await this.findRowsForDay(employeeId, workDate, locationId);
    if (rows.length === 0) return null;
    if (rows.length === 1) return rows[0];

    const withCounts = await Promise.all(
      rows.map(async (row) => ({
        row,
        taskCount: await this.taskPointsRepo.count({
          where: { employee_daily_points_id: row.id },
        }),
      })),
    );

    withCounts.sort((a, b) => {
      if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
      return Number(b.row.total_points) - Number(a.row.total_points);
    });

    const canonical = withCounts[0].row;
    const canonicalOriginalTotal = Number(canonical.total_points || 0);
    const canonicalOriginalTaskSum = await this.sumTaskPoints(canonical.id);

    for (let i = 1; i < withCounts.length; i++) {
      const { row: dup, taskCount } = withCounts[i];

      if (taskCount === 0) {
        // Rând orphan (ex. pontaj duplicat) – ștergem fără a adăuga puncte
        await this.dailyPointsRepo.remove(dup);
        continue;
      }

      await this.taskPointsRepo.update(
        { employee_daily_points_id: dup.id },
        { employee_daily_points_id: canonical.id },
      );
      await this.dailyPointsRepo.remove(dup);
    }

    const newTaskSum = await this.sumTaskPoints(canonical.id);
    const nonTaskPoints = Math.max(canonicalOriginalTotal - canonicalOriginalTaskSum, 0);
    canonical.total_points = newTaskSum + nonTaskPoints;
    await this.dailyPointsRepo.save(canonical);

    return this.dailyPointsRepo.findOne({ where: { id: canonical.id } });
  }

  private async sumTaskPoints(dailyPointsId: number): Promise<number> {
    const result = await this.taskPointsRepo
      .createQueryBuilder('tp')
      .select('COALESCE(SUM(tp.points_awarded), 0)', 'total')
      .where('tp.employee_daily_points_id = :id', { id: dailyPointsId })
      .getRawOne<{ total: string }>();
    return parseFloat(result?.total ?? '0') || 0;
  }

  /** Găsește sau creează un singur rând zilnic per (angajat, zi, locație). */
  async findOrCreate(
    employeeId: number,
    workDate: string | Date,
    locationId: number,
  ): Promise<EmployeeDailyPoints> {
    if (locationId == null || !Number.isFinite(Number(locationId))) {
      throw new BadRequestException(
        'location_id este obligatoriu pentru Employee_Daily_Points',
      );
    }

    const merged = await this.mergeDuplicatesIfNeeded(employeeId, workDate, locationId);
    if (merged) return merged;

    const workDateStr = normalizeWorkDate(workDate);
    const created = this.dailyPointsRepo.create({
      employee_id: employeeId,
      work_date: workDateStr as unknown as Date,
      location_id: locationId,
      total_points: 0,
    });
    return this.dailyPointsRepo.save(created);
  }

  /** Adaugă puncte (comportament aditiv – ex. pontaj / punctualitate). */
  async addDelta(
    employeeId: number,
    workDate: string | Date,
    locationId: number,
    delta: number,
  ): Promise<EmployeeDailyPoints> {
    const row = await this.findOrCreate(employeeId, workDate, locationId);
    const before = Number(row.total_points || 0);
    row.total_points = before + Number(delta || 0);
    return this.dailyPointsRepo.save(row);
  }

  /**
   * Recalculează total_points păstrând punctele non-task (ex. pontaj).
   * @param pointsBeforeLastTaskChange total_points înainte de ultima modificare de task
   * @param taskSumBeforeLastChange suma task-urilor înainte de ultima modificare
   */
  async recalculateTotalPoints(
    dailyPointsId: number,
    pointsBeforeLastTaskChange: number,
    taskSumBeforeLastChange: number,
  ): Promise<void> {
    const row = await this.dailyPointsRepo.findOne({ where: { id: dailyPointsId } });
    if (!row) return;

    const taskSum = await this.sumTaskPoints(dailyPointsId);
    const nonTaskPoints = Math.max(pointsBeforeLastTaskChange - taskSumBeforeLastChange, 0);
    row.total_points = taskSum + nonTaskPoints;
    await this.dailyPointsRepo.save(row);
  }
}
