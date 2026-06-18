# Prompt triển khai — Import roster cho giải khép kín do Sở cung cấp

Bạn đang cập nhật màn import hiện tại của Rồng Việt.

## Mục tiêu

Đổi scope từ “Import giải đấu” sang “Import danh sách VĐV/đội từ Sở cung cấp”.

Màn này chỉ import roster cho một Tournament đã được tạo qua wizard tạo giải 5 bước:

1. Thông tin
2. Chọn hình thức thi đấu
3. Cấu hình
4. Cài đặt bổ sung
5. Xác nhận & tạo giải


## Flow MVP bắt buộc

Không đưa upload Excel trực tiếp vào wizard tạo giải 5 bước trong MVP.

Trong wizard tạo giải, chỉ thêm field ở **Step 4 — Cài đặt bổ sung**:

```text
Nguồn danh sách tham gia:
- Mở đăng ký công khai
- Danh sách do Sở cung cấp / giải khép kín
```

Nếu chọn **Danh sách do Sở cung cấp / giải khép kín**:

```text
privacy = PRIVATE
public_registration = false
registration_source = DEPARTMENT_ROSTER
registration_approval_mode = AUTO_APPROVED_BY_DEPARTMENT
```

Không hiển thị CTA **Mở đăng ký** sau khi tạo giải. Thay vào đó, sau khi tạo giải thành công phải điều hướng sang màn Import roster của tournament vừa tạo.

Step 5 vẫn là bước **Xác nhận & tạo giải** như hiện tại.

Sau khi tạo giải thành công:

```text
Nếu registration_source = PUBLIC_REGISTRATION
→ đi theo flow hiện tại / mở đăng ký công khai.

Nếu registration_source = DEPARTMENT_ROSTER
→ redirect sang màn Import roster của tournament vừa tạo.
```

Màn Import roster là flow riêng sau khi đã có `tournament_id`:

```text
1. Tải file mẫu
2. Upload & kiểm tra
3. Xem trước danh sách tham gia
4. Xác nhận import
```

File Excel chỉ import danh sách VĐV/đội/đôi và thông tin giám hộ. File Excel không tạo Tournament, không cập nhật config giải, không tạo bracket, không tạo lịch đấu.

## Các setting tạo giải vẫn giữ nguyên

Không bỏ các setting hiện tại trong wizard tạo giải. Với mode **Danh sách do Sở cung cấp**, các setting này vẫn là source of truth để validate file import sau khi tạo giải:

- sport
- competition type / loại thi đấu
- format
- min/max teams hoặc min/max participants
- team_size
- BO / scoring config
- số vòng Swiss
- số bảng Group → KO
- age/gender rule
- thời gian tổ chức
- prize/fee nếu sản phẩm vẫn cho cấu hình

Excel không được override các setting này. Nếu `_META` hoặc dữ liệu trong Excel không khớp config Tournament, hiển thị lỗi/warning ở bước Upload & kiểm tra.

## Quy tắc nghiệp vụ bắt buộc

- Không tạo Tournament từ Excel.
- Không ghi đè thông tin giải đã tạo.
- Không ghi đè sport, gender, age, format, bracket config, scoring config, fee, prize, privacy.
- Không tạo bracket/cây giải.
- Không tạo lịch đấu.
- Không tạo vòng Swiss.
- Sau import chỉ tạo/upsert dữ liệu roster:
  - User
  - Athlete
  - TournamentTeam
  - TeamMember
  - GuardianRequest
- Bracket/lịch đấu vẫn tạo bằng flow “Tạo sơ đồ thi đấu” sau khi roster hợp lệ.

## Mapping với wizard tạo giải

### Step 1 — Thông tin

Các field như môn thể thao, giới tính, độ tuổi, ngày bắt đầu/kết thúc là source of truth.

Excel `_META.sport_slug`, `_META.gender`, `_META.age` chỉ dùng để validate mismatch.

### Step 2 — Chọn hình thức thi đấu

