# Plan: Quản lý Media file của giải đấu (Video & Images)

> Phạm vi: chỉ role **Ban tổ chức (ORGANIZER)** + chủ sở hữu giải.
> FE: `/var/www/free-time/rvf` · BE: `/var/www/free-time/rvf-be`
> Ngày lập: 2026-06-16

## 1. Kiến trúc chốt

```
FE  --(1) xin presign-->  BE  --(2) trả PUT URL + key-->  FE
FE  --(3) PUT file thẳng---------------------------------> S3
FE  --(4) gửi {key, type, size, name...}--> BE  --(5) tạo record `media` + map `tournament_media`
```

- **Bảng `media` dùng chung** (tái sử dụng nhiều nơi sau này) + bảng map **`tournament_media`** liên kết media ↔ giải đấu.
- **Presigned URL**: FE upload thẳng lên S3, BE chỉ cấp URL ký + lưu metadata (giảm tải server, không stream file qua BE).
- Loại file: **image, svg, video, document (doc/xlsx/pdf)**.
- Quyền: **role ORGANIZER + ownership giải** (dùng `authorize` sẵn có, không thêm permission flag).

## 2. Hiện trạng (tái sử dụng)

| Hạ tầng | BE (`rvf-be`) | FE (`rvf`) |
|---|---|---|
| Upload S3 | ✅ `aws.service.ts`, `client-s3`, `lib-storage` | ✅ `api/upload.ts`, `base/upload/*` |
| **Presigned URL** | ❌ chưa có (`s3-request-presigner` chưa cài) | ❌ chưa có composable upload thẳng S3 |
| Role ORGANIZER | ✅ `authorize({roles})`, `ROLES.ORGANIZER` | ✅ middleware `/organizer/*`, `Role.ORGANIZER` |
| Tournament media | ⚠️ read-only suy từ `banner_url`/sponsor, **chưa có CRUD/bảng riêng** | ⚠️ chỉ hiển thị viewer |

→ Gap: bảng media dùng chung + flow presign + CRUD do BTC quản lý.

---

## 3. Backend (`rvf-be`)

| # | Task | File | Est người (h) | Est AI (h) |
|---|------|------|--------:|--------:|
| B1 | Cài dep `@aws-sdk/s3-request-presigner` | `package.json` | 0.5 | 0.1 |
| B2 | Migration + Model `media` | `database/migrations/*-create-media.ts`, `database/models/Media.ts` | 3 | 0.5 |
| B3 | Migration + Model `tournament_media` (FK, index, unique pair) | `database/migrations/*-create-tournament-media.ts`, `database/models/TournamentMedia.ts` | 3 | 0.5 |
| B4 | `aws.service.getPresignedPutUrl(key, mime)` (PutObjectCommand + getSignedUrl + expiry) | `services/aws.service.ts` | 2 | 0.5 |
| B5 | `media.service.ts`: presign, confirm/create record, validate mime↔type, status PENDING→CONFIRMED | `services/media.service.ts` | 4 | 1 |
| B6 | Mở rộng `tournament-media.service.ts`: attach/list/detach/reorder, xóa S3 khi gỡ | `services/tournament-media.service.ts` | 4 | 1 |
| B7 | Controller quản lý media cho BTC | `controllers/organizations/tournament-media-management.controller.ts` | 3 | 0.5 |
| B8 | Routes (gated `authorize({roles:[ORGANIZER]})` + ownership check) | `routes/api/organization/tournament-media.route.ts` | 2 | 0.4 |
| B9 | Validator Joi: presign DTO + confirm DTO, whitelist mime/size 4 nhóm, giới hạn số lượng | `validators/tournament-media.validator.ts` | 2.5 | 0.5 |
| B10 | Ownership guard (BTC chỉ thao tác giải của mình) | middleware/service | 1.5 | 0.4 |
| B11 | Unit/integration test (service + route) | `__tests__` | 4 | 1.5 |
| B12 | Migration + Model `media_category` (scope theo giải, CRUD) | `database/migrations/*-create-media-category.ts`, `database/models/MediaCategory.ts` | 2.5 | 0.5 |
| B13 | Migration + Model `tags` + `tournament_media_tag` (M2M) | `database/migrations/*-create-tags.ts`, `database/models/Tag.ts`, `database/models/TournamentMediaTag.ts` | 3 | 0.5 |
| B14 | Category CRUD: service + controller + route + validator (gated ORGANIZER + ownership) | `services/media-category.service.ts`, `controllers/organizations/media-category.controller.ts`, `routes/api/organization/media-category.route.ts` | 4 | 1 |
| B15 | Tag get-or-create + attach/detach ở mapping; mở rộng create/update/list media để nhận `category_id` + `tags[]` | `services/tournament-media.service.ts` | 2.5 | 0.5 |

