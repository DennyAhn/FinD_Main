import { prisma } from '../shared';

async function reset() {
  console.log('🗑️ DB 데이터 전체 삭제 시작...');
  
  // Alert 먼저 삭제 (User 참조)
  try {
    const deletedAlerts = await prisma.alert.deleteMany();
    console.log(`   - Alert: ${deletedAlerts.count}개 삭제 완료`);
  } catch {
    console.log('   - Alert: 테이블 없음 (스킵)');
  }

  // User 삭제
  try {
    const deletedUsers = await prisma.user.deleteMany();
    console.log(`   - User: ${deletedUsers.count}개 삭제 완료`);
  } catch {
    console.log('   - User: 테이블 없음 (스킵)');
  }

  // 1분봉 데이터 삭제
  // Note: CA views(5m, 15m, 1h, 4h, 1d, 1w, 1mo)는 1분봉 기반이므로 자동으로 갱신됨
  const deleted1m = await prisma.candle1m.deleteMany();
  console.log(`   - Candle1m (1분봉): ${deleted1m.count}개 삭제 완료`);
  console.log(`   - CA Views (5m~1mo): Candle1m 삭제로 자동 갱신됨`);

  console.log('✨ DB가 깨끗하게 비워졌습니다.');
}

reset()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
