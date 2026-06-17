# Quản lý Cụm sân (Court Cluster) — Overview & Template

> Tài liệu thiết kế cho feature **quản lý cụm sân / sân** để (sau này) assign cho match ở bracket.
> Đợt này chỉ chốt **structure + wireframe phần Admin quản lý template chuẩn + import/export Excel**.
> File kèm theo: [`manage-location-clusters-template.xlsx`](../assets/manage-location-clusters-template.xlsx)

---

## 1. Mục tiêu & phạm vi

| | |
|---|---|
| **Mục tiêu** | Quản lý thư viện **cụm sân chuẩn** (chuẩn hoá toàn hệ thống) để BTC import vào giải, rồi gen bracket gán sân cho match. |
| **Trong scope đợt này** | (Admin) CRUD thư viện template chuẩn + **import/export Excel**. |
| **Out of scope (để sau)** | Import cụm vào từng giải · random gán sân cho match khi gen bracket · scheduling/chống trùng giờ · versioning UI. |

---

## 2. Hiện trạng codebase (đã khảo sát)

- **Chưa có** model `Court`/`Venue`/`Sân`. `matches` chỉ có `scheduled_at`, **không có** trường sân.
- "Sân" hiện chỉ là `tournaments.location` — **text tự do** (không filter/group được).
- "Bracket" là **ngầm định**: không có bảng `Bracket`; 1 trận = `tournament_id + stage + round_number + match_number (+ group_id)`.
- Codebase đã có idiom **"template → bản sao theo giải"** (`SportStatTemplate`/`SportFormatRule` → `TournamentRule`) → áp dụng cho cụm sân.
- Bảng `sports` đã có sẵn `id / name / slug (unique) / mode` → tái dùng cho tags môn (không tạo bảng môn mới).
- **Chưa có** util slugify trong `src/utils` → khi implement cần thêm `slug.util.ts` (bỏ dấu tiếng Việt).

---

## 3. Mô hình 3 tầng

```
TẦNG CHUẨN (admin, global, bất biến + version)
  Sport ──N:M (court_cluster_template_sports)── CourtClusterTemplate ─1:N─> CourtTemplate
                                                       │
                                                       │  import (snapshot/copy) khi tạo giải   ← để sau
                                                       ▼
TẦNG THEO GIẢI (editable — wireframe đã có)
  TournamentCourtCluster ─1:N─> TournamentCourt
                                                       │  gen bracket: random 1 sân/match       ← để sau
                                                       ▼
  Match.court_id ──> TournamentCourt   (N match : 1 sân, BTC sửa được)
```

**Vì sao snapshot, không trỏ thẳng template:** sửa/xoá template không được phá lịch của giải đã import; khớp pattern `TournamentRule`; truy vết nguồn qua `source_*_id`.

---

## 4. Cấu trúc bảng

### 4.1 `CourtClusterTemplate` — cụm sân chuẩn (mang địa điểm)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|:--:|---|
| `id` | UUID | ✓ | PK |
| `code` | string unique | | **slug auto từ `name`, sửa được** (mã import) |
| `name` | string | ✓ | "Cụm sân Hòa Xuân" |
| `venue_name` | string | | tên nhà thi đấu |
| `address` | string | ✓ | "Hòa Xuân, Đà Nẵng" |
| `latitude` | decimal | | 16.0312 |
| `longitude` | decimal | | 108.2249 |
| `version` | int | | bất biến → đổi = bump version (ẩn ở v1) |
| `description` | text | | |
| `metadata` | JSON | | mở rộng (ẩn ở v1) |
| `is_active` | bool | | cho BTC chọn import |

> Đã **tối giản địa lý**: bỏ `province_id`/`ward`/`district`, chỉ còn `address` + `lat/lng`.

### 4.2 `CourtTemplate` — sân chuẩn (thông số vật lý)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|:--:|---|
| `id` | UUID | ✓ | PK |
| `cluster_template_id` | FK → CourtClusterTemplate | ✓ | |
| `code` | string | | slug auto, sửa được |
| `name` | string | ✓ | "Sân 1" |
| `order_index` | int | | thứ tự hiển thị |
| `surface_type` | enum `CourtSurface` | | HARD / CLAY / GRASS / WOOD / SYNTHETIC |
| `environment` | enum `CourtEnvironment` | | INDOOR / OUTDOOR |
| `width_m` | decimal | | rộng |
| `length_m` | decimal | | dài |
| `area_sqm` | decimal | | diện tích (tính từ w×l) |
| `capacity` | int | | sức chứa khán giả |
| `has_lighting` | bool | | có đèn |
| `status` | enum `CourtStatus` | | AVAILABLE / MAINTENANCE / CLOSED (ẩn ở v1) |
| `attributes` | JSON | | mở rộng (ẩn ở v1) |

### 4.3 `court_cluster_template_sports` — junction (1 cụm ↔ N môn, tags)

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | UUID | PK |
| `cluster_template_id` | FK → CourtClusterTemplate | |
| `sport_id` | FK → Sport | tái dùng bảng `sports` |
| `order_index` | int | thứ tự tag (optional) |
| | | **UNIQUE(`cluster_template_id`, `sport_id`)** |

> Model: `@BelongsToMany(() => Sport, () => CourtClusterTemplateSport)`. UI = multi-select tags. Sports tags chủ yếu để **filter lúc import**.

### 4.4 Tầng theo giải (để sau — tham khảo)

- `TournamentCourtCluster` (id, `tournament_id`, `source_template_id?`, name, address, lat/lng, …) — bản copy editable.
- `TournamentCourt` (id, `tournament_court_cluster_id`, `source_court_template_id?`, name, surface_type, …, status).
- `matches.court_id` (FK nullable → `TournamentCourt`) — random lúc gen, BTC sửa được.