**Endpoints**
- `POST /api/organizations/tournaments/:id/media/presign` → `{ uploadUrl, key }`
- `POST /api/organizations/tournaments/:id/media` → confirm key → tạo `media` + map
- `GET  /api/organizations/tournaments/:id/media`
- `PUT  /api/organizations/tournaments/:id/media/:mediaId` (caption/sort_order)
- `DELETE /api/organizations/tournaments/:id/media/:mediaId`

**Endpoints Category** (gated ORGANIZER + ownership giải)
- `GET    /api/organizations/tournaments/:id/media-categories`
- `POST   /api/organizations/tournaments/:id/media-categories`
- `PUT    /api/organizations/tournaments/:id/media-categories/:categoryId`
- `DELETE /api/organizations/tournaments/:id/media-categories/:categoryId`

**Schema `media`**: `id, s3_key, url, media_type[IMAGE|SVG|VIDEO|DOCUMENT], mime_type, size, original_name, uploaded_by, status[PENDING|CONFIRMED], created_at, updated_at`
**Schema `media_category`**: `id, tournament_id(FK), name, slug, sort_order, created_by, created_at, updated_at` + unique(tournament_id, slug)
**Schema `tournament_media`**: `id, tournament_id(FK), media_id(FK), category_id(FK→media_category, nullable), caption, sort_order, created_at, updated_at` + unique(tournament_id, media_id)
**Schema `tags`**: `id, name, slug, created_at` + unique(slug) — pool dùng chung, get-or-create
**Schema `tournament_media_tag`**: `id, tournament_media_id(FK), tag_id(FK)` + unique(tournament_media_id, tag_id)

**BE subtotal: người ~41.5h · AI ~9.4h**

---

## 4. Frontend (`rvf`)

| # | Task | File | Est người (h) | Est AI (h) |
|---|------|------|--------:|--------:|
| F1 | Types media + tournament media | `types/media.d.ts`, `types/tournament.d.ts` | 1.5 | 0.3 |
| F2 | API wrapper (presign/confirm/get/update/delete) theo convention `clientService` | `api/tournament-media.ts` | 2.5 | 0.5 |
| F3 | Composable `useS3Upload` — PUT thẳng S3 có progress (XHR), trả key | `composables/useS3Upload.ts` | 3.5 | 1 |
| F4 | Component manager: grid, multi-upload + progress, preview theo loại, xóa, kéo sắp xếp | `components/organizer/tournament-media-manager.vue` | 8 | 2.5 |
| F5 | Sub-component preview (image/svg thumbnail, video player, document icon) | `components/organizer/tournament-media-item.vue` | 3 | 1 |
| F6 | Thêm tab "Media" vào trang edit giải | `pages/organizer/tournament/[id]/edit.vue` | 2 | 0.5 |
| F7 | i18n keys | `locales/vi.json`, `locales/en.json` | 1 | 0.2 |
| F8 | Validate phía client (loại/size trước khi presign), xử lý lỗi/empty/loading state | F3/F4 | 2 | 0.5 |
| F9 | Quản lý category: select + modal CRUD (thêm/sửa/xóa), lọc media theo category | `components/organizer/media-category-manager.vue` + `api/tournament-media.ts` | 4 | 1 |
| F10 | Tag input nhiều giá trị, free-form + autocomplete từ pool, hiển thị tag trên item | `components/organizer/media-tag-input.vue` | 3 | 1 |

**FE subtotal: người ~30.5h · AI ~8.5h**

---

## 5. Việc xuyên suốt / hạ tầng

