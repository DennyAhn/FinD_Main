
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking BTC/USD categories in Candle1m...');
    
    const stockCount = await prisma.candle1m.count({
      where: {
        symbol: 'BTC/USD',
        category: 'stock'
      }
    });

    const cryptoCount = await prisma.candle1m.count({
      where: {
        symbol: 'BTC/USD',
        category: 'crypto'
      }
    });

    console.log(`BTC/USD (stock): ${stockCount}`);
    console.log(`BTC/USD (crypto): ${cryptoCount}`);

    if (stockCount > 0) {
        console.log('Found "stock" category candles. Updating them to "crypto"...');
        const result = await prisma.candle1m.updateMany({
            where: {
                symbol: 'BTC/USD',
                category: 'stock'
            },
            data: {
                category: 'crypto'
            }
        });
        console.log(`Updated ${result.count} rows.`);
    } else {
        console.log('All Candle1m rows are already "crypto".');
    }

    // Now we need to refresh the continuous aggregates.
    // Since we can't easily do this via Prisma models (they are views), we use $executeRaw.
    // We need to refresh the entire range.
    
    const views = [
        'candle_5m',
        'candle_15m',
        'candle_1h',
        'candle_4h',
        'candle_1d',
        'candle_1w',
        'candle_1mo'
    ];

    // Get the min and max time for BTC/USD to know the range to refresh
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
    const end = minMax._max.time.toISOString(); // Use max time + buffer if needed, but exact is usually fine for refresh

    console.log(`Refreshing views from ${start} to ${end}...`);

    for (const view of views) {
        console.log(`Refreshing view: market.${view}`);
        // TimescaleDB refresh command
        // CALL refresh_continuous_aggregate('market.candle_5m', NULL, NULL); -- Refreshes everything? 
        // Or specific window: CALL refresh_continuous_aggregate('market.candle_5m', '2020-01-01', '2025-01-01');
        
        // Using a safe window.
        try {
             await prisma.$executeRawUnsafe(`CALL refresh_continuous_aggregate('market.${view}', NULL, NULL);`);
             console.log(`Successfully refreshed market.${view} (Full refresh)`);
        } catch (e) {
            console.error(`Failed to refresh market.${view}:`, e);
            // Fallback to windowed refresh if NULL, NULL is not supported or fails (though it usually means "all")
            // Actually NULL, NULL means "refresh the materialized window", but for manual refresh of history we might need explicit bounds if the policy hasn't covered it.
            // Let's try explicit bounds if the above fails or just do explicit bounds to be safe.
             try {
                await prisma.$executeRawUnsafe(`CALL refresh_continuous_aggregate('market.${view}', '${start}'::timestamptz, '${end}'::timestamptz);`);
                console.log(`Successfully refreshed market.${view} (Windowed: ${start} - ${end})`);
             } catch (e2) {
                 console.error(`Failed windowed refresh for market.${view}:`, e2);
             }
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