---

## 5. Enum đề xuất (đặt trong file model sở hữu cột)

```ts
// CourtTemplate.ts
export enum CourtSurface { HARD='HARD', CLAY='CLAY', GRASS='GRASS', WOOD='WOOD', SYNTHETIC='SYNTHETIC' }
export enum CourtEnvironment { INDOOR='INDOOR', OUTDOOR='OUTDOOR' }
export enum CourtStatus { AVAILABLE='AVAILABLE', MAINTENANCE='MAINTENANCE', CLOSED='CLOSED' }
```

---

## 6. Quyết định thiết kế đã chốt

1. Template là **thư viện global, do Admin quản** (không per-org); BTC chỉ **read-only để import**.
2. Template **bất biến**; đổi = `version` mới (plan riêng). Snapshot khi import → an toàn lịch sử.
3. Địa lý **tối giản**: chỉ `address` + `lat/lng` (không bảng `provinces`).
4. `sports` là **N:M tags** trỏ vào bảng `sports` sẵn có; chỉnh sửa = thêm/xoá row junction.
5. `code` = **slug auto từ `name`, sửa được**, unique (giống `Sport.slug`).
6. 1 match ↔ 1 sân (random lúc gen, sửa được) — phần này **để sau**.
7. Ẩn ở wireframe v1: `version`, `metadata`/`attributes`, `status`.

---

## 7. Excel template (import/export) — `manage-location-clusters-template.xlsx`

3 sheet:

| Sheet | Nội dung |
|---|---|
| **Hướng dẫn & Danh mục** | Cách dùng + **block note SPORTS (copy slug, không tự gõ)** + danh sách 21 slug môn thật + giá trị hợp lệ surface/environment/bool |
| **Cụm sân** | 1 dòng = 1 cụm. Cột: `cluster_code, name*, venue_name, address*, latitude, longitude, sports*, is_active`. Có block note slug bên phải + comment trên header `sports`. |
| **Sân** | 1 dòng = 1 sân. Cột: `cluster_code*, court_code, name*, surface_type, environment, width_m, length_m, capacity, has_lighting`. Có dropdown validation cho surface/environment/has_lighting. |

**Quy tắc:**
- Cột (*) bắt buộc. 2 sheet nối nhau bằng `cluster_code`.
- Bỏ trống `cluster_code`/`court_code` → hệ thống tự sinh slug từ tên.
- `sports`: **copy slug** từ sheet danh mục, nhiều môn ngăn bằng dấu phẩy, không dấu cách (vd `cau-long-don,tennis-don`). Slug sai → dòng bị từ chối khi import.
- Xoá dòng VÍ DỤ (in nghiêng xám) trước khi nhập thật.

---

## 8. Wireframe Admin (3 màn)

1. **Danh sách cụm** — bảng (tên, địa điểm, môn-tags, số sân, is_active) + filter theo môn / tìm theo tên-địa chỉ. Nút: `[Tải file mẫu .xlsx]` · `[Import Excel]` · `[+ Thêm cụm]`.
2. **Tạo / Sửa cụm (detail)** — form cụm (`name`, `code` auto-slug sửa được, `venue_name`, `address`, `lat/lng`, `sports` tags, `is_active`) + **bảng sân inline** (thêm/sửa/xoá/kéo sắp xếp row).
3. **Import Excel** — upload `.xlsx` → **validate** (báo sheet/dòng sai enum/slug/thiếu field bắt buộc) → **preview** (X cụm, Y sân) → `[Xác nhận import]`.

---

## 9. Checklist khi chuyển sang IMPLEMENT (chưa làm đợt này)

- [ ] **NotebookLM**: `select_notebook` + `ask_question` lấy spec "quản lý cụm sân chuẩn" (rule dự án bắt buộc trước khi code schema/API).
- [ ] **GitNexus impact** trên `Match` / `Tournament` trước khi sửa.
- [ ] **Constants** `src/constants/database.ts`: `TABLES.COURT_CLUSTER_TEMPLATES`, `TABLES.COURT_TEMPLATES`, `TABLES.COURT_CLUSTER_TEMPLATE_SPORTS` + nhóm `*_COL`.
- [ ] **Models** + enum (`CourtSurface`/`CourtEnvironment`/`CourtStatus`) trong file model.
- [ ] **Migration** tạo 3 bảng; hardening UTC cho cột datetime (`utc-timestamp-columns.util`).
- [ ] **`slug.util.ts`** (slugify bỏ dấu tiếng Việt).
- [ ] **Validator** (Joi) + **Service** (class + singleton) + **Controller** (thin) + **Routes** trong `admin/` (`/api/admin/court-cluster-templates`).
- [ ] **Import/Export Excel**: chọn lib (vd `exceljs`) — repo hiện chưa có.
- [ ] Cập nhật **OpenAPI** (`src/docs/`) + **Postman** (`zandbox/postman/`).
- [ ] Dùng `sendSuccess/sendList/...` + `parsePaginationParams`; không hardcode literal; `AppError` + `AppTranslationKeys`.

---

## 10. Open items / cần quyết khi mở rộng

- Filter theo tỉnh: hiện `address` là text → sau cần thì reverse-geocode từ `lat/lng` hoặc thêm `province`.
- Import vào giải: cho phép **nhiều cụm**/giải + chọn **tập con sân** (đã thống nhất hướng, làm ở phase sau).
- Scheduling: random thuần + **cảnh báo** trùng (sân × giờ) ở v1; auto-rải theo lịch ở phase sau.
