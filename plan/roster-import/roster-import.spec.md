# Spec: Import "Giải khép kín do Sở cung cấp" qua template.xlsx

> Trạng thái: **Spec đã chốt (v1)** — chưa implement.
> Artifact kèm theo: `template-roster.v1.xlsx`, `gen-roster-template.py`.

---

## 1. Bối cảnh & mục tiêu

- Sở cung cấp **danh sách đầy đủ, đã phân đội/đôi sẵn** → BTC chỉ upload 1 file, hệ thống dựng nguyên giải.
- Giải khép kín ⇒ `Tournament.privacy = PRIVATE`. Các đội import vào **đã được Sở duyệt** ⇒
  `TournamentTeam.registration_status = APPROVED`, `status = active`.
- Template phải: **(a) máy/AI đọc tốt**, **(b) hợp đồng cột ổn định để không vỡ khi mở rộng**,
  **(c) đính kèm đủ thông tin người giám hộ**.

## 2. Ba nguyên tắc thiết kế template

| Nguyên tắc | Cách làm |
| --- | --- |
| **Hợp đồng cột ổn định** | Header **2 dòng**: dòng 1 = nhãn tiếng Việt (cho Sở điền), **dòng 2 = key máy `snake_case`**. Importer **chỉ đọc theo key**, không theo vị trí cột → đổi thứ tự / thêm cột không vỡ import. |
| **Tự mô tả + versioned** | Sheet `_META` chứa `template_version`, `sport_slug`, `format`, `tournament_code`… Importer đọc version để chọn parser → bump version không phá file cũ. |
| **Mở rộng an toàn** | Thêm trường = thêm **cột key mới**; key cũ giữ nguyên; cột lạ → bỏ qua + log, không fail. |

## 3. Cấu trúc file (1 sheet phẳng + meta + hướng dẫn)

> Grain = **1 dòng / 1 vận động viên**. Đội/đôi suy ra bằng cách gom theo `team_ref`.

### Sheet `_META` (key–value)
| key | ví dụ | bắt buộc |
| --- | --- | --- |
| `template_version` | `1.0` | ✓ |
| `tournament_code` | `SO-HCM-2026-001` | ✓ |
| `sport_slug` | `pickleball` | ✓ |
| `format` | `GROUP_KNOCKOUT` | ✓ |
| `gender` | `MIXED` | tùy |
| `age` | `UNLIMITED` | tùy |

### Sheet `Athletes` (header 2 dòng, dữ liệu từ dòng 3)

| Nhãn VN (dòng 1) | key máy (dòng 2) | Map tới DB | Bắt buộc |
| --- | --- | --- | --- |
| Mã VĐV (của Sở) | `external_ref` | khoá chống trùng ưu tiên #1 | — |
| Mã đội/đôi | `team_ref` | gom → `TournamentTeam` | ✓ |
| Tên đội/đôi | `team_name` | `tournament_teams.team_name` | — |
| Bảng | `group_name` | `groups.name` + `team.group_id` | — |
| Hạt giống | `seed` | `tournament_teams.seed` | — |
| Họ tên VĐV | `full_name` | `athletes.full_name` / `team_members.full_name` | ✓ |
| Ngày sinh (YYYY-MM-DD) | `dob` | `*.dob` | ✓ |
| Giới tính | `gender` | `male/female/other` | ✓ |
| Email | `email` | `users.email` (khoá định danh chính) | ✓ |
| SĐT | `phone` | `*.phone` (thông tin, KHÔNG làm khoá) | — |
| Đội trưởng? | `is_captain` | `team_members.is_captain` + `team.captain_athlete_id` | — |
| GH - Họ tên | `guardian_name` | `guardian_requests.guardian_name` | ✓ nếu <18 |
| GH - Quan hệ | `guardian_relation` | `guardian_requests.guardian_relation` | ✓ nếu <18 |
| GH - SĐT | `guardian_phone` | `guardian_requests.guardian_phone` | ✓ nếu <18 |
| GH - Email | `guardian_email` | `guardian_requests.guardian_email` (kênh OTP/liên lạc) | ✓ nếu <18 |
| GH - CCCD/CMND | `guardian_id_number` | `guardian_requests.guardian_id_number` | — |
| GH - Địa chỉ | `guardian_address` | `guardian_requests.guardian_address` | — |

> Trường KYC ảnh giấy tờ (`verification_front_url/back_url`, `issue_date`, `issue_place`) **không đưa vào Excel** —
> thuộc luồng xác minh giám hộ riêng sau import.

### Sheet `Huong_dan`
Từ điển cột (key · nhãn · bắt buộc · quy tắc · ví dụ) + lưu ý chung cho người điền.

## 4. Luồng import (1 transaction, rollback toàn bộ nếu lỗi)

Mỗi dòng VĐV:
1. **Match/Upsert User** theo khoá định danh (mục 6) → có sẵn thì dùng lại; chưa có thì tạo
   `User(status = pending_otp)` + `Athlete`.
2. **Gom đội** theo `team_ref` → tạo/lấy `TournamentTeam`
   (`registration_status = APPROVED`, `status = active`), set `team_name`, `seed`.
   `group_name` có giá trị → tạo/ánh xạ `Group` + set `team.group_id`.
3. **TeamMember**: link `athlete_id`, set `is_captain`; captain → cập nhật `team.captain_athlete_id`.
4. **Guardian** (nếu tuổi < 18 theo `dob`): tạo `GuardianRequest` với **provenance import** (mục 6.1) và
   gắn `athlete_user_id`. Vì Sở đã cung cấp đủ thông tin ⇒ **KHÔNG chạy luồng xác minh riêng**
   (không gửi email/SMS token, không chờ giám hộ bấm xác nhận).

