# -*- coding: utf-8 -*-
"""
대한민국 전국 17개 시·도 산하 252개 전수 시·군·구 법정동 코드(LAWD_CD 5자리) 레지스트리
국토교통부 실거래가 Open API 표준 준수 및 지능형 지역명-코드 양방향 매핑 모듈
"""

import re
from typing import Optional, Dict, Any, List

# 1. 대한민국 17개 시·도 252개 시·군·구 표준 법정동 5자리 코드 마스터 테이블
# 서울 강남구(11680) ~ 제주 서귀포시(50130)
LAWD_CD_MASTER_LIST = [
  {
    "code": "11680",
    "sido": "서울특별시",
    "name": "강남구",
    "full_name": "서울특별시 강남구"
  },
  {
    "code": "11650",
    "sido": "서울특별시",
    "name": "서초구",
    "full_name": "서울특별시 서초구"
  },
  {
    "code": "11710",
    "sido": "서울특별시",
    "name": "송파구",
    "full_name": "서울특별시 송파구"
  },
  {
    "code": "11170",
    "sido": "서울특별시",
    "name": "용산구",
    "full_name": "서울특별시 용산구"
  },
  {
    "code": "11200",
    "sido": "서울특별시",
    "name": "성동구",
    "full_name": "서울특별시 성동구"
  },
  {
    "code": "11440",
    "sido": "서울특별시",
    "name": "마포구",
    "full_name": "서울특별시 마포구"
  },
  {
    "code": "11560",
    "sido": "서울특별시",
    "name": "영등포구",
    "full_name": "서울특별시 영등포구"
  },
  {
    "code": "11740",
    "sido": "서울특별시",
    "name": "강동구",
    "full_name": "서울특별시 강동구"
  },
  {
    "code": "11470",
    "sido": "서울특별시",
    "name": "양천구",
    "full_name": "서울특별시 양천구"
  },
  {
    "code": "11350",
    "sido": "서울특별시",
    "name": "노원구",
    "full_name": "서울특별시 노원구"
  },
  {
    "code": "11110",
    "sido": "서울특별시",
    "name": "종로구",
    "full_name": "서울특별시 종로구"
  },
  {
    "code": "11140",
    "sido": "서울특별시",
    "name": "중구",
    "full_name": "서울특별시 중구"
  },
  {
    "code": "11230",
    "sido": "서울특별시",
    "name": "동대문구",
    "full_name": "서울특별시 동대문구"
  },
  {
    "code": "11290",
    "sido": "서울특별시",
    "name": "성북구",
    "full_name": "서울특별시 성북구"
  },
  {
    "code": "11410",
    "sido": "서울특별시",
    "name": "서대문구",
    "full_name": "서울특별시 서대문구"
  },
  {
    "code": "11590",
    "sido": "서울특별시",
    "name": "동작구",
    "full_name": "서울특별시 동작구"
  },
  {
    "code": "11620",
    "sido": "서울특별시",
    "name": "관악구",
    "full_name": "서울특별시 관악구"
  },
  {
    "code": "11215",
    "sido": "서울특별시",
    "name": "광진구",
    "full_name": "서울특별시 광진구"
  },
  {
    "code": "11380",
    "sido": "서울특별시",
    "name": "은평구",
    "full_name": "서울특별시 은평구"
  },
  {
    "code": "11305",
    "sido": "서울특별시",
    "name": "강북구",
    "full_name": "서울특별시 강북구"
  },
  {
    "code": "11320",
    "sido": "서울특별시",
    "name": "도봉구",
    "full_name": "서울특별시 도봉구"
  },
  {
    "code": "11260",
    "sido": "서울특별시",
    "name": "중랑구",
    "full_name": "서울특별시 중랑구"
  },
  {
    "code": "11530",
    "sido": "서울특별시",
    "name": "구로구",
    "full_name": "서울특별시 구로구"
  },
  {
    "code": "11545",
    "sido": "서울특별시",
    "name": "금천구",
    "full_name": "서울특별시 금천구"
  },
  {
    "code": "11500",
    "sido": "서울특별시",
    "name": "강서구",
    "full_name": "서울특별시 강서구"
  },
  {
    "code": "41111",
    "sido": "경기도",
    "name": "수원시 장안구",
    "full_name": "경기도 수원시 장안구"
  },
  {
    "code": "41113",
    "sido": "경기도",
    "name": "수원시 권선구",
    "full_name": "경기도 수원시 권선구"
  },
  {
    "code": "41115",
    "sido": "경기도",
    "name": "수원시 팔달구",
    "full_name": "경기도 수원시 팔달구"
  },
  {
    "code": "41117",
    "sido": "경기도",
    "name": "수원시 영통구",
    "full_name": "경기도 수원시 영통구"
  },
  {
    "code": "41131",
    "sido": "경기도",
    "name": "성남시 수정구",
    "full_name": "경기도 성남시 수정구"
  },
  {
    "code": "41133",
    "sido": "경기도",
    "name": "성남시 중원구",
    "full_name": "경기도 성남시 중원구"
  },
  {
    "code": "41135",
    "sido": "경기도",
    "name": "성남시 분당구",
    "full_name": "경기도 성남시 분당구"
  },
  {
    "code": "41150",
    "sido": "경기도",
    "name": "의정부시",
    "full_name": "경기도 의정부시"
  },
  {
    "code": "41171",
    "sido": "경기도",
    "name": "안양시 만안구",
    "full_name": "경기도 안양시 만안구"
  },
  {
    "code": "41173",
    "sido": "경기도",
    "name": "안양시 동안구",
    "full_name": "경기도 안양시 동안구"
  },
  {
    "code": "41192",
    "sido": "경기도",
    "name": "부천시 원미구",
    "full_name": "경기도 부천시 원미구"
  },
  {
    "code": "41194",
    "sido": "경기도",
    "name": "부천시 소사구",
    "full_name": "경기도 부천시 소사구"
  },
  {
    "code": "41196",
    "sido": "경기도",
    "name": "부천시 오정구",
    "full_name": "경기도 부천시 오정구"
  },
  {
    "code": "41210",
    "sido": "경기도",
    "name": "광명시",
    "full_name": "경기도 광명시"
  },
  {
    "code": "41220",
    "sido": "경기도",
    "name": "평택시",
    "full_name": "경기도 평택시"
  },
  {
    "code": "41250",
    "sido": "경기도",
    "name": "동두천시",
    "full_name": "경기도 동두천시"
  },
  {
    "code": "41271",
    "sido": "경기도",
    "name": "안산시 상록구",
    "full_name": "경기도 안산시 상록구"
  },
  {
    "code": "41273",
    "sido": "경기도",
    "name": "안산시 단원구",
    "full_name": "경기도 안산시 단원구"
  },
  {
    "code": "41281",
    "sido": "경기도",
    "name": "고양시 덕양구",
    "full_name": "경기도 고양시 덕양구"
  },
  {
    "code": "41285",
    "sido": "경기도",
    "name": "고양시 일산동구",
    "full_name": "경기도 고양시 일산동구"
  },
  {
    "code": "41287",
    "sido": "경기도",
    "name": "고양시 일산서구",
    "full_name": "경기도 고양시 일산서구"
  },
  {
    "code": "41290",
    "sido": "경기도",
    "name": "과천시",
    "full_name": "경기도 과천시"
  },
  {
    "code": "41310",
    "sido": "경기도",
    "name": "구리시",
    "full_name": "경기도 구리시"
  },
  {
    "code": "41360",
    "sido": "경기도",
    "name": "남양주시",
    "full_name": "경기도 남양주시"
  },
  {
    "code": "41370",
    "sido": "경기도",
    "name": "오산시",
    "full_name": "경기도 오산시"
  },
  {
    "code": "41390",
    "sido": "경기도",
    "name": "시흥시",
    "full_name": "경기도 시흥시"
  },
  {
    "code": "41410",
    "sido": "경기도",
    "name": "군포시",
    "full_name": "경기도 군포시"
  },
  {
    "code": "41430",
    "sido": "경기도",
    "name": "의왕시",
    "full_name": "경기도 의왕시"
  },
  {
    "code": "41450",
    "sido": "경기도",
    "name": "하남시",
    "full_name": "경기도 하남시"
  },
  {
    "code": "41461",
    "sido": "경기도",
    "name": "용인시 처인구",
    "full_name": "경기도 용인시 처인구"
  },
  {
    "code": "41463",
    "sido": "경기도",
    "name": "용인시 기흥구",
    "full_name": "경기도 용인시 기흥구"
  },
  {
    "code": "41465",
    "sido": "경기도",
    "name": "용인시 수지구",
    "full_name": "경기도 용인시 수지구"
  },
  {
    "code": "41480",
    "sido": "경기도",
    "name": "파주시",
    "full_name": "경기도 파주시"
  },
  {
    "code": "41500",
    "sido": "경기도",
    "name": "이천시",
    "full_name": "경기도 이천시"
  },
  {
    "code": "41550",
    "sido": "경기도",
    "name": "안성시",
    "full_name": "경기도 안성시"
  },
  {
    "code": "41570",
    "sido": "경기도",
    "name": "김포시",
    "full_name": "경기도 김포시"
  },
  {
    "code": "41590",
    "sido": "경기도",
    "name": "화성시",
    "full_name": "경기도 화성시"
  },
  {
    "code": "41610",
    "sido": "경기도",
    "name": "광주시",
    "full_name": "경기도 광주시"
  },
  {
    "code": "41630",
    "sido": "경기도",
    "name": "양주시",
    "full_name": "경기도 양주시"
  },
  {
    "code": "41650",
    "sido": "경기도",
    "name": "포천시",
    "full_name": "경기도 포천시"
  },
  {
    "code": "41670",
    "sido": "경기도",
    "name": "여주시",
    "full_name": "경기도 여주시"
  },
  {
    "code": "41800",
    "sido": "경기도",
    "name": "연천군",
    "full_name": "경기도 연천군"
  },
  {
    "code": "41820",
    "sido": "경기도",
    "name": "가평군",
    "full_name": "경기도 가평군"
  },
  {
    "code": "41830",
    "sido": "경기도",
    "name": "양평군",
    "full_name": "경기도 양평군"
  },
  {
    "code": "28110",
    "sido": "인천광역시",
    "name": "중구",
    "full_name": "인천광역시 중구"
  },
  {
    "code": "28140",
    "sido": "인천광역시",
    "name": "동구",
    "full_name": "인천광역시 동구"
  },
  {
    "code": "28177",
    "sido": "인천광역시",
    "name": "미추홀구",
    "full_name": "인천광역시 미추홀구"
  },
  {
    "code": "28185",
    "sido": "인천광역시",
    "name": "연수구",
    "full_name": "인천광역시 연수구"
  },
  {
    "code": "28200",
    "sido": "인천광역시",
    "name": "남동구",
    "full_name": "인천광역시 남동구"
  },
  {
    "code": "28237",
    "sido": "인천광역시",
    "name": "부평구",
    "full_name": "인천광역시 부평구"
  },
  {
    "code": "28245",
    "sido": "인천광역시",
    "name": "계양구",
    "full_name": "인천광역시 계양구"
  },
  {
    "code": "28260",
    "sido": "인천광역시",
    "name": "서구",
    "full_name": "인천광역시 서구"
  },
  {
    "code": "28710",
    "sido": "인천광역시",
    "name": "강화군",
    "full_name": "인천광역시 강화군"
  },
  {
    "code": "28720",
    "sido": "인천광역시",
    "name": "옹진군",
    "full_name": "인천광역시 옹진군"
  },
  {
    "code": "26110",
    "sido": "부산광역시",
    "name": "중구",
    "full_name": "부산광역시 중구"
  },
  {
    "code": "26140",
    "sido": "부산광역시",
    "name": "서구",
    "full_name": "부산광역시 서구"
  },
  {
    "code": "26170",
    "sido": "부산광역시",
    "name": "동구",
    "full_name": "부산광역시 동구"
  },
  {
    "code": "26200",
    "sido": "부산광역시",
    "name": "영도구",
    "full_name": "부산광역시 영도구"
  },
  {
    "code": "26230",
    "sido": "부산광역시",
    "name": "부산진구",
    "full_name": "부산광역시 부산진구"
  },
  {
    "code": "26260",
    "sido": "부산광역시",
    "name": "동래구",
    "full_name": "부산광역시 동래구"
  },
  {
    "code": "26290",
    "sido": "부산광역시",
    "name": "남구",
    "full_name": "부산광역시 남구"
  },
  {
    "code": "26320",
    "sido": "부산광역시",
    "name": "북구",
    "full_name": "부산광역시 북구"
  },
  {
    "code": "26350",
    "sido": "부산광역시",
    "name": "해운대구",
    "full_name": "부산광역시 해운대구"
  },
  {
    "code": "26380",
    "sido": "부산광역시",
    "name": "사하구",
    "full_name": "부산광역시 사하구"
  },
  {
    "code": "26410",
    "sido": "부산광역시",
    "name": "금정구",
    "full_name": "부산광역시 금정구"
  },
  {
    "code": "26440",
    "sido": "부산광역시",
    "name": "강서구",
    "full_name": "부산광역시 강서구"
  },
  {
    "code": "26470",
    "sido": "부산광역시",
    "name": "연제구",
    "full_name": "부산광역시 연제구"
  },
  {
    "code": "26500",
    "sido": "부산광역시",
    "name": "수영구",
    "full_name": "부산광역시 수영구"
  },
  {
    "code": "26530",
    "sido": "부산광역시",
    "name": "사상구",
    "full_name": "부산광역시 사상구"
  },
  {
    "code": "26710",
    "sido": "부산광역시",
    "name": "기장군",
    "full_name": "부산광역시 기장군"
  },
  {
    "code": "27110",
    "sido": "대구광역시",
    "name": "중구",
    "full_name": "대구광역시 중구"
  },
  {
    "code": "27140",
    "sido": "대구광역시",
    "name": "동구",
    "full_name": "대구광역시 동구"
  },
  {
    "code": "27170",
    "sido": "대구광역시",
    "name": "서구",
    "full_name": "대구광역시 서구"
  },
  {
    "code": "27200",
    "sido": "대구광역시",
    "name": "남구",
    "full_name": "대구광역시 남구"
  },
  {
    "code": "27230",
    "sido": "대구광역시",
    "name": "북구",
    "full_name": "대구광역시 북구"
  },
  {
    "code": "27260",
    "sido": "대구광역시",
    "name": "수성구",
    "full_name": "대구광역시 수성구"
  },
  {
    "code": "27290",
    "sido": "대구광역시",
    "name": "달서구",
    "full_name": "대구광역시 달서구"
  },
  {
    "code": "27710",
    "sido": "대구광역시",
    "name": "달성군",
    "full_name": "대구광역시 달성군"
  },
  {
    "code": "27720",
    "sido": "대구광역시",
    "name": "군위군",
    "full_name": "대구광역시 군위군"
  },
  {
    "code": "29110",
    "sido": "광주광역시",
    "name": "동구",
    "full_name": "광주광역시 동구"
  },
  {
    "code": "29140",
    "sido": "광주광역시",
    "name": "서구",
    "full_name": "광주광역시 서구"
  },
  {
    "code": "29155",
    "sido": "광주광역시",
    "name": "남구",
    "full_name": "광주광역시 남구"
  },
  {
    "code": "29170",
    "sido": "광주광역시",
    "name": "북구",
    "full_name": "광주광역시 북구"
  },
  {
    "code": "29200",
    "sido": "광주광역시",
    "name": "광산구",
    "full_name": "광주광역시 광산구"
  },
  {
    "code": "30110",
    "sido": "대전광역시",
    "name": "동구",
    "full_name": "대전광역시 동구"
  },
  {
    "code": "30140",
    "sido": "대전광역시",
    "name": "중구",
    "full_name": "대전광역시 중구"
  },
  {
    "code": "30170",
    "sido": "대전광역시",
    "name": "서구",
    "full_name": "대전광역시 서구"
  },
  {
    "code": "30200",
    "sido": "대전광역시",
    "name": "유성구",
    "full_name": "대전광역시 유성구"
  },
  {
    "code": "30230",
    "sido": "대전광역시",
    "name": "대덕구",
    "full_name": "대전광역시 대덕구"
  },
  {
    "code": "31110",
    "sido": "울산광역시",
    "name": "중구",
    "full_name": "울산광역시 중구"
  },
  {
    "code": "31140",
    "sido": "울산광역시",
    "name": "남구",
    "full_name": "울산광역시 남구"
  },
  {
    "code": "31170",
    "sido": "울산광역시",
    "name": "동구",
    "full_name": "울산광역시 동구"
  },
  {
    "code": "31200",
    "sido": "울산광역시",
    "name": "북구",
    "full_name": "울산광역시 북구"
  },
  {
    "code": "31710",
    "sido": "울산광역시",
    "name": "울주군",
    "full_name": "울산광역시 울주군"
  },
  {
    "code": "36110",
    "sido": "세종특별자치시",
    "name": "세종특별자치시",
    "full_name": "세종특별자치시 세종특별자치시"
  },
  {
    "code": "42110",
    "sido": "강원특별자치도",
    "name": "춘천시",
    "full_name": "강원특별자치도 춘천시"
  },
  {
    "code": "42130",
    "sido": "강원특별자치도",
    "name": "원주시",
    "full_name": "강원특별자치도 원주시"
  },
  {
    "code": "42150",
    "sido": "강원특별자치도",
    "name": "강릉시",
    "full_name": "강원특별자치도 강릉시"
  },
  {
    "code": "42170",
    "sido": "강원특별자치도",
    "name": "동해시",
    "full_name": "강원특별자치도 동해시"
  },
  {
    "code": "42190",
    "sido": "강원특별자치도",
    "name": "태백시",
    "full_name": "강원특별자치도 태백시"
  },
  {
    "code": "42210",
    "sido": "강원특별자치도",
    "name": "속초시",
    "full_name": "강원특별자치도 속초시"
  },
  {
    "code": "42230",
    "sido": "강원특별자치도",
    "name": "삼척시",
    "full_name": "강원특별자치도 삼척시"
  },
  {
    "code": "42720",
    "sido": "강원특별자치도",
    "name": "홍천군",
    "full_name": "강원특별자치도 홍천군"
  },
  {
    "code": "42730",
    "sido": "강원특별자치도",
    "name": "횡성군",
    "full_name": "강원특별자치도 횡성군"
  },
  {
    "code": "42750",
    "sido": "강원특별자치도",
    "name": "영월군",
    "full_name": "강원특별자치도 영월군"
  },
  {
    "code": "42760",
    "sido": "강원특별자치도",
    "name": "평창군",
    "full_name": "강원특별자치도 평창군"
  },
  {
    "code": "42770",
    "sido": "강원특별자치도",
    "name": "정선군",
    "full_name": "강원특별자치도 정선군"
  },
  {
    "code": "42780",
    "sido": "강원특별자치도",
    "name": "철원군",
    "full_name": "강원특별자치도 철원군"
  },
  {
    "code": "42790",
    "sido": "강원특별자치도",
    "name": "화천군",
    "full_name": "강원특별자치도 화천군"
  },
  {
    "code": "42800",
    "sido": "강원특별자치도",
    "name": "양구군",
    "full_name": "강원특별자치도 양구군"
  },
  {
    "code": "42810",
    "sido": "강원특별자치도",
    "name": "인제군",
    "full_name": "강원특별자치도 인제군"
  },
  {
    "code": "42820",
    "sido": "강원특별자치도",
    "name": "고성군",
    "full_name": "강원특별자치도 고성군"
  },
  {
    "code": "42830",
    "sido": "강원특별자치도",
    "name": "양양군",
    "full_name": "강원특별자치도 양양군"
  },
  {
    "code": "43111",
    "sido": "충청북도",
    "name": "청주시 상당구",
    "full_name": "충청북도 청주시 상당구"
  },
  {
    "code": "43112",
    "sido": "충청북도",
    "name": "청주시 서원구",
    "full_name": "충청북도 청주시 서원구"
  },
  {
    "code": "43113",
    "sido": "충청북도",
    "name": "청주시 흥덕구",
    "full_name": "충청북도 청주시 흥덕구"
  },
  {
    "code": "43114",
    "sido": "충청북도",
    "name": "청주시 청원구",
    "full_name": "충청북도 청주시 청원구"
  },
  {
    "code": "43130",
    "sido": "충청북도",
    "name": "충주시",
    "full_name": "충청북도 충주시"
  },
  {
    "code": "43150",
    "sido": "충청북도",
    "name": "제천시",
    "full_name": "충청북도 제천시"
  },
  {
    "code": "43720",
    "sido": "충청북도",
    "name": "보은군",
    "full_name": "충청북도 보은군"
  },
  {
    "code": "43730",
    "sido": "충청북도",
    "name": "옥천군",
    "full_name": "충청북도 옥천군"
  },
  {
    "code": "43740",
    "sido": "충청북도",
    "name": "영동군",
    "full_name": "충청북도 영동군"
  },
  {
    "code": "43745",
    "sido": "충청북도",
    "name": "증평군",
    "full_name": "충청북도 증평군"
  },
  {
    "code": "43750",
    "sido": "충청북도",
    "name": "진천군",
    "full_name": "충청북도 진천군"
  },
  {
    "code": "43760",
    "sido": "충청북도",
    "name": "괴산군",
    "full_name": "충청북도 괴산군"
  },
  {
    "code": "43770",
    "sido": "충청북도",
    "name": "음성군",
    "full_name": "충청북도 음성군"
  },
  {
    "code": "43800",
    "sido": "충청북도",
    "name": "단양군",
    "full_name": "충청북도 단양군"
  },
  {
    "code": "44131",
    "sido": "충청남도",
    "name": "천안시 동남구",
    "full_name": "충청남도 천안시 동남구"
  },
  {
    "code": "44133",
    "sido": "충청남도",
    "name": "천안시 서북구",
    "full_name": "충청남도 천안시 서북구"
  },
  {
    "code": "44150",
    "sido": "충청남도",
    "name": "공주시",
    "full_name": "충청남도 공주시"
  },
  {
    "code": "44180",
    "sido": "충청남도",
    "name": "보령시",
    "full_name": "충청남도 보령시"
  },
  {
    "code": "44200",
    "sido": "충청남도",
    "name": "아산시",
    "full_name": "충청남도 아산시"
  },
  {
    "code": "44210",
    "sido": "충청남도",
    "name": "서산시",
    "full_name": "충청남도 서산시"
  },
  {
    "code": "44230",
    "sido": "충청남도",
    "name": "논산시",
    "full_name": "충청남도 논산시"
  },
  {
    "code": "44250",
    "sido": "충청남도",
    "name": "계룡시",
    "full_name": "충청남도 계룡시"
  },
  {
    "code": "44270",
    "sido": "충청남도",
    "name": "당진시",
    "full_name": "충청남도 당진시"
  },
  {
    "code": "44710",
    "sido": "충청남도",
    "name": "금산군",
    "full_name": "충청남도 금산군"
  },
  {
    "code": "44760",
    "sido": "충청남도",
    "name": "부여군",
    "full_name": "충청남도 부여군"
  },
  {
    "code": "44770",
    "sido": "충청남도",
    "name": "서천군",
    "full_name": "충청남도 서천군"
  },
  {
    "code": "44790",
    "sido": "충청남도",
    "name": "청양군",
    "full_name": "충청남도 청양군"
  },
  {
    "code": "44800",
    "sido": "충청남도",
    "name": "홍성군",
    "full_name": "충청남도 홍성군"
  },
  {
    "code": "44810",
    "sido": "충청남도",
    "name": "예산군",
    "full_name": "충청남도 예산군"
  },
  {
    "code": "44825",
    "sido": "충청남도",
    "name": "태안군",
    "full_name": "충청남도 태안군"
  },
  {
    "code": "45111",
    "sido": "전북특별자치도",
    "name": "전주시 완산구",
    "full_name": "전북특별자치도 전주시 완산구"
  },
  {
    "code": "45113",
    "sido": "전북특별자치도",
    "name": "전주시 덕진구",
    "full_name": "전북특별자치도 전주시 덕진구"
  },
  {
    "code": "45130",
    "sido": "전북특별자치도",
    "name": "군산시",
    "full_name": "전북특별자치도 군산시"
  },
  {
    "code": "45140",
    "sido": "전북특별자치도",
    "name": "익산시",
    "full_name": "전북특별자치도 익산시"
  },
  {
    "code": "45180",
    "sido": "전북특별자치도",
    "name": "정읍시",
    "full_name": "전북특별자치도 정읍시"
  },
  {
    "code": "45190",
    "sido": "전북특별자치도",
    "name": "남원시",
    "full_name": "전북특별자치도 남원시"
  },
  {
    "code": "45210",
    "sido": "전북특별자치도",
    "name": "김제시",
    "full_name": "전북특별자치도 김제시"
  },
  {
    "code": "45710",
    "sido": "전북특별자치도",
    "name": "완주군",
    "full_name": "전북특별자치도 완주군"
  },
  {
    "code": "45720",
    "sido": "전북특별자치도",
    "name": "진안군",
    "full_name": "전북특별자치도 진안군"
  },
  {
    "code": "45730",
    "sido": "전북특별자치도",
    "name": "무주군",
    "full_name": "전북특별자치도 무주군"
  },
  {
    "code": "45740",
    "sido": "전북특별자치도",
    "name": "장수군",
    "full_name": "전북특별자치도 장수군"
  },
  {
    "code": "45750",
    "sido": "전북특별자치도",
    "name": "임실군",
    "full_name": "전북특별자치도 임실군"
  },
  {
    "code": "45770",
    "sido": "전북특별자치도",
    "name": "순창군",
    "full_name": "전북특별자치도 순창군"
  },
  {
    "code": "45790",
    "sido": "전북특별자치도",
    "name": "고창군",
    "full_name": "전북특별자치도 고창군"
  },
  {
    "code": "45800",
    "sido": "전북특별자치도",
    "name": "부안군",
    "full_name": "전북특별자치도 부안군"
  },
  {
    "code": "46110",
    "sido": "전라남도",
    "name": "목포시",
    "full_name": "전라남도 목포시"
  },
  {
    "code": "46130",
    "sido": "전라남도",
    "name": "여수시",
    "full_name": "전라남도 여수시"
  },
  {
    "code": "46150",
    "sido": "전라남도",
    "name": "순천시",
    "full_name": "전라남도 순천시"
  },
  {
    "code": "46170",
    "sido": "전라남도",
    "name": "나주시",
    "full_name": "전라남도 나주시"
  },
  {
    "code": "46230",
    "sido": "전라남도",
    "name": "광양시",
    "full_name": "전라남도 광양시"
  },
  {
    "code": "46710",
    "sido": "전라남도",
    "name": "담양군",
    "full_name": "전라남도 담양군"
  },
  {
    "code": "46720",
    "sido": "전라남도",
    "name": "곡성군",
    "full_name": "전라남도 곡성군"
  },
  {
    "code": "46730",
    "sido": "전라남도",
    "name": "구례군",
    "full_name": "전라남도 구례군"
  },
  {
    "code": "46770",
    "sido": "전라남도",
    "name": "고흥군",
    "full_name": "전라남도 고흥군"
  },
  {
    "code": "46780",
    "sido": "전라남도",
    "name": "보성군",
    "full_name": "전라남도 보성군"
  },
  {
    "code": "46790",
    "sido": "전라남도",
    "name": "화순군",
    "full_name": "전라남도 화순군"
  },
  {
    "code": "46800",
    "sido": "전라남도",
    "name": "장흥군",
    "full_name": "전라남도 장흥군"
  },
  {
    "code": "46810",
    "sido": "전라남도",
    "name": "강진군",
    "full_name": "전라남도 강진군"
  },
  {
    "code": "46820",
    "sido": "전라남도",
    "name": "해남군",
    "full_name": "전라남도 해남군"
  },
  {
    "code": "46830",
    "sido": "전라남도",
    "name": "영암군",
    "full_name": "전라남도 영암군"
  },
  {
    "code": "46840",
    "sido": "전라남도",
    "name": "무안군",
    "full_name": "전라남도 무안군"
  },
  {
    "code": "46860",
    "sido": "전라남도",
    "name": "함평군",
    "full_name": "전라남도 함평군"
  },
  {
    "code": "46870",
    "sido": "전라남도",
    "name": "영광군",
    "full_name": "전라남도 영광군"
  },
  {
    "code": "46880",
    "sido": "전라남도",
    "name": "장성군",
    "full_name": "전라남도 장성군"
  },
  {
    "code": "46890",
    "sido": "전라남도",
    "name": "완도군",
    "full_name": "전라남도 완도군"
  },
  {
    "code": "46900",
    "sido": "전라남도",
    "name": "진도군",
    "full_name": "전라남도 진도군"
  },
  {
    "code": "46910",
    "sido": "전라남도",
    "name": "신안군",
    "full_name": "전라남도 신안군"
  },
  {
    "code": "47111",
    "sido": "경상북도",
    "name": "포항시 남구",
    "full_name": "경상북도 포항시 남구"
  },
  {
    "code": "47113",
    "sido": "경상북도",
    "name": "포항시 북구",
    "full_name": "경상북도 포항시 북구"
  },
  {
    "code": "47130",
    "sido": "경상북도",
    "name": "경주시",
    "full_name": "경상북도 경주시"
  },
  {
    "code": "47150",
    "sido": "경상북도",
    "name": "김천시",
    "full_name": "경상북도 김천시"
  },
  {
    "code": "47170",
    "sido": "경상북도",
    "name": "안동시",
    "full_name": "경상북도 안동시"
  },
  {
    "code": "47190",
    "sido": "경상북도",
    "name": "구미시",
    "full_name": "경상북도 구미시"
  },
  {
    "code": "47210",
    "sido": "경상북도",
    "name": "영주시",
    "full_name": "경상북도 영주시"
  },
  {
    "code": "47230",
    "sido": "경상북도",
    "name": "영천시",
    "full_name": "경상북도 영천시"
  },
  {
    "code": "47250",
    "sido": "경상북도",
    "name": "상주시",
    "full_name": "경상북도 상주시"
  },
  {
    "code": "47280",
    "sido": "경상북도",
    "name": "문경시",
    "full_name": "경상북도 문경시"
  },
  {
    "code": "47290",
    "sido": "경상북도",
    "name": "경산시",
    "full_name": "경상북도 경산시"
  },
  {
    "code": "47730",
    "sido": "경상북도",
    "name": "의성군",
    "full_name": "경상북도 의성군"
  },
  {
    "code": "47750",
    "sido": "경상북도",
    "name": "청송군",
    "full_name": "경상북도 청송군"
  },
  {
    "code": "47760",
    "sido": "경상북도",
    "name": "영양군",
    "full_name": "경상북도 영양군"
  },
  {
    "code": "47770",
    "sido": "경상북도",
    "name": "영덕군",
    "full_name": "경상북도 영덕군"
  },
  {
    "code": "47820",
    "sido": "경상북도",
    "name": "청도군",
    "full_name": "경상북도 청도군"
  },
  {
    "code": "47830",
    "sido": "경상북도",
    "name": "고령군",
    "full_name": "경상북도 고령군"
  },
  {
    "code": "47840",
    "sido": "경상북도",
    "name": "성주군",
    "full_name": "경상북도 성주군"
  },
  {
    "code": "47850",
    "sido": "경상북도",
    "name": "칠곡군",
    "full_name": "경상북도 칠곡군"
  },
  {
    "code": "47900",
    "sido": "경상북도",
    "name": "예천군",
    "full_name": "경상북도 예천군"
  },
  {
    "code": "47920",
    "sido": "경상북도",
    "name": "봉화군",
    "full_name": "경상북도 봉화군"
  },
  {
    "code": "47930",
    "sido": "경상북도",
    "name": "울진군",
    "full_name": "경상북도 울진군"
  },
  {
    "code": "47940",
    "sido": "경상북도",
    "name": "울릉군",
    "full_name": "경상북도 울릉군"
  },
  {
    "code": "48121",
    "sido": "경상남도",
    "name": "창원시 의창구",
    "full_name": "경상남도 창원시 의창구"
  },
  {
    "code": "48123",
    "sido": "경상남도",
    "name": "창원시 성산구",
    "full_name": "경상남도 창원시 성산구"
  },
  {
    "code": "48125",
    "sido": "경상남도",
    "name": "창원시 마산합포구",
    "full_name": "경상남도 창원시 마산합포구"
  },
  {
    "code": "48127",
    "sido": "경상남도",
    "name": "창원시 마산회원구",
    "full_name": "경상남도 창원시 마산회원구"
  },
  {
    "code": "48129",
    "sido": "경상남도",
    "name": "창원시 진해구",
    "full_name": "경상남도 창원시 진해구"
  },
  {
    "code": "48170",
    "sido": "경상남도",
    "name": "진주시",
    "full_name": "경상남도 진주시"
  },
  {
    "code": "48220",
    "sido": "경상남도",
    "name": "통영시",
    "full_name": "경상남도 통영시"
  },
  {
    "code": "48240",
    "sido": "경상남도",
    "name": "사천시",
    "full_name": "경상남도 사천시"
  },
  {
    "code": "48250",
    "sido": "경상남도",
    "name": "김해시",
    "full_name": "경상남도 김해시"
  },
  {
    "code": "48270",
    "sido": "경상남도",
    "name": "밀양시",
    "full_name": "경상남도 밀양시"
  },
  {
    "code": "48310",
    "sido": "경상남도",
    "name": "거제시",
    "full_name": "경상남도 거제시"
  },
  {
    "code": "48330",
    "sido": "경상남도",
    "name": "양산시",
    "full_name": "경상남도 양산시"
  },
  {
    "code": "48720",
    "sido": "경상남도",
    "name": "의령군",
    "full_name": "경상남도 의령군"
  },
  {
    "code": "48730",
    "sido": "경상남도",
    "name": "함안군",
    "full_name": "경상남도 함안군"
  },
  {
    "code": "48740",
    "sido": "경상남도",
    "name": "창녕군",
    "full_name": "경상남도 창녕군"
  },
  {
    "code": "48820",
    "sido": "경상남도",
    "name": "고성군",
    "full_name": "경상남도 고성군"
  },
  {
    "code": "48840",
    "sido": "경상남도",
    "name": "남해군",
    "full_name": "경상남도 남해군"
  },
  {
    "code": "48850",
    "sido": "경상남도",
    "name": "하동군",
    "full_name": "경상남도 하동군"
  },
  {
    "code": "48860",
    "sido": "경상남도",
    "name": "산청군",
    "full_name": "경상남도 산청군"
  },
  {
    "code": "48870",
    "sido": "경상남도",
    "name": "함양군",
    "full_name": "경상남도 함양군"
  },
  {
    "code": "48880",
    "sido": "경상남도",
    "name": "거창군",
    "full_name": "경상남도 거창군"
  },
  {
    "code": "48890",
    "sido": "경상남도",
    "name": "합천군",
    "full_name": "경상남도 합천군"
  },
  {
    "code": "50110",
    "sido": "제주특별자치도",
    "name": "제주시",
    "full_name": "제주특별자치도 제주시"
  },
  {
    "code": "50130",
    "sido": "제주특별자치도",
    "name": "서귀포시",
    "full_name": "제주특별자치도 서귀포시"
  }
]