| # | Task | Owner | Est người (h) | Est AI (h) |
|---|------|-------|--------:|--------:|
| X1 | Cấu hình **CORS bucket S3** cho phép PUT từ origin FE | DevOps | 1.5 | 1.5 ⚠️ |
| X2 | S3 lifecycle / cron dọn media `PENDING` mồ côi (upload nhưng không confirm) | BE/DevOps | 2 | 1 |
| X3 | Cập nhật skill `.agents/skills/api/SKILL.md` (pattern presign + bảng media dùng chung) | Dev | 1 | 0.3 |
| X4 | E2E thử nghiệm thủ công full flow + review | QA | 3 | 3 ⚠️ |

**Xuyên suốt subtotal: người ~7.5h · AI ~5.8h**

> ⚠️ X1 (cấu hình hạ tầng cloud) và X4 (QA thủ công) phụ thuộc con người — AI không rút ngắn được nhiều.

---

## 6. Tổng hợp Estimate

| Mảng | Est người | Est AI | Tỷ lệ |
|------|-------:|-------:|------:|
| Backend | ~41.5h | ~9.4h | ~23% |
| Frontend | ~30.5h | ~8.5h | ~28% |
| Hạ tầng / xuyên suốt | ~7.5h | ~5.8h | ~77% |
| **Tổng** | **~79.5h (≈ 10.5 ngày công)** | **~23.7h** | **~30%** |
| + Buffer rủi ro 20% | **~95h (≈ 12 ngày công)** | **~28.5h** | |

> **Est người**: 1 dev fullstack. Song song BE/FE: ~5–6 ngày lịch (sau khi B2/B3 + B4 xong để FE có hợp đồng API).
>
> **Est AI**: thời gian wall-clock khi AI agent code + dev review/sửa từng task. Phần code (BE/FE) rút ngắn mạnh (~75%); phần hạ tầng cloud (X1) và QA thủ công (X4) gần như không đổi vì phụ thuộc con người → đây là phần chiếm tỷ trọng lớn nhất trong est AI.

## 7. Thứ tự triển khai đề xuất

1. **BE nền tảng**: B1 → B2 → B3 → B4 (presign) → B5. *(mở khóa hợp đồng API cho FE)*
2. **BE CRUD**: B6 → B7 → B8 → B9 → B10.
3. **FE song song** (sau B4/B5): F1 → F2 → F3 → F4/F5 → F6 → F7 → F8.
4. **Hạ tầng**: X1 sớm (trước khi test presign thật), X2 sau.
5. **Test & review**: B11, X4, X3.

## 8. API Response Contracts

> Theo format chuẩn `response.util.ts`:
> - Single: `{ success: true, data: {...}, message? }`
> - List: `{ success: true, data: [...], meta: { total, page, limit, total_pages }, message? }`
> - Error: `{ success: false, error: { code, message, key, params?, details? }, status: false, message, messageKey }`

### Đối tượng dùng chung

`MediaObject`:
```json
{
  "id": "b1c2d3e4-...",
  "url": "https://d20hi09v6vrtp6.cloudfront.net/uploads/videos/abc.mp4",
  "media_type": "VIDEO",            // IMAGE | SVG | VIDEO | DOCUMENT
  "mime_type": "video/mp4",
  "size": 15728640,
  "original_name": "final-match.mp4",
  "status": "CONFIRMED",            // PENDING | CONFIRMED
  "created_at": "2026-06-16T08:30:00.000Z"
}
```

`CategoryObject`:
```json
{ "id": "cat-01-...", "name": "Chung kết", "slug": "chung-ket", "sort_order": 0 }
```

`TagObject`:
```json
{ "id": "tag-01-...", "name": "highlight", "slug": "highlight" }
```

`TournamentMediaItem` (record map, dùng ở list/create/update):
```json
{
  "id": "tm-001-...",               // id của tournament_media
  "tournament_id": "t-123-...",
  "caption": "Trận chung kết",
  "sort_order": 0,
  "category": { "...CategoryObject..." },   // null nếu chưa gán
  "tags": [ { "...TagObject..." } ],         // [] nếu không có
  "created_at": "2026-06-16T08:30:00.000Z",
  "updated_at": "2026-06-16T08:30:00.000Z",
  "media": { "...MediaObject..." }
}
```

