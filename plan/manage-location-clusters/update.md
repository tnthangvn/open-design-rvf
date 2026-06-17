# Prompt cho Claude — Update UI filter Tỉnh/Thành phố màn Quản lý cụm sân

## Bối cảnh

Dự án Rồng Việt đang có màn **Quản lý cụm sân** trong khu vực Admin/Quản trị.

Màn hiện tại đã có:

- Danh sách cụm sân / nhà thi đấu.
- Search theo tên cụm hoặc địa chỉ.
- Filter môn thể thao dạng chip: Tất cả môn, Cầu lông, Tennis, Bóng rổ, Bóng chuyền, Futsal...
- Hiển thị tổng số cụm sân, số sân thi đấu, số cụm đang mở.
- Các action: Tải file mẫu, Import Excel, Thêm cụm.
- Mỗi dòng hiển thị: sơ đồ sân, tên cụm, mã code, địa chỉ, tọa độ, môn thể thao, số sân, trạng thái mở/đóng, sửa/xóa.

Cần update UI để danh sách có thể lọc theo **Tỉnh/Thành phố**, phù hợp khi hệ thống import dữ liệu từ Sở hoặc quản lý thư viện cụm sân toàn quốc.

---

## Mục tiêu update

Bổ sung filter **Tỉnh/Thành phố** vào khu vực filter của màn Quản lý cụm sân.

Filter này giúp Admin/BTC/Sở dễ lọc cụm sân theo địa bàn, tránh phải tìm thủ công khi dữ liệu tăng lên nhiều tỉnh thành.

---

## Yêu cầu UI

### 1. Vị trí filter

Đặt filter Tỉnh/Thành phố ngay sau ô search và trước nhóm filter môn thể thao.

Thứ tự đề xuất:

```text
[Search tên cụm hoặc địa chỉ] [Tỉnh/Thành phố ▼] [Tất cả môn] [Cầu lông] [Tennis] ...
```

Không đặt filter tỉnh/thành ở cuối hàng vì đây là filter phân vùng dữ liệu chính.

---

### 2. Component

Dùng component **dropdown multi-select**.

Label / placeholder mặc định:

```text
Tất cả tỉnh/thành
```

Khi mở dropdown, hiển thị:

```text
Tìm tỉnh/thành...

[ ] Chọn tất cả
[ ] Hà Nội
[ ] TP. Hồ Chí Minh
[ ] Đà Nẵng
[ ] Hải Phòng
...
```

Yêu cầu trong dropdown:

- Có ô search nội bộ để tìm nhanh tỉnh/thành.
- Có checkbox chọn từng tỉnh/thành.
- Có action **Chọn tất cả**.
- Có action **Bỏ chọn tất cả** khi đang có tỉnh được chọn.
- Danh sách tỉnh/thành lấy từ master administrative units của hệ thống, không hardcode trực tiếp trong component nếu dự án đã có source dữ liệu chung.

---

### 3. Logic hiển thị selected state

Khi chưa chọn tỉnh nào:

```text
Tất cả tỉnh/thành
```

Khi chọn 1 tỉnh:

```text
Đà Nẵng
```

Khi chọn nhiều tỉnh:

```text
Đà Nẵng +2
```

Hoặc nếu component hiện tại phù hợp hơn, có thể dùng:

```text
Đã chọn 3 tỉnh/thành
```

Ưu tiên cách hiển thị gọn, không làm vỡ layout filter row.

---

### 4. Logic filter

Rule bắt buộc:

```text
Không chọn tỉnh nào = không áp dụng filter tỉnh/thành = hiển thị tất cả.
Chọn 1 hoặc nhiều tỉnh = chỉ hiển thị cụm sân thuộc các tỉnh đã chọn.
Chọn tất cả = tick toàn bộ tỉnh/thành, kết quả tương đương hiển thị tất cả.
Bỏ chọn tất cả = clear selected provinces, quay về trạng thái Tất cả tỉnh/thành.
```

Filter tỉnh/thành phải kết hợp được với các filter hiện có:

- Search keyword.
- Môn thể thao.
- Trạng thái mở/đóng.
- Loại mặt sân nếu đang có filter loại mặt sân.

Ví dụ:

```text
Search = "Hòa Xuân"
Province = Đà Nẵng
Sport = Cầu lông
Status = Đang mở
=> Chỉ hiển thị cụm sân thỏa tất cả điều kiện trên.
```

---

## Yêu cầu dữ liệu