# 2. 5자리 코드 -> 표준 명칭 딕셔너리
LAWD_CD_TO_NAME: Dict[str, str] = {
    item["code"]: item["full_name"] for item in LAWD_CD_MASTER_LIST
}

# 3. 유효한 5자리 법정동 코드 집합 (O(1) 검증)
VALID_LAWD_CODES = set(LAWD_CD_TO_NAME.keys())

# 4. 통합시/특례시 전체 코드 (0으로 끝남) -> 대표 구 매핑 테이블
# 국토부 API는 시 전체 코드로 조회 시 0건을 반환하므로 대표 자치구로 자동 연결
INTEGRATED_CITY_CODE_MAPPING: Dict[str, str] = {
    "48120": "48121",  # 경남 창원시 전체 -> 의창구
    "41110": "41111",  # 경기 수원시 전체 -> 장안구
    "41130": "41135",  # 경기 성남시 전체 -> 분당구
    "41170": "41173",  # 경기 안양시 전체 -> 동안구
    "41190": "41192",  # 경기 부천시 전체 -> 원미구
    "41270": "41271",  # 경기 안산시 전체 -> 상록구
    "41280": "41285",  # 경기 고양시 전체 -> 일산동구
    "41460": "41465",  # 경기 용인시 전체 -> 수지구
    "43110": "43111",  # 충북 청주시 전체 -> 상당구
    "44130": "44133",  # 충남 천안시 전체 -> 서북구
    "45110": "45111",  # 전북 전주시 전체 -> 완산구
    "47110": "47111"   # 경북 포항시 전체 -> 남구
}

