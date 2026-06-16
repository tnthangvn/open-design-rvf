# Wireframe: Quản lý Template AI (Phân cấp Tỉnh/Cụm)

## 1. Header Khu vực (Toolbar)
Vị trí: Ngay dưới Top Header chính của hệ thống.
* **Bộ chọn địa điểm (Tree Select):** 
    * `[Chọn Tỉnh/Thành] (Placeholder: Chọn tỉnh...)`
    * `[Chọn Cụm sân] (Placeholder: Chọn cụm sân...)`
* **Nhóm công cụ thao tác (Right-aligned):**
    * `[📥 Import]` (Dropdown: "Import từ File", "Tải Template Mẫu")
    * `[⬇️ Export]` (Xuất danh sách hiện tại)
    * `[➕ Thêm mới]` (Primary Button)

## 2. Bảng Danh sách (Data Table)
Hiển thị các Template AI hiện có.

| Trạng thái | Tên Template | Loại AI | Phạm vi (Scope) | Ngày cập nhật | Thao tác |
|:---|:---|:---|:---|:---|:---|
| [Switch] | Cấu hình giá T7 | Dynamic Price | Cụm sân | 16/06/2026 | `[✏️ Sửa]` `[🗑️ Xóa]` |
| [Switch] | Nội dung khuyến mãi | Marketing | Tỉnh | 15/06/2026 | `[✏️ Sửa]` `[🗑️ Xóa]` |

* **Tính năng bảng:**
    * **Batch Actions:** Khi chọn Checkbox các dòng -> Hiện thanh "Bulk Action" (Xóa / Chuyển đổi scope).
    * **Empty State:** Nếu chưa có dữ liệu, hiển thị hình minh họa + Nút `[Tạo template đầu tiên]`.

## 3. Drawer / Modal (CRUD Form)
Giao diện trượt từ cạnh phải khi thêm/sửa template.

### A. Thông tin cơ bản
* **Tên Template:** [Input Text]
* **Loại cấu hình:** [Dropdown - Ví dụ: Marketing, Pricing, Operation]
* **Scope:** 
    * [Radio] Tỉnh (Áp dụng cho toàn tỉnh)
    * [Radio] Cụm sân (Áp dụng cho sân được chọn)

### B. Cấu hình nội dung (Editor)
* **Trình soạn thảo:** [Monaco/Ace Editor - Hỗ trợ JSON/Markdown/Prompt Text]
* **Công cụ bổ trợ:**
    * `[📋 Copy từ template khác]`
    * `[🔍 Preview kết quả AI]` (Popup nhỏ hiển thị kết quả test)

### C. Footer Drawer
* `[Hủy bỏ]` (Secondary) | `[Lưu cấu hình]` (Primary)

---

## 4. Ghi chú kỹ thuật cho Dev
1. **Inheritance Logic:** 
   - Template cấp "Tỉnh" luôn có độ ưu tiên thấp hơn "Cụm sân".
   - UI cần hiển thị nhãn `[Inherited]` cho các template kế thừa từ Tỉnh để người dùng phân biệt.
2. **Download Template (File mẫu):** 
   - Cần cấu trúc: `id`, `template_name`, `type`, `prompt_content`, `is_active`.
   - Định dạng: `.xlsx` hoặc `.json`.
3. **Import Logic:** 
   - Cần bước **Preview** dữ liệu trước khi commit. 
   - Nếu trùng `template_name`, hiển thị cảnh báo `[Ghi đè]` hoặc `[Bỏ qua]`.