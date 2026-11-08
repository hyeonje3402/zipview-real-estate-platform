const { test, expect } = require('@playwright/test');

test.describe('ZipView 대시보드 및 챗봇 E2E 자동화 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 1. 공통 Mock API 설정: 대시보드 실거래가 조회 라우트
    await page.route('**/api/trades/**', async (route) => {
      const url = route.request().url();
      const isIncheon = url.includes('28260');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          regional_code: isIncheon ? '28260' : '11680',
          data: [
            {
              id: 'trade_1',
              deal_year: 2024,
              deal_month: 5,
              deal_day: 15,
              apt_name: isIncheon ? '청라국제도시한화꿈에그린' : '래미안대치팰리스',
              trade_type: '전세',
              deal_amount: 0,
              deposit_amount: 45000,
              monthly_amount: 0,
              exclusive_area: 84.99,
              floor: 12,
              dong: isIncheon ? '청라동' : '대치동'
            }
          ],
          chart: [
            { year: 2024, month: 5, trade_type: '전세', count: 1, avg_deal: 0, avg_deposit: 45000 }
          ],
          summary: {
            total_count: 1,
            latest_trade_price: '-',
            latest_jeonse_price: '4억 5,000만원',
            last_synced_at: new Date().toISOString()
          }
        })
      });
    });

    // 2. 시장 분석 감성 지표 Mock
    await page.route('**/api/ai/sentiment**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sentiment: '관망',
          score: 50,
          summary: '안정적인 실거래 유지 중'
        })
      });
    });

    // 3. 챗봇 질문 처리 Mock: '인천 서구 전세 찾아줘' 질의 시 타겟 지역 오버라이드 응답
    await page.route('**/api/chat', async (route) => {
      const postData = route.request().postDataJSON() || {};
      const prompt = postData.prompt || postData.query || '';

      if (prompt.includes('인천') || prompt.includes('서구')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '인천광역시 서구의 전세 실거래 분석 결과입니다.',
            new_regional_code: '28260',
            new_lawd_cd: '28260',
            new_city_name: '인천광역시',
            new_district_name: '서구',
            new_region_label: '인천광역시 서구',
            override_region: true
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '요청하신 지역의 실거래 분석 데이터입니다.',
            override_region: false
          })
        });
      }
    });
  });

  test('사용자가 챗봇에 "인천 서구 전세 찾아줘" 질의 시 부모 대시보드 지역이 자동 동기화되고 URL 파라미터가 갱신되어야 한다', async ({ page }) => {
    // 1. 대시보드 메인 페이지 접속
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. 시/도 및 시/군/구 드롭다운 셀렉터 렌더링 확인
    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });
    await expect(selectDistrict).toBeVisible();

    // 3. 플로팅 AI 상담 챗 모달 열기
    const chatTriggerBtn = page.locator('[data-testid="chat-trigger-btn"]');
    await expect(chatTriggerBtn).toBeVisible();
    await chatTriggerBtn.click();

    // 4. 챗봇 입력창에 "인천 서구 전세 찾아줘" 입력 후 전송
    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatSubmitBtn = page.locator('[data-testid="chat-submit-btn"]');
    await expect(chatInput).toBeVisible();

    await chatInput.fill('인천 서구 전세 찾아줘');
    await chatSubmitBtn.click();

    // 5. 부모 대시보드의 지역 드롭다운 UI가 '인천광역시 서구' (lawdCd: 28260)로 자동 동기화되는지 검증
    await expect(selectSido).toHaveValue('인천광역시', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('28260', { timeout: 10000 });

    // 6. 브라우저 URL 파라미터가 lawdCd=28260 으로 동적 갱신되는지 검증
    await expect.poll(() => page.url(), {
      message: '브라우저 URL 파라미터에 lawdCd=28260이 포함되어야 합니다',
      timeout: 10000
    }).toContain('lawdCd=28260');
  });
});

