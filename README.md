# HUST Assistant — Frontend

Giao diện Next.js App Router, TypeScript và Tailwind, dựng theo mẫu khung chat HUST.

## Chạy local

Yêu cầu Node.js 22 và pnpm 10.33.0.

```powershell
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm.cmd dev
```

Nếu chưa có pnpm, dùng `npm.cmd exec --yes --package=pnpm@10.33.0 -- pnpm <lệnh>`.
Mở http://localhost:3000.

## Deploy lên Vercel

1. Import repo `20235932-hieubt/HustVA-FE` vào Vercel.
2. Chọn framework **Next.js**, Root Directory là thư mục gốc repo (`./`). Repo này chỉ chứa frontend.
3. Dùng Node.js 22 và lệnh cài đặt `pnpm install --frozen-lockfile`, lệnh build `pnpm build`.
4. Thêm biến `NEXT_PUBLIC_API_URL` với URL backend HTTPS thực tế, có đuôi `/api/v1`, trước khi deploy. Không dùng địa chỉ `localhost` trên môi trường cloud.
5. Ở backend, đặt `WEB_ORIGIN` bằng origin Vercel của frontend để cho phép kết nối từ trình duyệt.
6. Deploy rồi kiểm tra `/chat`, `/embed`, `/widget.js` và `/tools`.

Frontend cần backend đang chạy để gửi tin, tải lịch sử và quản lý tool. Không đưa khóa HUST, khóa model hoặc token quản trị vào biến `NEXT_PUBLIC_*`. File `.env.local` chỉ dùng trên máy cá nhân, không đưa lên GitHub.

## Giao diện và tích hợp

- Khung chat mặc định mở, kích thước desktop 368 × 590 px; co theo màn hình trên mobile.
- Nút đóng chuyển về nút robot tròn; phím Escape để đóng.
- Enter gửi tin, Shift+Enter xuống dòng; tối đa 4.000 ký tự.
- Tạo phiên và gửi tin qua API thật, hiển thị phản hồi, nguồn trích dẫn, cảnh báo và lỗi kết nối.
- Nút đồng hồ bật/tắt cột lịch sử bên trái: nhóm theo tháng, tiêu đề từ câu hỏi đầu tiên, số tin nhắn và hội thoại đang chọn. Chọn một hội thoại để tải tin nhắn từ backend, có phân trang.
- Nút “Cuộc trò chuyện mới” mở khung chat trống; phiên backend được tạo khi gửi câu hỏi đầu tiên. Các phiên cũ vẫn giữ trong danh sách đến khi hết hạn.
- Danh sách hội thoại và thông tin phiên lưu trong sessionStorage của tab. Chưa có lịch sử theo tài khoản hoặc đồng bộ giữa thiết bị vì backend chưa cung cấp API tương ứng. Không hiển thị mã sinh viên giả từ ảnh mẫu.
- Nút mũi tên mở `/chat` trong tab mới với giao diện toàn màn hình và cột lịch sử mở sẵn. Phiên trong sessionStorage được sao chép sang tab mới khi trình duyệt cho phép; không truyền token qua URL. Hai tab hoạt động độc lập sau khi mở.
- Nút đồng hồ chỉ thêm/bớt cột lịch sử rộng 250 px cạnh box chat. Box chat giữ chiều cao 590 px và chiều rộng nội dung 368 px khi màn hình đủ rộng. Trên mobile, lịch sử hiện dạng ngăn kéo và tự đóng sau khi chọn hội thoại.
- Backend hiện chỉ nhận văn bản. Nút đính kèm thông báo chưa hỗ trợ gửi ảnh.

Cấu hình `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Khi deploy, đặt `NEXT_PUBLIC_API_URL=https://api.example.com/api/v1` trên hosting
**trước khi build**. Biến `NEXT_PUBLIC_*` được đóng vào bundle trình duyệt; thay
giá trị cần build/deploy lại. Nếu dùng reverse proxy cùng origin, đặt `/api/v1`
và cấu hình proxy chuyển đường dẫn đó tới backend. Khi không đặt biến, frontend
mặc định gọi `/api/v1`; Next.js không tự tạo proxy.

Ở backend, đặt `API_ORIGIN=https://api.example.com`,
`WEB_ORIGIN=https://chat.example.com` và `HOST=0.0.0.0` khi cần nhận kết nối từ
hosting/container. `API_ORIGIN` và `WEB_ORIGIN` không chứa `/api/v1`.