# 5. 광역시/도 별칭 매핑
SIDO_SHORT_ALIASES = {
    "서울특별시": ["서울", "서울시"],
    "경기도": ["경기"],
    "인천광역시": ["인천", "인천시"],
    "부산광역시": ["부산", "부산시"],
    "대구광역시": ["대구", "대구시"],
    "광주광역시": ["광주", "광주시"],
    "대전광역시": ["대전", "대전시"],
    "울산광역시": ["울산", "울산시"],
    "세종특별자치시": ["세종", "세종시"],
    "강원특별자치도": ["강원", "강원도"],
    "충청북도": ["충북"],
    "충청남도": ["충남"],
    "전북특별자치도": ["전북", "전라북도"],
    "전라남도": ["전남"],
    "경상북도": ["경북"],
    "경상남도": ["경남"],
    "제주특별자치도": ["제주", "제주도"]
}

def _clean_str(text: str) -> str:
    """공백 및 특수문자 제거 정규화"""
    if not text:
        return ""
    return re.sub(r"[\s\-_/(),]+", "", str(text)).strip().lower()

# 6. 정규화된 텍스트 -> 5자리 LAWD_CD 역색인 딕셔너리 구축
NORMALIZED_NAME_TO_CODE: Dict[str, str] = {}

for item in LAWD_CD_MASTER_LIST:
    code = item["code"]
    sido = item["sido"]
    name = item["name"]  # 예: "창원시 의창구" 또는 "강남구"
    full_name = item["full_name"]  # 예: "경상남도 창원시 의창구"

    # (1) 전체 표준 풀네임
    NORMALIZED_NAME_TO_CODE[_clean_str(full_name)] = code
    # (2) 시도 제외 시/군/구명
    NORMALIZED_NAME_TO_CODE[_clean_str(name)] = code
    # (3) 구 단위만 있는 경우 (예: "수원시 장안구" -> "장안구", "창원시 성산구" -> "성산구")
    if " " in name:
        parts = name.split(" ")
        city_part = parts[0]
        sub_district = parts[-1]
        NORMALIZED_NAME_TO_CODE[_clean_str(sub_district)] = code
        # 시+구 붙여쓴 형태 (예: "창원시성산구")
        NORMALIZED_NAME_TO_CODE[_clean_str("".join(parts))] = code
        
        # '시'/'구' 생략 및 변형 형태 자동 등록 (예: "창원성산", "창원성산구", "성산")
        city_short = city_part.rstrip("시")
        sub_short = sub_district.rstrip("구")
        NORMALIZED_NAME_TO_CODE[_clean_str(f"{city_short}{sub_district}")] = code
        NORMALIZED_NAME_TO_CODE[_clean_str(f"{city_short}{sub_short}")] = code
        NORMALIZED_NAME_TO_CODE[_clean_str(sub_short)] = code

    # (4) 시도 약칭 조합 (예: "경남 창원시 의창구", "경남의창구", "서울강남구")
    aliases = SIDO_SHORT_ALIASES.get(sido, [])
    for alias in aliases:
        NORMALIZED_NAME_TO_CODE[_clean_str(f"{alias}{name}")] = code
        if " " in name:
            NORMALIZED_NAME_TO_CODE[_clean_str(f"{alias}{name.split()[-1]}")] = code