## 5. Validate (trả lỗi theo bảng `{sheet, row, key, message}`, KHÔNG dừng ở lỗi đầu)

- `team_ref`, `full_name`, `dob`, `gender`, `email` bắt buộc.
- Mỗi `team_ref`: đúng **1** `is_captain = true`; số VĐV khớp `Sport.team_size` (đơn=1, đôi=2, đội=N).
- Tuổi suy từ `dob` thỏa `Tournament.age`; `gender` từng VĐV thỏa `Tournament.gender`.
- VĐV `dob` < 18 ⇒ bắt buộc đủ `guardian_name / guardian_relation / guardian_phone / guardian_email`.

### 5.1 Người giám hộ — provenance khi import từ Sở

Khi VĐV < 18 và Sở đã điền **đủ** thông tin giám hộ (`guardian_name`, `guardian_relation`,
`guardian_phone`, `guardian_email`) ⇒ coi như **đã được Sở xác nhận**, hệ thống **bỏ qua luồng
xác minh riêng** và tạo `GuardianRequest` đã duyệt sẵn kèm dấu vết nguồn gốc:

| Trường (DB) | Giá trị set khi import | Ý nghĩa |
| --- | --- | --- |
| `guardian_status` | `approved` | Trạng thái duyệt (dùng lại cột `status` hiện có) |
| `guardian_source` | `SPORT_DEPARTMENT_IMPORT` | Nguồn dữ liệu giám hộ = danh sách Sở (**trường mới**) |
| `guardian_verified_by` | `department_roster_import` | Ai/cơ chế nào đã xác nhận (**trường mới**) |
| `approved_at` | thời điểm import (UTC) | Mốc duyệt |

Quy ước:

- Đây là các trường **hệ thống tự set**, **KHÔNG có** trong template Excel của Sở.
- `guardian_source` là enum nguồn gốc; giá trị mặc định cho luồng thường nên là `SELF_REQUEST`
  (VĐV/giám hộ tự khai), và `SPORT_DEPARTMENT_IMPORT` cho luồng import này → về sau có thể thêm
  nguồn khác (vd `ADMIN_MANUAL`) mà không phá dữ liệu cũ.
- Nếu Sở điền **thiếu** thông tin giám hộ cho VĐV < 18 ⇒ **lỗi validate** (mục 5), KHÔNG fallback
  sang luồng xác minh thủ công.

## 6. Khoá chống trùng (idempotent re-import)

```
external_ref  →  email  →  (fallback: normalize(full_name) + dob + gender, gắn cờ "cần review")
```

- `email` = khoá định danh chính (Sở/giám hộ tạo được, kể cả VĐV nhỏ tuổi).
- `phone` KHÔNG tham gia khoá (trẻ nhỏ khó có).
- `external_ref` nếu có thì ưu tiên #1.
- Khoá định danh là **người**, KHÔNG gồm `team_ref` → cho phép chuyển đội khi re-import mà không tạo bản trùng.
- Trùng `full_name+dob+gender` của 2 người thật trong cùng giải → gắn cờ review, không tự merge.

## 7. Quyết định đã chốt

| # | Vấn đề | Quyết định |
| --- | --- | --- |
| 1 | Dựng dữ liệu VĐV | Tạo **User(pending_otp) + Athlete + TeamMember(có athlete_id)** cho mỗi VĐV |
| 2 | Cấu trúc template | **1 sheet phẳng `Athletes`** + `_META` (+ `Huong_dan`) |
| 3 | Re-import | **Upsert** theo khoá mục 6 |
| 4 | Khoá định danh | `email` chính; `phone` chỉ là thông tin |
| 5 | Người giám hộ | Lấy **đủ** thông tin text; tạo `GuardianRequest(approved)` |
| 6 | Provenance giám hộ | Đủ thông tin ⇒ bỏ qua xác minh riêng; set `guardian_source=SPORT_DEPARTMENT_IMPORT`, `status=approved`, `guardian_verified_by=department_roster_import` |

## 8. Hạ tầng cần thêm khi implement (chưa có trong repo)

- Thư viện đọc Excel: **`exceljs`** (chưa cài).
- Endpoint: `POST /api/admin/tournaments/:id/import-roster` (multipart, audience `admin`).
- Service mới: `tournament-roster-import.service.ts`.
- Validator: dùng `createValidator` + check MIME `.xlsx` (đã có trong `src/constants/upload.ts`).
- File mẫu Sở tải về: `template-roster.v1.xlsx` (đã có trong thư mục này).
- **Schema mới trên `guardian_requests`** (migration + model):
  - `guardian_source` — enum `GuardianSource { SELF_REQUEST, SPORT_DEPARTMENT_IMPORT, ... }`,
    default `SELF_REQUEST`. Enum thuộc Tier-1 (model-owned), khai trong `GuardianRequest.ts`.
  - `guardian_verified_by` — `STRING` (nullable), set `department_roster_import` khi import.
  - (`guardian_status` dùng lại cột `status` hiện có với giá trị `approved`.)
  - Tên cột/bảng tham chiếu qua `@constants/database` (`TABLES`, `*_COL`), không hardcode.

## 9. Việc downstream (ghi nhận, không chặn spec)

- VĐV < 18 tạo account `status = pending_otp` → **OTP/kích hoạt route về `guardian_email`** thay vì email VĐV.

---

### Artifacts trong thư mục `zandbox/templates/`
| File | Mô tả |
| --- | --- |
| `template-roster.v1.xlsx` | File mẫu Sở điền (3 sheet: Athletes / _META / Huong_dan) |
| `roster-import.spec.md` | Tài liệu này |
| `../scripts/gen-roster-template.py` | Script sinh lại file mẫu (khi bump version) |