---

### B-API1 · `POST /api/organizations/tournaments/:id/media/presign`
Xin URL ký để FE PUT thẳng lên S3 (hỗ trợ batch).

**Request**
```json
{
  "files": [
    { "original_name": "final-match.mp4", "mime_type": "video/mp4", "size": 15728640 },
    { "original_name": "poster.svg", "mime_type": "image/svg+xml", "size": 20480 }
  ]
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "key": "uploads/videos/2026/06/uuid-final-match.mp4",
        "upload_url": "https://rongviet-dev.s3.ap-southeast-1.amazonaws.com/uploads/videos/...&X-Amz-Signature=...",
        "media_type": "VIDEO",
        "expires_in": 900
      },
      {
        "key": "uploads/images/2026/06/uuid-poster.svg",
        "upload_url": "https://rongviet-dev.s3.ap-southeast-1.amazonaws.com/uploads/images/...&X-Amz-Signature=...",
        "media_type": "SVG",
        "expires_in": 900
      }
    ]
  },
  "message": "Tạo link tải lên thành công"
}
```

> FE dùng `upload_url` để `PUT` file (header `Content-Type` = đúng `mime_type` đã khai báo), rồi gọi B-API2 với `key`.

---

### B-API2 · `POST /api/organizations/tournaments/:id/media`
Xác nhận key đã upload → tạo `media` (status CONFIRMED) + map vào giải. Hỗ trợ batch.

**Request**
```json
{
  "items": [
    { "key": "uploads/videos/2026/06/uuid-final-match.mp4", "mime_type": "video/mp4", "size": 15728640, "original_name": "final-match.mp4", "caption": "Trận chung kết", "category_id": "cat-01", "tags": ["highlight", "chung-ket"] },
    { "key": "uploads/images/2026/06/uuid-poster.svg", "mime_type": "image/svg+xml", "size": 20480, "original_name": "poster.svg", "category_id": null, "tags": [] }
  ]
}
```

> `category_id`: tùy chọn, phải thuộc giải. `tags`: mảng tên free-form, BE tự get-or-create vào pool `tags` rồi map.

**Response 201**
```json
{
  "success": true,
  "data": [
    { "id": "tm-001", "tournament_id": "t-123", "caption": "Trận chung kết", "sort_order": 0, "created_at": "...", "updated_at": "...", "media": { "...MediaObject..." } },
    { "id": "tm-002", "tournament_id": "t-123", "caption": null, "sort_order": 1, "created_at": "...", "updated_at": "...", "media": { "...MediaObject..." } }
  ],
  "message": "Thêm media cho giải đấu thành công"
}
```

---

### B-API3 · `GET /api/organizations/tournaments/:id/media`
Danh sách media của giải (có phân trang + lọc theo loại).

**Query**: `?page=1&limit=20&media_type=VIDEO&category_id=cat-01&tag=highlight` (tất cả optional)

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": "tm-001", "tournament_id": "t-123", "caption": "Trận chung kết", "sort_order": 0, "created_at": "...", "updated_at": "...", "media": { "...MediaObject..." } }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20, "total_pages": 1 },
  "message": "Lấy danh sách media thành công"
}
```

---

### B-API4 · `PUT /api/organizations/tournaments/:id/media/:mediaId`
Cập nhật caption / sort_order (`:mediaId` = id của `tournament_media`).

**Request** (mọi field optional, chỉ gửi field cần đổi)
```json
{ "caption": "Khoảnh khắc trao cúp", "sort_order": 2, "category_id": "cat-02", "tags": ["highlight", "trao-cup"] }
```

> `tags` nếu gửi sẽ **thay thế toàn bộ** tag hiện tại của media trong giải (replace, không append).

**Response 200**
```json
{
  "success": true,
  "data": { "id": "tm-001", "tournament_id": "t-123", "caption": "Khoảnh khắc trao cúp", "sort_order": 2, "created_at": "...", "updated_at": "...", "media": { "...MediaObject..." } },
  "message": "Cập nhật media thành công"
}
```

---

### B-API5 · `DELETE /api/organizations/tournaments/:id/media/:mediaId`
Gỡ media khỏi giải + xóa object S3 (nếu media không được tham chiếu nơi khác).

**Response 200**
```json
{
  "success": true,
  "data": { "id": "tm-001", "deleted": true },
  "message": "Xóa media thành công"
}
```

---

### B-API6 · `GET /api/organizations/tournaments/:id/media-categories`
Danh sách category của giải.

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": "cat-01", "name": "Chung kết", "slug": "chung-ket", "sort_order": 0 },
    { "id": "cat-02", "name": "Khai mạc", "slug": "khai-mac", "sort_order": 1 }
  ],
  "message": "Lấy danh sách danh mục thành công"
}
```