# 통합시 대표 명칭 매핑
INTEGRATED_CITY_NAME_MAPPINGS = {
    "창원시": "48121", "창원": "48121", "경남창원시": "48121", "경상남도창원시": "48121",
    "수원시": "41111", "수원": "41111", "경기수원시": "41111",
    "성남시": "41135", "성남": "41135", "경기성남시": "41135",
    "안양시": "41173", "안양": "41173", "경기안양시": "41173",
    "부천시": "41192", "부천": "41192", "경기부천시": "41192",
    "안산시": "41271", "안산": "41271", "경기안산시": "41271",
    "고양시": "41285", "고양": "41285", "기고양시": "41285",
    "용인시": "41465", "용인": "41465", "경기용인시": "41465",
    "청주시": "43111", "청주": "43111", "충북청주시": "43111",
    "천안시": "44133", "천안": "44133", "충남천안시": "44133",
    "전주시": "45111", "전주": "45111", "전북전주시": "45111",
    "포항시": "47111", "포항": "47111", "경북포항시": "47111",
}
for k, v in INTEGRATED_CITY_NAME_MAPPINGS.items():
    NORMALIZED_NAME_TO_CODE[_clean_str(k)] = v


# ==================== 핵심 식별 및 검증 함수 ====================

def resolve_lawd_cd(input_val: Optional[str]) -> Optional[str]:
    """
    프론트엔드 또는 API 호출자로부터 전달받은 지역 코드/지역명 문자열을
    국토교통부 표준 5자리 법정동 코드(LAWD_CD)로 정규화 및 매핑합니다.

    매핑 성공 시: '11680' 등 5자리 문자열 반환
    매핑 실패 시: 백엔드 콘솔에 [Mapping Error] 정확한 로그 출력 후 None 반환
    """
    if input_val is None:
        print('[Mapping Error] 요청된 지역명: "None"을(를) 찾을 수 없습니다.')
        return None

    raw_str = str(input_val).strip()
    if not raw_str:
        print('[Mapping Error] 요청된 지역명: ""을(를) 찾을 수 없습니다.')
        return None

    # 케이스 1: 5자리 숫자가 직접 들어온 경우
    if re.fullmatch(r"\d{5}", raw_str):
        # 1-1. 이미 유효한 전국 252개 표준 코드인 경우
        if raw_str in VALID_LAWD_CODES:
            return raw_str

        # 1-2. 통합시 0번 코드인 경우 자동 변환
        if raw_str in INTEGRATED_CITY_CODE_MAPPING:
            target = INTEGRATED_CITY_CODE_MAPPING[raw_str]
            return target

        # 1-3. 5자리 숫자이지만 국토부 코드 테이블에 없는 경우
        print(f'[Mapping Error] 요청된 지역명: "{raw_str}"을(를) 찾을 수 없습니다.')
        return None

    # 케이스 2: 한글 지역명 또는 복합 문자열인 경우 (띄어쓰기 무관 정규화)
    cleaned = _clean_str(raw_str)

    # 2-1. 정규화 사전 완전 일치 검색
    if cleaned in NORMALIZED_NAME_TO_CODE:
        return NORMALIZED_NAME_TO_CODE[cleaned]

    # 2-2. 부분 포함 검색 (예: "창원시 의창구 봉곡동" 등 읍면동이 붙어온 경우)
    for norm_name, code in NORMALIZED_NAME_TO_CODE.items():
        if len(norm_name) >= 3 and (norm_name in cleaned or cleaned in norm_name):
            return code

    # 2-3. 최종 실패 시 필수 로그 출력
    print(f'[Mapping Error] 요청된 지역명: "{raw_str}"을(를) 찾을 수 없습니다.')
    return None