### 1. Field cần có trong venue cluster

Mỗi cụm sân nên có field phục vụ filter địa bàn:

```ts
province_code?: string
province_name?: string
```

Nếu hiện tại dữ liệu chỉ có `address`, không nên parse tỉnh/thành từ string địa chỉ ở FE. Nên yêu cầu BE/API trả về province field rõ ràng.

### 2. Danh sách tỉnh/thành

Dùng danh sách hành chính hiện tại của Việt Nam theo source master của hệ thống.

Nếu chưa có API/source chung, tạm thời tạo constant riêng nhưng phải để dễ thay bằng API sau này.

Gợi ý interface:

```ts
type ProvinceOption = {
  code: string
  name: string
}
```

### 3. State filter đề xuất

```ts
const selectedProvinceCodes = ref<string[]>([])
```

Không dùng single string vì cần hỗ trợ multi-select.

---

## Responsive

### Desktop

Hiển thị cùng hàng với search và filter môn thể thao.

Nếu không đủ chiều ngang, filter môn thể thao có thể wrap xuống dòng, nhưng search và tỉnh/thành nên nằm ở nhóm đầu.

### Mobile / tablet nhỏ

Có thể chuyển filter thành layout dạng stack:

```text
[Search]
[Tỉnh/Thành phố]
[Filter môn]
```

Dropdown vẫn phải dễ bấm, không bị tràn màn hình.

---

## Empty state

Khi filter không có kết quả, hiển thị message rõ ràng:

```text
Không tìm thấy cụm sân phù hợp với bộ lọc hiện tại.
```

Có nút:

```text
Xóa bộ lọc
```

Nút này clear:

- Search keyword.
- Province selected.
- Sport selected.
- Status/surface filters nếu có.

---

## UX copy đề xuất

| Thành phần | Text |
|---|---|
| Placeholder dropdown | Tất cả tỉnh/thành |
| Search trong dropdown | Tìm tỉnh/thành... |
| Select all | Chọn tất cả |
| Clear all | Bỏ chọn tất cả |
| Selected nhiều tỉnh | Đã chọn {n} tỉnh/thành |
| Empty result | Không tìm thấy cụm sân phù hợp với bộ lọc hiện tại. |
| Clear filters | Xóa bộ lọc |

---

## Acceptance criteria

- [ ] Màn Quản lý cụm sân có thêm dropdown filter Tỉnh/Thành phố.
- [ ] Dropdown nằm sau ô search và trước filter môn thể thao.
- [ ] Dropdown hỗ trợ multi-select.
- [ ] Có search trong dropdown.
- [ ] Có Chọn tất cả / Bỏ chọn tất cả.
- [ ] Mặc định không chọn tỉnh nào và hiển thị tất cả cụm sân.
- [ ] Chọn 1 tỉnh chỉ hiển thị cụm sân thuộc tỉnh đó.
- [ ] Chọn nhiều tỉnh hiển thị cụm sân thuộc bất kỳ tỉnh nào trong danh sách đã chọn.
- [ ] Filter tỉnh kết hợp đúng với search keyword và filter môn thể thao hiện có.
- [ ] Empty state hiển thị đúng khi không có kết quả.
- [ ] Responsive không vỡ layout trên tablet/mobile.
- [ ] Không hardcode logic parse tỉnh từ địa chỉ string ở FE nếu API có thể trả `province_code` / `province_name`.

---

## Ghi chú triển khai

- Không thay đổi layout tổng thể của màn nếu không cần thiết.
- Không phá style hiện tại: button bo góc, chip filter, spacing và typography nên đồng bộ với UI đang có.
- Nếu đã có component select/dropdown dùng chung trong hệ thống, ưu tiên reuse.
- Nếu phải thêm component mới, đặt tên rõ nghĩa, ví dụ `ProvinceMultiSelect` hoặc `AdministrativeUnitFilter`.
- Nếu dữ liệu venue cluster hiện tại chưa có province field, cần mock field này trong data mẫu để UI hoạt động, đồng thời note BE cần bổ sung field thật.

---

## Kỳ vọng sau update

Admin có thể lọc nhanh danh sách cụm sân theo địa bàn, ví dụ:

```text
Đà Nẵng + Cầu lông
TP. Hồ Chí Minh + Tennis
Hà Nội + Futsal + Đang mở
```

Việc này giúp màn Quản lý cụm sân phù hợp hơn với mô hình dữ liệu toàn quốc và quy trình import dữ liệu từ Sở.