Chạy backend tại cổng 4000 với cấu hình dịch vụ và cơ sở dữ liệu theo tài liệu của `be`. `WEB_ORIGIN` phía backend cần khớp origin frontend (mặc định http://localhost:3000). Frontend có thể hiển thị độc lập; gửi tin và tải lịch sử cần backend hoạt động. Không đặt bí mật trong biến `NEXT_PUBLIC_*`.

API sử dụng:

- `POST /api/v1/chat/conversations` với body `{}`.
- `POST /api/v1/chat/conversations/:id/messages` với `{ requestId, message }`.
- `GET /api/v1/chat/conversations/:id/messages?limit=50&offset=0`.

Các yêu cầu vào phiên gửi `Authorization: Bearer <token>`. Không tự động gửi lại tin khi lỗi để tránh tạo thêm lượt xử lý. Có thể bấm lịch sử để kiểm tra kết quả trước khi gửi lại.

## Nhúng vào website khác

Mở **http://localhost:3000/embed-demo.html** để thử widget trên trang demo.
Widget mặc định chỉ hiện nút robot; bấm để mở khung chat. Script tạo iframe riêng,
không cần cài React trên website chủ.

Chèn trước `</body>` của website cần tích hợp:

```html
<script
  src="http://localhost:3000/widget.js"
  data-position="bottom-right"
  data-open="false"
  defer
></script>
```

Đổi `data-position` thành `bottom-left` để đặt bên trái, `data-open` thành `true`
để mở ngay. Sau khi deploy, thay origin trong `src` bằng HTTPS của dịch vụ chatbot.
`/embed` và `/widget.js` phải được phục vụ từ cùng origin. Nếu website dùng CSP,
cho phép origin chatbot trong `script-src` và `frame-src`; cấu hình hosting chatbot
phải cho phép website chủ nhúng iframe.

Để thử với hai origin khác nhau, chạy lệnh sau trong một terminal thứ hai ở thư mục `fe`:

```powershell
python -m http.server 8080 --directory public --bind 127.0.0.1
```

Mở **http://127.0.0.1:8080/embed-demo.html?widgetOrigin=http://localhost:3000**.
Trang demo tải từ cổng 8080, widget tải từ Next.js tại cổng 3000.

Iframe chỉ trao đổi trạng thái mở/đóng/mở rộng qua `postMessage`, kiểm tra cả origin
và cửa sổ gửi. Token và nội dung trò chuyện không được gửi cho website chủ.
API vẫn được gọi từ origin frontend bên trong iframe nên không cần cho phép tất cả
website chủ trong CORS backend. Phiên lưu trữ trong iframe tùy chính sách lưu trữ
của trình duyệt; nếu sessionStorage bị chặn, phiên vẫn hoạt động trong bộ nhớ cho
đến khi iframe bị tải lại.

Khi triển khai, cấu hình endpoint theo phần trên và sử dụng HTTPS cho frontend/backend.
Script nhúng tự lấy origin từ `src`, không cần sửa mã `widget.js` để đổi domain.

## Kiểm tra widget

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
```

Các file kiểm thử đã được chuyển ra ngoài repo tại `../kiem-thu/fe`, giữ nguyên nội dung để tham khảo hoặc khôi phục khi cần. Lệnh test tương ứng đã được bỏ khỏi package và CI.

## Tool management

Mở `/tools` để quản lý **5 tool dữ liệu dùng chung** của giai đoạn 1: học kỳ,
điều kiện học tiếp, chương trình kỹ sư chuyên sâu, tìm giảng viên và tìm công ty.
Trang cho xem schema, bật/tắt, chỉnh timeout/retry, xem metrics và gọi thử bằng JSON.
Không còn thao tác cache học phần, workflow hoặc tool dữ liệu sinh viên.

Trang dùng cùng `NEXT_PUBLIC_API_URL` với chatbot. Backend cần 3 biến kết nối
HUST Partner và `TOOL_MANAGEMENT_TOKEN` ít nhất 32 ký tự;
xem [backend README](../be/README.md).

Nhập token quản trị tại trang đăng nhập. Không đưa token vào `NEXT_PUBLIC_*`.
Token và kết quả chỉ giữ trong RAM; đăng xuất hoặc tải lại trang xóa phiên.
Chatbot dùng LLM để hiểu câu hỏi, chọn một trong 5 tool và tham số. Có thể hỏi:
“Học kỳ hiện tại là gì?”, “Điều kiện học thạc sĩ là gì?”, “Chương trình kỹ sư chuyên
sâu của IT1”, “Tìm giảng viên tên Nguyễn”, “Tìm công ty FPT”. Thiếu từ khóa/mã ngành
sẽ được hỏi lại. Tắt tool trong management có hiệu lực ở lượt chat tiếp theo.
Các lượt HUST trả `retrievalMode: hust_api`. LLM nhận câu hỏi hiện tại đã qua bước
giả danh; kết quả API không gửi sang Gemini. Chat cần cấu hình model để chọn tool.
Cần hỏi đầy đủ trong một câu; chưa hỗ trợ nối tiếp kiểu “công ty đó”.

## Đăng nhập demo để tra cứu điểm

Trang chứa chatbot có khu vực đăng nhập demo bên ngoài box chat. Sau đăng nhập,
Góc phải thanh “LỊCH SỬ” hiển thị MSSV từ mapping tài khoản do backend trả về,
đúng vị trí trong ảnh thiết kế. Thanh tiêu đề chính chỉ có logo, tên bot và các icon.
Đăng nhập/đăng xuất thực hiện trên trang chính. Trang `/chat` giữ bố cục toàn
màn hình theo ảnh mẫu; khách đăng nhập từ khu vực tài khoản trên trang chính.
Dùng tài khoản do nhóm cấp; không nhập mật khẩu Microsoft/HUST. Không có
đăng ký công khai. Khách vẫn hỏi thông tin công khai được.

Backend cần `DEMO_AUTH_ENABLED=true`, file mapping tài khoản–MSSV hợp lệ,
`CHAT_GRADES_ENABLED=true` và hai tool điểm được bật trong management. Xem phần
“Đăng nhập demo” trong [backend README](../be/README.md). Frontend chỉ cần
`NEXT_PUBLIC_API_URL` trỏ tới backend `/api/v1`; không đưa tài khoản, MSSV mapping,
HUST token hoặc secret vào biến NEXT_PUBLIC.

Ví dụ local: frontend `http://localhost:3000`, API
`http://localhost:4000/api/v1`; backend WEB_ORIGIN là `http://localhost:3000` và
API_ORIGIN là `http://localhost:4000`. Giữ cùng hostname `localhost` ở cả hai bên.
Production phải HTTPS và frontend/API cùng site; bản demo không hỗ trợ đăng nhập
dựa trên cookie bên thứ ba trong iframe website khác.

Auth API dùng `credentials: include`; cookie HttpOnly do browser quản lý và
không đọc bằng JavaScript. Authorization bearer của conversation được giữ riêng.
Login/logout đổi giao diện tài khoản và xóa nội dung đang hiển thị; request cũ bị
abort, phản hồi muộn bị loại. Capability/index lưu trong sessionStorage theo
accountId hoặc guest, không theo MSSV; không đọc lại storage legacy tự động.
Điểm phản hồi chỉ nằm trong RAM. Refresh chỉ khôi phục thông báo history, không
khôi phục bảng điểm từ backend.

Phiên được kiểm tra lại khi focus, mỗi 30 giây và trước thao tác chat. Hết hạn
hoặc đổi tài khoản sẽ thay phiên hiển thị. Các tab đồng bộ sự kiện login/logout
bằng BroadcastChannel khi browser hỗ trợ, kèm kiểm tra lại `/me`. Backend vẫn
quyết định quyền truy cập. Chat embed gửi `credentials: omit`, chỉ dùng chế độ
công khai; nút mở rộng có sẵn mở trang chat trực tiếp. Không truyền
cookie/token qua postMessage.

Checklist kiểm tra browser bằng tài khoản/MSSV giả lập và mock upstream:

1. Guest hỏi thông tin công khai; yêu cầu điểm nhắc đăng nhập.
2. Login A, hỏi “xem điểm của tôi” không kèm MSSV; hỏi MSSV khác bị chặn.
3. Refresh vẫn đúng tài khoản nhưng không phục hồi điểm trực tiếp từ history.
4. Logout rồi login B không hiện hội thoại/điểm A. Thử logout ở tab khác.
5. Cho upstream trả chậm, logout trong khi chờ: không nhận điểm cũ sau đổi phiên.
6. Kiểm tra iframe chỉ có chat công khai và nút mở trang chat trực tiếp.

Test/fixture/runner chỉ giữ tại `../kiem-thu/fe/demo-auth`, không commit/push.
Các test transport/storage dùng mock fetch; vẫn cần kiểm tra đầy đủ browser trên
môi trường triển khai và các tài khoản đã được cấp phép trước buổi demo dữ liệu thật.

## Responsive chatbot

Phản hồi bot được render bằng `react-markdown` và `remark-gfm`, hỗ trợ đoạn văn,
tiêu đề, in đậm, danh sách và bảng cuộn ngang. Chỉ render Markdown của bot;
nội dung người dùng giữ dạng text. Không render HTML thô hoặc ảnh từ phản hồi;
link chỉ nhận HTTP(S), mở tab mới với noopener/noreferrer. Nguồn từ citations
hiển thị thành danh sách đánh số riêng, khớp các số trích dẫn trong câu trả lời.

Bố cục desktop giữ theo ảnh mẫu. Khi box rộng tối đa 650px, lịch sử mở dạng
ngăn trượt phủ trên chat, có nền phủ để chạm đóng và hỗ trợ Escape. Box rộng
tối đa 400px dùng header/ô nhập gọn hơn và cỡ chữ nhập 16px. Trên điện thoại,
chat trực tiếp phủ vùng nhìn thấy; form đăng nhập ngoài box xếp thành một cột.
VisualViewport cập nhật chiều cao/vị trí khi bàn phím mở hoặc viewport thay đổi;
iframe loader cũng theo dõi resize/scroll. Footer có khoảng đệm safe area.
