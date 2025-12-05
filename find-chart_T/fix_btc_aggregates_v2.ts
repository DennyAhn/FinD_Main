
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check TimescaleDB version
    const version = await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';`;
    console.log('TimescaleDB Version:', version);

    const views = [
        'candle_5m',
        'candle_15m',
        'candle_1h',
        'candle_4h',
        'candle_1d',
        'candle_1w',
        'candle_1mo'
    ];

    // Get the min and max time for BTC/USD
    const minMax = await prisma.candle1m.aggregate({
        where: { symbol: 'BTC/USD' },
        _min: { time: true },
        _max: { time: true }
    });

    if (!minMax._min.time || !minMax._max.time) {
        console.log('No BTC/USD data found.');
        return;
    }

    const start = minMax._min.time.toISOString();
    const end = minMax._max.time.toISOString();

    console.log(`Refreshing views from ${start} to ${end}...`);

    for (const view of views) {
        console.log(`Refreshing view: market.${view}`);
        
        // Try CALL with public schema prefix
        try {
             await prisma.$executeRawUnsafe(`CALL public.refresh_continuous_aggregate('market.${view}', '${start}'::timestamptz, '${end}'::timestamptz);`);
             console.log(`Successfully refreshed market.${view} (CALL public.)`);
             continue;
        } catch (e: any) {
            console.log(`CALL public. failed for market.${view}:`, e);
        }

        // Try CALL with NULLs (Refresh all)
        try {
             await prisma.$executeRawUnsafe(`CALL public.refresh_continuous_aggregate('market.${view}', NULL, NULL);`);
             console.log(`Successfully refreshed market.${view} (CALL NULL)`);
             continue;
        } catch (e: any) {
            console.log(`CALL NULL failed for market.${view}:`, e);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
