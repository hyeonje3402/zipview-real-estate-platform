const { test, expect } = require('@playwright/test');

test.describe('ZipView 대시보드 및 챗봇 E2E 자동화 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 1. 공통 Mock API 설정: 대시보드 실거래가 조회 라우트
    await page.route('**/api/trades/**', async (route) => {
      const url = route.request().url();
      const isIncheon = url.includes('28260');
      const isJinju = url.includes('48170');

      let targetCode = '11680';
      let aptName = '래미안대치팰리스';
      let dongName = '대치동';

      if (isIncheon) {
        targetCode = '28260';
        aptName = '청라국제도시한화꿈에그린';
        dongName = '청라동';
      } else if (isJinju) {
        targetCode = '48170';
        aptName = '진주혁신도시대방노블랜드';
        dongName = '충무공동';
      }

      const items = isJinju ? [
        {
          id: 'trade_jinju_1',
          deal_year: 2024,
          deal_month: 5,
          deal_day: 15,
          apt_name: '트레젠웰가',
          trade_type: '월세',
          deal_amount: 0,
          deposit_amount: 1000,
          monthly_amount: 55,
          exclusive_area: 59.99,
          floor: 8,
          dong: '충무공동'
        },
        {
          id: 'trade_jinju_2',
          deal_year: 2024,
          deal_month: 5,
          deal_day: 10,
          apt_name: '진주혁신도시대방노블랜드',
          trade_type: '전세',
          deal_amount: 0,
          deposit_amount: 45000,
          monthly_amount: 0,
          exclusive_area: 84.99,
          floor: 12,
          dong: '충무공동'
        }
      ] : [
        {
          id: 'trade_1',
          deal_year: 2024,
          deal_month: 5,
          deal_day: 15,
          apt_name: aptName,
          trade_type: '전세',
          deal_amount: 0,
          deposit_amount: 45000,
          monthly_amount: 0,
          exclusive_area: 84.99,
          floor: 12,
          dong: dongName
        }
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          regional_code: targetCode,
          data: items,
          chart: [
            { year: 2024, month: 5, trade_type: '전세', count: 1, avg_deal: 0, avg_deposit: 45000 }
          ],
          summary: {
            total_count: items.length,
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

    // 3. 챗봇 질문 처리 Mock: 질의에 따른 타겟 지역 오버라이드 응답
    await page.route('**/api/chat', async (route) => {
      const postData = route.request().postDataJSON() || {};
      const prompt = postData.prompt || postData.query || '';

      if (prompt.includes('트레젠웰가')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '요청하신 [경상남도 진주시] 트레젠웰가 월세 실거래 및 매물 정보를 분석했습니다.',
            new_regional_code: '48170',
            new_lawd_cd: '48170',
            new_city_name: '경상남도',
            new_district_name: '진주시',
            new_region_label: '경상남도 진주시',
            override_region: true,
            target_view: 'TRANSACTION',
            trade_type: '월세',
            search_keyword: '트레젠웰가'
          })
        });
      } else if (prompt.includes('김해시')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '요청하신 [경상남도 김해시]의 원룸 매물을 분석했습니다.',
            new_regional_code: '48250',
            new_lawd_cd: '48250',
            new_city_name: '경상남도',
            new_district_name: '김해시',
            new_region_label: '경상남도 김해시',
            override_region: true,
            target_view: 'B2B',
            trade_type: '월세'
          })
        });
      } else if (prompt.includes('월세 매물')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '요청하신 [경상남도 진주시]의 월세 매물을 분석했습니다.',
            new_regional_code: '48170',
            new_lawd_cd: '48170',
            new_city_name: '경상남도',
            new_district_name: '진주시',
            new_region_label: '경상남도 진주시',
            override_region: true,
            target_view: 'B2B',
            trade_type: '월세'
          })
        });
      } else if (prompt.includes('남강축제')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'needs_clarification',
            reply: '혹시 진주 남강유등축제가 열리는 경상남도 진주시 일대의 매물을 찾으시나요?',
            disambiguation: {
              keyword: '진주 남강유등축제',
              entity_type: 'landmark',
              original_prompt: postData.prompt,
              options: [{ index: 1, label: '경상남도 진주시 (남강유등축제 인접 칠암동, 망경동, 강남동)', code: '48170', sido: '경상남도', district: '진주시' }]
            }
          })
        });
      } else if (prompt.includes('응 맞아') || postData.selected_option) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '요청하신 [경상남도 진주시]의 거래 내역을 새로 분석했습니다.',
            new_regional_code: '48170',
            new_lawd_cd: '48170',
            new_city_name: '경상남도',
            new_district_name: '진주시',
            new_region_label: '경상남도 진주시',
            override_region: true,
            target_dongs: ['칠암동', '망경동', '강남동', '본성동'],
            hotspot_coord: { lat: 35.1804, lng: 128.0872 }
          })
        });
      } else if (prompt.includes('혁샌도시') || prompt.includes('혁신도시')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            reply: '말씀하신 "혁샌도시"를 충무공동(진주 혁신도시)으로 자동 교정하여 분석했습니다.',
            new_regional_code: '48170',
            new_lawd_cd: '48170',
            new_city_name: '경상남도',
            new_district_name: '진주시',
            new_region_label: '경상남도 진주시',
            override_region: true
          })
        });
      } else if (prompt.includes('인천') || prompt.includes('서구')) {
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

  test('사용자가 고의 오타 "혁샌도시 쪽은 읎어?" 입력 시 충무공동(진주 혁신도시)으로 자동 교정되고 부모 대시보드가 스위칭되어야 한다', async ({ page }) => {
    // 1. 대시보드 메인 페이지 접속
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. 셀렉터 확인
    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });
    await expect(selectDistrict).toBeVisible();

    // 3. 플로팅 AI 상담 챗 모달 열기
    const chatTriggerBtn = page.locator('[data-testid="chat-trigger-btn"]');
    await expect(chatTriggerBtn).toBeVisible();
    await chatTriggerBtn.click();

    // 4. 챗봇 입력창에 고의 오타 "혁샌도시 쪽은 읎어?" 입력 후 전송
    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatSubmitBtn = page.locator('[data-testid="chat-submit-btn"]');
    await expect(chatInput).toBeVisible();

    await chatInput.fill('혁샌도시 쪽은 읎어?');
    await chatSubmitBtn.click();

    // 5. 챗봇 응답에 교정 메시지('충무공동(진주 혁신도시)')가 렌더링되는지 검증
    await expect(page.locator('text=충무공동(진주 혁신도시)')).toBeVisible({ timeout: 10000 });

    // 6. 부모 대시보드의 지역 드롭다운 UI가 '경상남도 진주시' (lawdCd: 48170)로 자동 스위칭되는지 검증
    await expect(selectSido).toHaveValue('경상남도', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('48170', { timeout: 10000 });

    // 7. 브라우저 URL 파라미터가 lawdCd=48170 으로 동적 갱신되는지 검증
    await expect.poll(() => page.url(), {
      message: '브라우저 URL 파라미터에 lawdCd=48170이 포함되어야 합니다',
      timeout: 10000
    }).toContain('lawdCd=48170');
  });

  test('랜드마크 \"남강축제 하는곳 집세가 궁금해\" 되묻기 후 확인 시 대시보드 드롭다운/URL이 진주시로 전역 스위칭되어야 한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="chat-trigger-btn"]').click();
    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatSubmitBtn = page.locator('[data-testid="chat-submit-btn"]');

    await chatInput.fill('남강축제 하는곳 집세가 궁금해');
    await chatSubmitBtn.click();
    await expect(page.locator('text=진주 남강유등축제가 열리는').first()).toBeVisible({ timeout: 10000 });

    await chatInput.fill('응 맞아');
    await chatSubmitBtn.click();

    await expect(selectSido).toHaveValue('경상남도', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('48170', { timeout: 10000 });
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('lawdCd=48170');

    // AI 검색 칩: 챗봇 창을 닫아도 최초 원본 질문이 메인 화면에 표시되어야 한다
    const chip = page.locator('[data-testid="ai-active-query-chip"]');
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText('AI 검색');
    await expect(chip).toContainText('남강축제 하는곳 집세가 궁금해');

    // 사용자가 드롭다운을 직접 변경하면 칩이 사라져야 한다
    await selectDistrict.selectOption('48220');
    await expect(chip).toHaveCount(0);
  });

  test('"진주시 월세 매물이 보고 싶어" 입력 시 B2B 제휴 매물 현황 탭으로 전환되고 월세 필터가 자동 적용되어야 한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });

    // 초기 상태: 실거래 원장 분석 탭 (B2B 제휴 매물 헤더가 보이지 않아야 함)
    await expect(page.locator('text=제휴 공인중개사 실시간 매물')).toHaveCount(0);

    await page.locator('[data-testid="chat-trigger-btn"]').click();
    await page.locator('[data-testid="chat-input"]').fill('진주시 월세 매물이 보고 싶어');
    await page.locator('[data-testid="chat-submit-btn"]').click();

    // 1) 지역 동기화
    await expect(selectSido).toHaveValue('경상남도', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('48170', { timeout: 10000 });

    // 2) 활성 탭이 B2B 제휴 매물 현황으로 강제 전환
    await expect(page.locator('text=제휴 공인중개사 실시간 매물').first()).toBeVisible({ timeout: 10000 });

    // 3) 거래 유형 필터가 월세로 자동 세팅 (활성 필터 버튼은 어두운 배경)
    await expect(page.locator('button.bg-\\[\\#191F28\\]', { hasText: '월세' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('사용자가 "김해시 원룸 매물이 보고싶어" 입력 시 GeminiChatModal에서 onDashboardSync가 호출되어 김해시(48250) 및 B2B 탭으로 강제 전환되어야 한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="chat-trigger-btn"]').click();
    await page.locator('[data-testid="chat-input"]').fill('김해시 원룸 매물이 보고싶어');
    await page.locator('[data-testid="chat-submit-btn"]').click();

    // 1) 지역 드롭다운 동기화 (경상남도 김해시)
    await expect(selectSido).toHaveValue('경상남도', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('48250', { timeout: 10000 });

    // 2) URL 파라미터 lawdCd=48250 갱신
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('lawdCd=48250');

    // 3) B2B 제휴 매물 현황 탭 전환 확인
    await expect(page.locator('text=제휴 공인중개사 실시간 매물').first()).toBeVisible({ timeout: 10000 });
  });

  test('플로팅 코파일럿(Floating Copilot): 배경 딤 없이 우측 하단에 고정 표시되고 최소화/토글이 가능해야 한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const chatTriggerBtn = page.locator('[data-testid="chat-trigger-btn"]');
    await expect(chatTriggerBtn).toBeVisible({ timeout: 15000 });

    // 1. 코파일럿 열기
    await chatTriggerBtn.click();

    // 2. 우측 하단 플로팅 위젯 렌더링 검증
    const copilotWidget = page.locator('[data-testid="ai-copilot-widget"]');
    await expect(copilotWidget).toBeVisible({ timeout: 10000 });

    // 3. 배경 딤(오버레이) 없음 확인: 뒤쪽 대시보드 셀렉터가 가려지지 않고 바로 확인 가능
    const selectSido = page.locator('[data-testid="select-sido"]');
    await expect(selectSido).toBeVisible();

    // 4. 최소화(-) 버튼 클릭 시 위젯이 닫히고 플로팅 액션 버튼(FAB)이 다시 표시되어야 함
    const minimizeBtn = page.locator('[data-testid="chat-minimize-btn"]');
    await expect(minimizeBtn).toBeVisible();
    await minimizeBtn.click();

    await expect(copilotWidget).toHaveCount(0);
    await expect(chatTriggerBtn).toBeVisible();

    // 5. 다시 열기 후 닫기(X) 버튼으로 닫힘 확인
    await chatTriggerBtn.click();
    await expect(copilotWidget).toBeVisible();
    const closeBtn = page.locator('[data-testid="chat-close-btn"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(copilotWidget).toHaveCount(0);
    await expect(chatTriggerBtn).toBeVisible();
  });

  test('사용자가 "진주 트레젠웰가 월세" 질의 시 지역(진주시 48170), 월세 필터 스위칭 및 검색창에 "트레젠웰가"가 자동 세팅되어 테이블이 실시간 필터링되어야 한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const selectSido = page.locator('[data-testid="select-sido"]');
    const selectDistrict = page.locator('[data-testid="select-district"]');
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(selectSido).toBeVisible({ timeout: 15000 });

    // 1. 코파일럿 열기
    await page.locator('[data-testid="chat-trigger-btn"]').click();
    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatSubmitBtn = page.locator('[data-testid="chat-submit-btn"]');

    // 2. "진주 트레젠웰가 월세" 질의 전송
    await chatInput.fill('진주 트레젠웰가 월세');
    await chatSubmitBtn.click();

    // 3. 지역 드롭다운 동기화 검증 (경상남도 진주시: 48170)
    await expect(selectSido).toHaveValue('경상남도', { timeout: 10000 });
    await expect(selectDistrict).toHaveValue('48170', { timeout: 10000 });
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('lawdCd=48170');

    // 4. 대시보드 상단 단지명/건물명 검색창에 '트레젠웰가'가 자동 입력되었는지 검증
    await expect(searchInput).toHaveValue('트레젠웰가', { timeout: 10000 });

    // 5. 하단 RAW DATA 테이블에 '트레젠웰가' 데이터만 남고 다른 단지('대방노블랜드')는 실시간 필터링되어 제외되었는지 검증
    await expect(page.locator('text=트레젠웰가').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=진주혁신도시대방노블랜드')).toHaveCount(0);
  });
});

