
import { prisma } from '../shared';
import { SYMBOL_META } from '../modules/quote/quote.types';
import { candleService } from '../modules/candle';

async function main() {
  console.log('🚀 Fixing categories for all symbols...');

  for (const [symbol, meta] of Object.entries(SYMBOL_META)) {
    const correctCategory = meta.category;
    
    console.log(`Checking ${symbol} (Should be ${correctCategory})...`);

    // Update incorrect categories
    try {
      const result = await prisma.candle1m.updateMany({
        where: {
          symbol: symbol,
          category: { not: correctCategory }
        },
        data: {
          category: correctCategory
        }
      });

      if (result.count > 0) {
        console.log(`  ✅ Updated ${result.count} rows for ${symbol} to '${correctCategory}'`);
      } else {
        console.log(`  ✨ All rows for ${symbol} are already correct.`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to update ${symbol}: ${error.message}`);
      // Continue to next symbol
    }
  }

  console.log('\n🔄 Refreshing Continuous Aggregates...');
  try {
    await candleService.refreshAllContinuousAggregates();
    console.log('✅ Continuous Aggregates refreshed successfully.');
  } catch (error) {
    console.error('❌ Failed to refresh aggregates:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
