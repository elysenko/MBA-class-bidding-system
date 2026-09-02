import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolutionOutcome {
  resolved: boolean;
  reason?: 'no-window' | 'still-open' | 'already-resolved';
  bidsResolved?: number;
  durationMs?: number;
}

/**
 * Awards seats when the bidding window closes.
 *
 * The whole run is one transaction guarded by a Postgres advisory lock, so it is
 * safe to call from every replica and is idempotent: a second call after
 * `resolved_at` is set is a no-op.
 */
@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveWindow(): Promise<ResolutionOutcome> {
    const startedAt = Date.now();

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bid-resolution'))`;

      const windows = await tx.$queryRaw<
        Array<{ opens_at: Date; closes_at: Date; resolved_at: Date | null }>
      >`SELECT opens_at, closes_at, resolved_at FROM bidding_window WHERE id = 1`;
      const window = windows[0];
      if (!window) {
        return { resolved: false, reason: 'no-window' as const };
      }
      if (window.resolved_at) {
        return { resolved: false, reason: 'already-resolved' as const };
      }
      if (window.closes_at.getTime() > Date.now()) {
        return { resolved: false, reason: 'still-open' as const };
      }

      /*
       * One statement does the whole allocation:
       *   1. rank each class's active bids highest-first, ties broken at random;
       *   2. the top `seat_cap` win, everyone else loses;
       *   3. every resolved bid — won or lost — is deducted from the balance.
       * Losing bids are deliberately not refunded.
       */
      const resolvedBids = await tx.$executeRaw(Prisma.sql`
        WITH ranked AS (
          SELECT b.id,
                 c.seat_cap,
                 row_number() OVER (
                   PARTITION BY b.class_id
                   ORDER BY b.amount DESC, random()
                 ) AS rn
          FROM bids b
          JOIN classes c ON c.id = b.class_id
          WHERE b.status = 'ACTIVE'
        ),
        updated AS (
          UPDATE bids b
          SET status = CASE WHEN r.rn <= r.seat_cap THEN 'WON'::"BidStatus" ELSE 'LOST'::"BidStatus" END,
              updated_at = NOW()
          FROM ranked r
          WHERE b.id = r.id
          RETURNING b.user_id, b.amount
        ),
        totals AS (
          SELECT user_id, SUM(amount)::int AS spent FROM updated GROUP BY user_id
        )
        UPDATE users u
        SET point_balance = u.point_balance - t.spent,
            updated_at = NOW()
        FROM totals t
        WHERE u.id = t.user_id
      `);

      await tx.$executeRaw`UPDATE bidding_window SET resolved_at = NOW(), updated_at = NOW() WHERE id = 1`;

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Bidding window resolved in ${durationMs}ms (${resolvedBids} student balances updated).`,
      );
      return { resolved: true, bidsResolved: resolvedBids, durationMs };
    });
  }
}