def get_region_name(lawd_cd: str) -> str:
    """5자리 법정동 코드로부터 표준 지역명 반환 (예: '경상남도 창원시 의창구')"""
    return LAWD_CD_TO_NAME.get(str(lawd_cd).strip(), f"지역 ({lawd_cd})")


# ==================== 7. 전국 주요 동음이의어(중복) 법정동 레지스트리 ====================
# 전국 2개 이상의 서로 다른 시/군/구에 존재하는 대표적인 법정동 목록
HOMONYM_DONG_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    "가좌동": [
        {"index": 1, "label": "경상남도 진주시 가좌동", "code": "48170", "dong": "가좌동"},
        {"index": 2, "label": "인천광역시 서구 가좌동", "code": "28260", "dong": "가좌동"},
        {"index": 3, "label": "경기도 고양시 일산서구 가좌동", "code": "41287", "dong": "가좌동"}
    ],
    "신월동": [
        {"index": 1, "label": "서울특별시 양천구 신월동", "code": "11470", "dong": "신월동"},
        {"index": 2, "label": "경상남도 창원시 의창구 신월동", "code": "48121", "dong": "신월동"}
    ],
    "중앙동": [
        {"index": 1, "label": "부산광역시 중구 중앙동", "code": "26110", "dong": "중앙동"},
        {"index": 2, "label": "경상남도 창원시 성산구 중앙동", "code": "48123", "dong": "중앙동"},
        {"index": 3, "label": "경기도 안산시 단원구 중앙동", "code": "41273", "dong": "중앙동"},
        {"index": 4, "label": "강원특별자치도 원주시 중앙동", "code": "42130", "dong": "중앙동"}
    ],
    "상남동": [
        {"index": 1, "label": "경상남도 창원시 성산구 상남동", "code": "48123", "dong": "상남동"},
        {"index": 2, "label": "경상남도 밀양시 상남면", "code": "48270", "dong": "상남면"}
    ],
    "봉곡동": [
        {"index": 1, "label": "경상남도 창원시 의창구 봉곡동", "code": "48121", "dong": "봉곡동"},
        {"index": 2, "label": "경상남도 진주시 봉곡동", "code": "48170", "dong": "봉곡동"},
        {"index": 3, "label": "경상북도 구미시 봉곡동", "code": "47190", "dong": "봉곡동"}
    ],
    "상대동": [
        {"index": 1, "label": "경상남도 진주시 상대동", "code": "48170", "dong": "상대동"},
        {"index": 2, "label": "대전광역시 유성구 상대동", "code": "30200", "dong": "상대동"}
    ],
    "하대동": [
        {"index": 1, "label": "경상남도 진주시 하대동", "code": "48170", "dong": "하대동"}
    ],
    "삼성동": [
        {"index": 1, "label": "서울특별시 강남구 삼성동", "code": "11680", "dong": "삼성동"},
        {"index": 2, "label": "서울특별시 관악구 삼성동", "code": "11620", "dong": "삼성동"},
        {"index": 3, "label": "대전광역시 동구 삼성동", "code": "30110", "dong": "삼성동"}
    ],
    "신사동": [
        {"index": 1, "label": "서울특별시 강남구 신사동", "code": "11680", "dong": "신사동"},
        {"index": 2, "label": "서울특별시 은평구 신사동", "code": "11380", "dong": "신사동"}
    ],
    "신흥동": [
        {"index": 1, "label": "경기도 성남시 수정구 신흥동", "code": "41131", "dong": "신흥동"},
        {"index": 2, "label": "인천광역시 중구 신흥동", "code": "28110", "dong": "신흥동"},
        {"index": 3, "label": "대전광역시 동구 신흥동", "code": "30110", "dong": "신흥동"}
    ],
    "역삼동": [
        {"index": 1, "label": "서울특별시 강남구 역삼동", "code": "11680", "dong": "역삼동"},
        {"index": 2, "label": "경기도 용인시 처인구 역삼동", "code": "41461", "dong": "역삼동"}
    ],
    "중동": [
        {"index": 1, "label": "경기도 부천시 원미구 중동", "code": "41192", "dong": "중동"},
        {"index": 2, "label": "부산광역시 해운대구 중동", "code": "26350", "dong": "중동"},
        {"index": 3, "label": "경상남도 창원시 의창구 중동", "code": "48121", "dong": "중동"}
    ],
    "내동": [
        {"index": 1, "label": "경상남도 김해시 내동", "code": "48250", "dong": "내동"},
        {"index": 2, "label": "대전광역시 서구 내동", "code": "30170", "dong": "내동"}
    ],
    "외동": [
        {"index": 1, "label": "경상남도 김해시 외동", "code": "48250", "dong": "외동"},
        {"index": 2, "label": "경상북도 경주시 외동읍", "code": "47130", "dong": "외동읍"}
    ],
    "장대동": [
        {"index": 1, "label": "경상남도 진주시 장대동", "code": "48170", "dong": "장대동"},
        {"index": 2, "label": "대전광역시 유성구 장대동", "code": "30200", "dong": "장대동"}
    ]
}


