-- 한글 기업명 컬럼 추가
ALTER TABLE company_profiles 
ADD COLUMN k_name VARCHAR(255) AFTER companyName;

-- 주요 기업 한글명 업데이트
UPDATE company_profiles SET k_name = '애플' WHERE ticker = 'AAPL';
UPDATE company_profiles SET k_name = '마이크로소프트' WHERE ticker = 'MSFT';
UPDATE company_profiles SET k_name = '엔비디아' WHERE ticker = 'NVDA';
UPDATE company_profiles SET k_name = '알파벳' WHERE ticker = 'GOOGL';
UPDATE company_profiles SET k_name = '메타' WHERE ticker = 'META';
UPDATE company_profiles SET k_name = '아마존' WHERE ticker = 'AMZN';
UPDATE company_profiles SET k_name = '테슬라' WHERE ticker = 'TSLA';
UPDATE company_profiles SET k_name = '브로드컴' WHERE ticker = 'AVGO';
UPDATE company_profiles SET k_name = 'JP모건체이스' WHERE ticker = 'JPM';
UPDATE company_profiles SET k_name = '비자' WHERE ticker = 'V';
UPDATE company_profiles SET k_name = '유나이티드헬스' WHERE ticker = 'UNH';
UPDATE company_profiles SET k_name = '엑슨모빌' WHERE ticker = 'XOM';
UPDATE company_profiles SET k_name = '존슨앤드존슨' WHERE ticker = 'JNJ';
UPDATE company_profiles SET k_name = '코스트코' WHERE ticker = 'COST';
UPDATE company_profiles SET k_name = '릴리' WHERE ticker = 'LLY';
UPDATE company_profiles SET k_name = 'P&G' WHERE ticker = 'PG';
UPDATE company_profiles SET k_name = '머크' WHERE ticker = 'MRK';