Tournament.format là source of truth.

Excel `_META.format` chỉ dùng để kiểm tra file có đúng giải/format không.

Hỗ trợ validate theo:

- KNOCKOUT
- ROUND_ROBIN
- GROUP_KNOCKOUT
- SWISS

### Step 3 — Cấu hình

Dùng config đã lưu từ wizard để validate roster:

- Knockout: số đội, power of 2 nếu bắt buộc, seed nếu xếp nhánh theo hạt giống/thủ công.
- Round Robin: số đội, không tạo lịch vòng tròn.
- Group → KO: group_name bắt buộc nếu Sở chia bảng sẵn; số bảng và số đội mỗi bảng phải khớp config.
- Swiss: số đội/người phải khớp; không tạo vòng/pairing/standings.

### Step 4 — Cài đặt bổ sung

Nếu nguồn danh sách là Sở cung cấp:

- privacy nên là PRIVATE.
- không cần mở đăng ký công khai.
- registration_status của team import là APPROVED.
- status của team import là active.

### Step 5 — Xác nhận & tạo giải

Sau khi tạo giải thành công, nếu nguồn danh sách là Sở cung cấp, CTA nên điều hướng sang màn import roster:

```text
Import danh sách Sở cung cấp
```

Không ưu tiên CTA “Mở đăng ký”.

## Sửa copy UI

### Menu

Đổi:

```text
Import giải đấu
```

thành:

```text
Import danh sách
```

hoặc:

```text
Import roster
```

### Header

```text
Import danh sách VĐV/đội từ Sở cung cấp
```

### Subtitle

```text
Upload file template .xlsx đã được sinh theo cấu hình giải. Hệ thống chỉ import danh sách tham gia, đội/đôi và thông tin giám hộ; bracket/lịch đấu sẽ được tạo ở bước riêng sau khi danh sách được xác nhận.
```

### Badge

Thêm badge:

```text
Không tạo bracket
```

### Stepper

Dùng:

```text
1. Tải file mẫu
2. Upload & kiểm tra
3. Xem trước danh sách tham gia
4. Xác nhận import
```

Không dùng:

```text
Xem trước cây giải
```

## Rule Excel

- Header 2 dòng.
- Dòng 1 = nhãn tiếng Việt.
- Dòng 2 = key máy snake_case.
- Importer đọc theo key, không đọc theo vị trí cột.
- Sheet `Athletes`: 1 dòng / 1 VĐV.
- Đội/đôi suy ra bằng `team_ref`.

Required fields:

```text
team_ref
full_name
dob
gender
email
```

Nếu VĐV dưới 18 tuổi, bắt buộc:

```text
guardian_name
guardian_relation
guardian_phone
guardian_email
```

## Guardian rule

Dữ liệu guardian từ file Sở, nếu hợp lệ, được tạo:

```text
GuardianRequest.status = approved
GuardianRequest.source = SPORT_DEPARTMENT_IMPORT
requires_reconfirmation = false
```

Không yêu cầu guardian xác nhận lại trong bước import.

Chỉ đưa vào review/xác nhận lại nếu thiếu field, sai format, dữ liệu bất thường hoặc re-import thay đổi guardian.

## Preview

Bước preview phải hiển thị:

- Tổng VĐV.
- Tổng đội/đôi.
- Số VĐV dưới 18.
- Số guardian sẽ tạo/cập nhật.
- Số bảng nếu có.
- Số lỗi/warning.
- Bảng đội/đôi.
- Bảng VĐV.
- Bảng lỗi.

Không hiển thị bracket/cây giải.

## Sau import thành công

Hiển thị:

```text
Import danh sách thành công. Bracket/lịch đấu chưa được tạo. Vui lòng quay lại chi tiết giải và dùng chức năng “Tạo sơ đồ thi đấu” khi đã sẵn sàng.
```

CTA:

```text
Quay lại chi tiết giải
```

và nếu đủ điều kiện:

```text
Tạo sơ đồ thi đấu
```