### B-API7 · `POST /api/organizations/tournaments/:id/media-categories`
**Request**: `{ "name": "Hậu trường", "sort_order": 2 }` (slug tự sinh từ name)

**Response 201**
```json
{
  "success": true,
  "data": { "id": "cat-03", "name": "Hậu trường", "slug": "hau-truong", "sort_order": 2 },
  "message": "Tạo danh mục thành công"
}
```

### B-API8 · `PUT /api/organizations/tournaments/:id/media-categories/:categoryId`
**Request**: `{ "name": "Hậu trường giải đấu", "sort_order": 3 }`

**Response 200**
```json
{
  "success": true,
  "data": { "id": "cat-03", "name": "Hậu trường giải đấu", "slug": "hau-truong-giai-dau", "sort_order": 3 },
  "message": "Cập nhật danh mục thành công"
}
```

### B-API9 · `DELETE /api/organizations/tournaments/:id/media-categories/:categoryId`
Xóa category; media đang gán sẽ về `category = null` (set null, không xóa media).

**Response 200**
```json
{
  "success": true,
  "data": { "id": "cat-03", "deleted": true, "affected_media": 4 },
  "message": "Xóa danh mục thành công"
}
```

### B-API10 · `GET /api/organizations/tournaments/:id/media-tags?q=high`
Gợi ý tag (autocomplete) — trả tag đã dùng trong giải + match pool chung.

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": "tag-01", "name": "highlight", "slug": "highlight" },
    { "id": "tag-09", "name": "highlight-reel", "slug": "highlight-reel" }
  ],
  "message": "Lấy gợi ý tag thành công"
}
```

---

### Lỗi dùng chung (ví dụ)

**403 — không phải chủ giải / không đủ quyền**
```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "Bạn không có quyền quản lý media của giải đấu này", "key": "error.tournament_media.forbidden" },
  "status": false,
  "message": "Bạn không có quyền quản lý media của giải đấu này",
  "messageKey": "error.tournament_media.forbidden"
}
```

**422 — validate (mime không hỗ trợ / quá size)**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "key": "error.validation",
    "details": [
      { "field": "files.0.mime_type", "message": "Định dạng không được hỗ trợ", "key": "error.media.unsupported_mime" },
      { "field": "files.0.size", "message": "Kích thước vượt quá giới hạn", "key": "error.media.size_exceeded" }
    ]
  },
  "status": false,
  "message": "Dữ liệu không hợp lệ",
  "messageKey": "error.validation",
  "errors": { "files.0.mime_type": "error.media.unsupported_mime", "files.0.size": "error.media.size_exceeded" }
}
```

**404 — media không tồn tại trong giải**
```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Không tìm thấy media", "key": "error.tournament_media.not_found" },
  "status": false,
  "message": "Không tìm thấy media",
  "messageKey": "error.tournament_media.not_found"
}
```

## 9. Rủi ro / cần xác nhận

- **CORS S3**: presign PUT fail nếu bucket chưa cho phép origin FE → làm X1 trước khi test thật.
- **Media mồ côi**: cần X2 nếu không muốn rác tích tụ trên S3.
- **Giới hạn video**: hiện cấu hình tối đa 500MB — xác nhận lại với yêu cầu thực tế (presign cho phép file lớn, nhưng cần giới hạn ở validator + client).
- **Tái sử dụng `media`**: thiết kế bảng `media` tách rời để sau gắn được vào entity khác (sponsor, news...) — đã tính trong schema, không phát sinh thêm việc ở giai đoạn này.