def check_dong_ambiguity(prompt: str, dong_name: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    """
    사용자가 질문한 법정동이 전국 2개 이상의 시/군/구에 존재하는 동음이의어인지 판별.
    사용자의 질문에 시/도나 시/군/구 명칭(예: '진주 가좌동', '인천 가좌동')이 명시된 경우 모호하지 않으므로 None 반환.
    """
    if not dong_name:
        return None

    clean_dong = str(dong_name).strip()
    candidates = HOMONYM_DONG_REGISTRY.get(clean_dong)
    if not candidates or len(candidates) < 2:
        return None

    # 질문 텍스트에 이미 시/도나 시/군/구가 포함되어 있는지 확인
    p_clean = prompt.replace(" ", "")
    for cand in candidates:
        tokens = cand["label"].split()  # 예: ['경상남도', '진주시', '가좌동']
        sido_token = tokens[0][:2]       # 예: '경남', '인천', '경기', '서울'
        sigungu_token = tokens[1].replace("시", "").replace("구", "").replace("군", "")
        if (len(sido_token) >= 2 and sido_token in p_clean) or (len(sigungu_token) >= 2 and sigungu_token in p_clean):
            return None

    return candidates


def resolve_disambiguation_choice(
    user_choice: str,
    options: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    사용자의 입력('1번', '1', '진주시 가좌동', '인천' 등)을 후보 목록과 매칭하여 선택된 지역 반환
    """
    choice = user_choice.strip()

    # 1. 번호 선택 (예: "1", "1번", "1번으로", "2")
    num_match = re.search(r"(\d+)", choice)
    if num_match:
        idx = int(num_match.group(1))
        for opt in options:
            if opt.get("index") == idx:
                return opt

    # 2. 지역명 직접 입력 (예: "진주시 가좌동", "진주", "인천", "고양시")
    choice_clean = choice.replace(" ", "")
    for opt in options:
        label_clean = opt.get("label", "").replace(" ", "")
        if choice_clean in label_clean or any(part in choice_clean for part in opt.get("label", "").split() if len(part) >= 2):
            return opt

    return None
