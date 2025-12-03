-- DB에 logo_url 컬럼 추가
ALTER TABLE company_profiles 
ADD COLUMN logo_url VARCHAR(500) AFTER website;

-- 기존 데이터에 대해 logo_url을 NULL로 설정 (나중에 API 호출 시 업데이트됨)
-- 또는 바로 업데이트하려면:
-- UPDATE company_profiles SET logo_url = CONCAT('https://images.financialmodelingprep.com/symbol/', ticker, '.png');

