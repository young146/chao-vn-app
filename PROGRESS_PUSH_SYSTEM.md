# 푸시 알림 시스템 진행 현황

> 마지막 업데이트: 2026-05-25

## 완료된 작업

### 1. 커스텀 푸시 발송 (Cloud Function)
- **파일**: `functions/index.js` — `exports.sendCustomPush`
- 제목(50자) / 내용(150자) / 링크 / 이미지 지원
- 발송 전 Firestore `announcements/{id}` 문서 자동 생성 (댓글 스레드 루트)
- `broadcastLogs` 컬렉션에 발송 이력 기록

### 2. 공지사항 상세 화면 (앱)
- **파일**: `screens/AnnouncementDetailScreen.js`
- 공지 본문 + 댓글/대댓글 실시간 스레드
- 이미지 첨부 가능 (Firebase Storage)
- Firestore: `announcements/{id}/comments` 서브컬렉션

### 3. 공지사항 목록 화면 (앱)
- **파일**: `screens/AnnouncementsListScreen.js`
- 메뉴(MoreScreen) → 공지사항 탭에서 접근
- 카드형 실시간 목록

### 4. 알림 탭 처리 (앱)
- **파일**: `services/NotificationService.js`
- `announcementId` 있음 → 공지 상세 화면으로 이동
- `url` 있음 → 브라우저 오픈
- 없음 → 뉴스 탭

### 5. Firestore 보안 규칙
- **파일**: `firestore.rules`
- `announcements`: 누구나 읽기, 어드민만 쓰기
- `announcements/comments`: 로그인 사용자 작성, 본인/어드민 삭제

### 6. 예약 발송 (Cloud Function)
- **파일**: `functions/index.js` — `exports.scheduledPushCheck`
- 5분마다 실행
- Firestore `pushDrafts` 컬렉션에서 `status=scheduled` + `scheduledAt <= now` 항목 자동 발송
- 발송 후 `status=sent` 업데이트, 실패 시 `status=failed`

### 7. 어드민 UI (vnkorlife.com / daily-news-final)
- **파일**: `daily-news-final/app/admin/push-notifications/page.js`
- 새 알림 작성 폼 (제목/내용/링크/이미지)
- 폰 알림 실시간 미리보기
- 테스트 모드 (dryRun)
- 임시저장 버튼
- 예약 발송: datetime-local picker → "예약 등록" 버튼
- 임시저장/예약 목록: 수정 · 즉시발송 · 삭제

### 8. 어드민 API (daily-news-final)
| 파일 | 역할 |
|---|---|
| `app/api/admin/push/route.js` | GET 이력 / POST 즉시발송 |
| `app/api/admin/push/upload/route.js` | 이미지 Firebase Storage 업로드 |
| `app/api/admin/push/drafts/route.js` | GET 목록 / POST 저장 |
| `app/api/admin/push/drafts/[id]/route.js` | PUT 수정 / DELETE 삭제 |
| `app/api/admin/push/drafts/[id]/send/route.js` | POST 즉시 발송 |

---

## Firestore 컬렉션 구조

```
announcements/{id}
  title, body, imageUrl, url, commentCount, sentAt
  └── comments/{commentId}
        userId, displayName, text, imageUrl, parentId, parentDisplayName, createdAt

pushDrafts/{id}
  title, body, url, imageUrl
  status: draft | scheduled | sending | sent | failed
  scheduledAt: Timestamp | null
  createdAt, updatedAt

broadcastLogs/{id}
  type, title, body, imageUrl, url, fcmCount, expoCount, status, sentAt
  campaign, announcementId
```

---

## 남은 작업

- [ ] `pushDrafts` 복합 쿼리용 Firestore 인덱스 확인 (status + scheduledAt)
- [ ] 어드민 패널에서 댓글 삭제 기능
- [ ] iOS 이미지 알림 (Notification Service Extension) — 차기 EAS Build 시
- [ ] 발송 실패(failed) 항목 어드민 표시

---

## 배포 현황

| 항목 | 상태 |
|---|---|
| chao-vn-app git push | ✅ `github.com/young146/chao-vn-app` |
| chao-vn-app OTA | ✅ production 채널 (runtime 2.4.2) |
| daily-news-final git push | ✅ `github.com/young146/daily-news-final` |
| Vercel 자동 배포 | ✅ vnkorlife.com |
| Firebase Functions | ✅ `sendCustomPush` + `scheduledPushCheck` 배포 완료 |
