/**
 * ============================================================
 * HỆ THỐNG QUẢN LÝ TỒN KHO DĂM - HAK GROUP - v2026.8
 * ------------------------------------------------------------
 * Web App thay thế Google Form "Cập nhật tồn kho dăm hàng ngày" +
 * cung cấp Dashboard tổng hợp + Lịch sử + Nhật ký (Audit).
 *
 * CÁCH CÀI ĐẶT:
 *  1. Mở Google Sheet "Cập nhật tồn kho dăm hàng ngày (Responses)".
 *  2. Extensions > Apps Script.
 *  3. Tạo/thay file "Code.gs" bằng nội dung file này.
 *  4. Tạo file HTML tên đúng là "Index" (không dấu ngoặc), dán nội
 *     dung file Index.html đi kèm vào.
 *  5. Deploy > New deployment > Web app > Execute as: Me, Access:
 *     tùy nhu cầu (khuyến nghị "Anyone within [tổ chức]").
 *  6. Nếu vẫn muốn giữ Google Form cũ chạy song song, có thể giữ
 *     nguyên trigger onFormSubmit ở file cũ - 2 nguồn ghi cùng 1
 *     sheet "Form Responses 1" không xung đột vì cùng schema cột.
 *
 * GHI CHÚ THIẾT KẾ QUAN TRỌNG (khác với code onFormSubmit cũ):
 *  A) VALIDATE TRƯỚC KHI GHI (không còn kiểu "ghi rồi xóa rồi gửi
 *     mail" như trigger cũ) - vì đây là Web App tương tác trực tiếp,
 *     kiểm tra ngay khi bấm Lưu và báo lỗi tức thì cho người dùng,
 *     không cần chèn dòng rồi xóa hay gửi email.
 *  B) THÊM QUY TẮC "MỖI EMAIL CHỈ ĐƯỢC NHẬP 1 LẦN / NGÀY" - quy tắc
 *     này đã thấy xuất hiện trong lịch sử sheet "Audit" thực tế
 *     (lý do "Mỗi email chỉ được nhập 1 lần mỗi ngày") nhưng KHÔNG
 *     có trong đoạn code onFormSubmit cũ được cung cấp - có thể bản
 *     code cũ đã được cập nhật thêm ở đâu đó ngoài đoạn được gửi.
 *     Mình bổ sung lại quy tắc này cho khớp với hành vi thực tế đã
 *     ghi nhận trong Audit. Admin vẫn có thể ghi đè (override).
 *  C) TỰ ĐỘNG "KÉO CÔNG THỨC" CHO DÒNG MỚI - sheet "Form Responses 1"
 *     có các cột TỪ Y ĐẾN AK (Độ ẩm_Tiên Sa ... Định mức) là CÔNG
 *     THỨC tính theo từng dòng (không phải 1 ARRAYFORMULA duy nhất).
 *     Khi nộp qua Google Form gốc, Sheets tự "kéo" công thức này
 *     xuống dòng mới (tính năng riêng của Sheets cho sheet Form
 *     Responses). Khi Web App này ghi dòng mới bằng Apps Script,
 *     hành vi tự kéo đó KHÔNG xảy ra mặc định - nên code bên dưới
 *     chủ động copy công thức từ dòng ngay phía trên xuống dòng mới
 *     (xem extendFormulasToNewRow_) để các báo cáo/Tonkho_Damgo phụ
 *     thuộc cột này không bị vỡ.
 *  D) KHÔNG SỬA ĐỔI SHEET "Tonkho_Damgo" - đây là sheet trình bày
 *     dạng báo cáo thủ công (nhiều công thức tham chiếu chéo ô cụ
 *     thể, không phải bảng dữ liệu phẳng) nên Web App KHÔNG ghi hay
 *     đọc trực tiếp từ sheet này.
 *  E) SHEET "Chitiettonkho" (v2026.8.1) - THEO YÊU CẦU MỚI: Google
 *     Form được nộp THOẢI MÁI, không còn bị chặn/xóa dòng khi trùng
 *     Đơn vị+Ngày hay nộp lại nhiều lần/ngày nữa (chỉ còn CẢNH BÁO
 *     bằng cách ghi vào sheet "Audit", KHÔNG xóa dòng nào ở
 *     "Form Responses 1" - sheet này giờ là NHẬT KÝ THÔ, lưu lại MỌI
 *     lần nộp, kể cả các lần nộp lại/sửa cho cùng 1 (Đơn vị, Ngày tồn
 *     kho)). Sheet "Chitiettonkho" là bảng DỮ LIỆU SẠCH được TỰ ĐỘNG
 *     đồng bộ (không cần bấm nút "Duyệt" nào): mỗi (Đơn vị, Ngày tồn
 *     kho) chỉ có ĐÚNG 1 dòng, luôn là dòng có Timestamp MỚI NHẤT
 *     trong số các lần nộp trùng khớp (xem syncChitietTonKhoForKey_).
 *     Cấu trúc cột của "Chitiettonkho" giống hệt "Form Responses 1".
 *     Dashboard/Báo Cáo của Web App đọc dữ liệu từ "Chitiettonkho"
 *     (dữ liệu đã lọc trùng), còn "Lịch Sử" vẫn đọc từ
 *     "Form Responses 1" (đầy đủ, kể cả các lần nộp đã bị thay thế) để
 *     giữ dấu vết cho việc tra soát.
 *     LƯU Ý QUAN TRỌNG: vì "Form Responses 1" đã có ~650 dòng dữ liệu
 *     LỊCH SỬ từ trước khi có sheet "Chitiettonkho", hãy chạy hàm
 *     rebuildAllChitietTonKho() (hoặc bấm nút "Đồng bộ lại Chitiettonkho"
 *     ở Trang chủ, chỉ Admin thấy) MỘT LẦN sau khi triển khai để lấp
 *     đầy dữ liệu cũ vào Chitiettonkho - nếu không, Dashboard/Báo Cáo
 *     sẽ trống cho tới khi có submit mới cho từng (Đơn vị, Ngày).
 *  F) MÀN "NHẬP TỒN KHO" TRÊN WEB APP TỰ CHUYỂN SANG "SỬA" (v2026.8.2) -
 *     THEO YÊU CẦU MỚI: khi người dùng chọn Đơn vị + Ngày tồn kho, Web
 *     App gọi getExistingEntryForKey() kiểm tra Chitiettonkho trước:
 *       - CHƯA có dữ liệu -> form trống, nút "Lưu báo cáo mới".
 *       - ĐÃ có dữ liệu -> form tự điền sẵn giá trị hiện có, nút đổi
 *         thành "Cập nhật báo cáo" - không còn cho tạo dòng "mới" gây
 *         trùng nữa, chỉ còn đường "sửa".
 *     Về phía backend, submitInventoryEntry() không còn CHẶN khi phát
 *     hiện (Đơn vị, Ngày) đã tồn tại nữa (bỏ hẳn thông báo lỗi "chỉ
 *     Admin mới ghi đè được" của các bản trước) - MỌI người dùng (không
 *     riêng Admin) đều sửa được qua đường này. Kỹ thuật vẫn là APPEND 1
 *     dòng MỚI vào "Form Responses 1" (giữ nguyên lịch sử để tra soát,
 *     nhất quán với kiến trúc mục E), Chitiettonkho tự lấy dòng mới
 *     nhất làm chính thức. Giới hạn "1 lần/email/ngày" (mục B) CHỈ còn
 *     áp dụng cho lượt NHẬP MỚI thật sự (chưa có dữ liệu cho ngày đó) -
 *     không áp dụng khi đang SỬA, để không cản trở tự sửa lại trong
 *     cùng ngày.
 *  G) BÁO CÁO KHO THEO ĐÚNG MẪU "Tonkho_Damgo" (v2026.8.3) - THEO YÊU
 *     CẦU MỚI: "Báo Cáo Tổng Hợp" trên Web App phải có thêm 1 báo cáo
 *     dựng lại ĐÚNG cấu trúc thủ công của sheet Tonkho_Damgo (dù mục D
 *     vẫn đúng - Web App KHÔNG đọc/ghi trực tiếp sheet đó). Cấu trúc
 *     dưới đây được xác nhận từ 1 bản Tonkho_Damgo đã điền đầy đủ số
 *     liệu thực tế do người dùng cung cấp (không phải suy đoán):
 *       - Chọn 1 NGÀY TỒN KHO duy nhất (giống ô "Ngày .../.../..." ở
 *         đầu sheet mẫu) - báo cáo là 1 "lát cắt" theo ngày, không phải
 *         theo khoảng thời gian như "Báo Cáo Tổng Hợp" đã có.
 *       - Mục "NHÀ MÁY": 2 bảng con theo 4 đơn vị (CNHAK (QS), Đại Hiệp
 *         (Đại Lộc), HAK (Bà Nà), HAKQN (QS Trung) - ĐÚNG thứ tự này,
 *         khác thứ tự CFG.UNITS) x (Hòa Nhơn/Quế Sơn/Đại Hiệp/HAKQN)
 *         MT+BDMT, và bảng Độ ẩm theo kho HN/QS/ĐH/QC + Độ ẩm TB/Độ khô
 *         TB - lấy thẳng từ các cột cùng tên trong Chitiettonkho.
 *       - Mục "KHO XUẤT HÀNG": Kho Tiên Sa MT/BDMT + Độ ẩm/Độ khô Tiên
 *         Sa theo 4 đơn vị.
 *       - Mục "ĐỊNH MỨC SX": Tồn đầu kỳ/Tồn CK/Mượn trả/CL độ ẩm/Nhập
 *         trong kỳ MT/Định mức theo 4 đơn vị.
 *       - GRAND TOTAL: đối chiếu số liệu mẫu thật cho thấy 2 quy tắc
 *         khác nhau tùy cột: các cột SỐ LƯỢNG (MT/BDMT, tồn kho, nhập
 *         gỗ...) và các cột % "theo từng nguồn/kho" (Độ ẩm kho HN/QS/
 *         ĐH/QC) dùng TỔNG (SUM, khớp công thức gốc "=F23+F22+F21" tìm
 *         thấy trong sheet mẫu); còn các cột % "trung bình/định mức"
 *         (Độ ẩm TB, Độ khô TB, Độ ẩm/Độ khô Tiên Sa, Định mức) dùng
 *         TRUNG BÌNH CỘNG (AVERAGE) - xem hàm getTonkhoDamgoReport().
 *  H) THÊM "KHO DUNG QUẤT" (v2026.8.5) - THEO YÊU CẦU MỚI: thêm 1 kho
 *     xuất hàng nữa (Kho Dung Quất), CHỨC NĂNG VÀ CÁCH TÍNH TỒN KHO
 *     GIỐNG HỆT "Kho Tiên Sa" (MT, BDMT, Độ ẩm, Độ khô). PHƯƠNG ÁN CUỐI
 *     (đã đổi từ ý tưởng ban đầu là chèn giữa sheet): NỐI 4 CỘT MỚI VÀO
 *     CUỐI sheet "Form Responses 1"/"Chitiettonkho" - cho "đỡ rối", 37
 *     cột gốc A-AK GIỮ NGUYÊN VỊ TRÍ (không dịch chuyển bất kỳ cột nào
 *     đang có), chỉ thêm nối tiếp 4 cột AL-AO. AN TOÀN cho ~650 dòng dữ
 *     liệu lịch sử đã có (không có công thức/cột tham chiếu ô cụ thể
 *     nào ở nơi khác bị lệch vị trí).
 *     ------------------------------------------------------------
 *     ⚠️ CODE Ở FILE NÀY CHỈ ĐÚNG SAU KHI ĐÃ TỰ TAY SỬA SHEET THẬT THEO
 *     ĐÚNG THỨ TỰ SAU:
 *       1. Mở sheet "Form Responses 1". Ở CUỐI (ngay sau cột AK "Định
 *          mức"), nhập tiêu đề cho 4 cột mới liền kề: AL="Kho Dung
 *          Quất - MT", AM="Kho Dung Quất - BDMT" (2 cột INPUT thường),
 *          AN="Độ ẩm Kho Dung Quất", AO="Độ khô Kho Dung Quất" (2 cột
 *          CÔNG THỨC).
 *       2. Ở cột AN/AO của 1 dòng đã có dữ liệu Tiên Sa, mở công thức
 *          thật đang dùng cho "Độ ẩm Tiên Sa"/"Độ khô Tiên Sa" (cột Y,
 *          Z) để xem cấu trúc, rồi viết công thức tương tự cho AN/AO
 *          nhưng đổi tham chiếu sang cột AL, AM (Kho Dung Quất MT/BDMT)
 *          thay vì R, S (Kho Tiên Sa MT/BDMT) - ví dụ nếu Z đang là
 *          "=S3/R3" thì AO (Độ khô Dung Quất) nên là "=AM3/AL3" (giữ
 *          nguyên số dòng), AN (Độ ẩm Dung Quất) mirror theo đúng công
 *          thức Y đang dùng. Dán công thức này cho TOÀN BỘ các dòng đã
 *          có dữ liệu (kéo công thức xuống hết) - dòng MỚI về sau, Web
 *          App tự kéo tiếp (xem FORMULA_COL_RANGES bên dưới).
 *       3. XÓA HẲN sheet "Chitiettonkho" hiện có (header cũ chỉ có 37
 *          cột, sai lệch với cấu trúc 41 cột mới) - Web App sẽ tự tạo
 *          lại sheet này với header ĐÚNG 41 cột (copy từ "Form
 *          Responses 1" đã sửa) ở lần gọi kế tiếp. Sau đó vào Trang chủ
 *          (đăng nhập bằng tài khoản Admin) bấm nút "🔄 Đồng bộ lại
 *          Chitiettonkho từ đầu" để build lại đầy đủ từ lịch sử.
 *       4. Vào Google Form gốc, thêm 2 câu hỏi dạng số "Kho Dung Quất -
 *          MT" và "Kho Dung Quất - BDMT" - đặt Ở CUỐI Form (sau câu hỏi
 *          cuối cùng hiện có) để khớp đúng vị trí cột AL, AM vừa thêm.
 *     ------------------------------------------------------------
 *     BẢNG CỘT ĐẦY ĐỦ SAU KHI SỬA (41 cột, A-AO) - khớp đúng object COL
 *     bên dưới: A-AK giữ NGUYÊN như trước (không đổi - xem chi tiết ở
 *     comment ngay trên object COL), cộng thêm AL Kho Dung Quất MT
 *     (MỚI), AM Kho Dung Quất BDMT (MỚI), AN Độ ẩm Kho Dung Quất (MỚI,
 *     công thức), AO Độ khô Kho Dung Quất (MỚI, công thức).
 *     LƯU Ý KỸ THUẬT: vì 2 cột input mới (AL, AM) nằm CHEN GIỮA dải
 *     công thức gốc (Y..AK) và dải công thức Dung Quất (AN..AO), hàm
 *     extendFormulasToNewRow_ (mục C) đã được viết lại để copy công
 *     thức xuống dòng mới theo TỪNG DẢI RIÊNG (xem mảng
 *     FORMULA_COL_RANGES ngay phía trên hàm đó) thay vì 1 dải liền như
 *     trước - để KHÔNG bị copy đè lên 2 cột input AL/AM bằng dữ liệu
 *     dòng trước đó.
 *     ------------------------------------------------------------
 *     ⚠️ RÀ SOÁT CÔNG THỨC CÓ SẴN (đã đối chiếu trực tiếp với người
 *     dùng qua công thức thật lấy từ sheet, KHÔNG suy đoán) - vì
 *     "Tồn kho CK"/"Định mức" là công thức Sheet thủ công (mục D, Web
 *     App không đọc/ghi logic này, chỉ đọc lại giá trị đã tính), CHỈ
 *     phát hiện đúng 1 chỗ CẦN SỬA THỦ CÔNG trên sheet thật (đã sửa hay
 *     chưa cần người dùng tự xác nhận, ngoài phạm vi code này):
 *       - Cột AA "Cộng MT" = SUM(G,I,K,M) (chỉ 4 đơn vị Nhà máy, KHÔNG
 *         gồm Tiên Sa) -> giữ NGUYÊN, không cần sửa.
 *       - Cột AB "Cộng BDMT" = SUM(H,J,L,N) (tương tự AA) -> giữ
 *         NGUYÊN, không cần sửa.
 *       - Cột AI "Tồn kho CK" = AA + R (Cộng MT + Kho Tiên Sa MT) -> CÓ
 *         tính Tiên Sa vào tổng tồn kho, nên PHẢI SỬA để cộng thêm Kho
 *         Dung Quất: công thức mới = "=AA{dòng}+R{dòng}+AL{dòng}" (cộng
 *         thêm AL = Kho Dung Quất MT). Áp dụng cho MỌI dòng (kể cả dòng
 *         lịch sử cũ - AL đang trống = 0 nên cộng thêm vẫn an toàn,
 *         không làm sai số liệu cũ).
 *       - Cột AK "Định mức" = 100% - AJ/Q (Nhập trong kỳ / Nhập gỗ
 *         trong ngày) -> KHÔNG tham chiếu trực tiếp cột Tiên Sa/Dung
 *         Quất -> giữ NGUYÊN. Nếu cột AJ "Nhập trong kỳ" có công thức
 *         tính theo biến động Tồn kho CK qua các ngày thì sẽ tự động
 *         đúng theo sau khi sửa AI ở trên, không cần sửa AJ/AK.
 *  I) TỰ ĐIỀN "TỒN KHO ĐẦU NGÀY" TỪ "CỘNG MT" NGÀY HÔM TRƯỚC (v2026.8.8)
 *     - THEO YÊU CẦU MỚI: khi màn "Nhập Tồn Kho" đang ở chế độ NHẬP MỚI
 *     (chưa có dữ liệu cho Đơn vị+Ngày đang chọn), Web App tự động tra
 *     Chitiettonkho tìm bản ghi GẦN NHẤT TRƯỚC ngày đó (cùng Đơn vị),
 *     lấy "Cộng MT" của bản ghi đó điền sẵn vào ô "Tồn kho đầu ngày
 *     (MT)" - đúng logic kế toán liên tục: đầu ngày hôm nay = cuối
 *     ngày (Cộng MT) hôm trước (xem getPreviousDayCongMT()). Ô này VẪN
 *     LÀ Ô NHẬP BÌNH THƯỜNG (không khóa cứng) - người dùng có thể sửa
 *     lại tay nếu thực tế khác (VD ngày đầu tiên mở sổ, hoặc sau kiểm
 *     kê cần điều chỉnh). Nếu chưa có dữ liệu ngày nào trước đó cho
 *     đơn vị này, giữ nguyên hành vi cũ - để trống, người dùng tự nhập.
 *     Khi đang SỬA báo cáo đã có (không phải nhập mới), KHÔNG áp dụng
 *     cơ chế này - giữ nguyên "Tồn kho đầu ngày" đã lưu trước đó (xem
 *     fillCreateFormFromExisting_ ở Index.html).
 *  K) TAB "CÂN ĐỐI BDMT XUẤT HÀNG" - SHEET RIÊNG "CanDoiBDMT" (v2026.8.13)
 *     - THEO YÊU CẦU MỚI: thêm 1 tab con tùy chọn ở màn "Nhập Tồn Kho",
 *     đặt SAU tab "Kiểm kê vét bãi", để TẤT TOÁN chênh lệch kho xuất
 *     hàng (Kho Tiên Sa/Kho Dung Quất) sau mỗi đơn hàng xuất bán. Bản
 *     ĐẦU TIÊN để người dùng tự tính rồi nhập tay kết quả cuối - sau đó
 *     người dùng cung cấp ĐÚNG công thức đầy đủ và yêu cầu Web App TỰ
 *     TÍNH thay vì nhập tay (đã sửa lại theo đúng công thức này, xem
 *     computeCanDoiBDMT_ ở dưới). Người dùng CHỈ còn nhập: Kho (dropdown
 *     Tiên Sa/Dung Quất), "Độ ẩm cân đối" (%, gõ tay), "Khối lượng thực
 *     tế MT" (gõ tay) - mọi giá trị còn lại (MT/BDMT kho, Độ khô/Độ ẩm
 *     kho, Khối lượng thực tế BDMT, Độ khô TB Kho Nhà máy, Điều chỉnh
 *     MT/BDMT + diễn giải Nhập/Xuất bổ sung) do Web App tự tính.
 *     - Vẫn giữ phần hướng dẫn quy trình 2 bước (Bước 1 - Điều chỉnh
 *     Khô/BDMT làm trước, Bước 2 - Điều chỉnh Tươi/MT chỉ làm sau khi
 *     Bước 1 cân bằng, minh họa từ file "Tonghop_Quyettoan..." người
 *     dùng cung cấp) làm phần đọc tham khảo trong tab (khối <details>
 *     ở Index.html) - đây là bối cảnh NGHIỆP VỤ giải thích vì sao cần
 *     tất toán, còn phép tính Điều chỉnh MT/BDMT thực tế Web App thực
 *     hiện theo công thức mới người dùng chốt (xem dưới), không phải
 *     tính lại y hệt ví dụ 2 bước trong hướng dẫn.
 *     - CÔNG THỨC (theo đúng yêu cầu, tính ở computeCanDoiBDMT_):
 *       MT kho, BDMT kho = lấy tại đúng Kho đã chọn, CHÍNH dòng đang nộp
 *         (đã tự nhập ở tab "Kho Tiên Sa & Dung Quất" của CÙNG form).
 *       Độ khô kho (%) = BDMT kho/MT kho × 100; Độ ẩm kho = 100 - đó.
 *       Độ khô cân đối (%) = 100 - Độ ẩm cân đối.
 *       Khối lượng thực tế BDMT = Khối lượng thực tế MT × Độ khô cân đối.
 *       Độ khô TB Kho Nhà máy = đọc lại cột Y "Độ khô" (COL.DO_KHO) của
 *         CHÍNH dòng vừa lưu, SAU KHI Sheet đã tính công thức xong (sau
 *         extendFormulasToNewRow_ + flush) - không đoán công thức này.
 *       Điều chỉnh BDMT = Khối lượng thực tế BDMT - BDMT kho (dương =
 *         Kho Nhà máy phải XUẤT điều chỉnh bổ sung; âm = phải NHẬP).
 *       Điều chỉnh MT = (Khối lượng thực tế BDMT / Độ khô TB Kho Nhà
 *         máy) - MT kho (cùng quy ước dấu).
 *     - Là tùy chọn (checkbox "Có tất toán..." mới hiện ô nhập, giống
 *     Kiểm kê vét bãi) - không phải ngày nào cũng có đơn hàng cần cân
 *     đối. Mỗi lần chỉ cân đối 1 Kho (dropdown - đã hỏi và xác nhận với
 *     người dùng).
 *     - Khi submit, NẾU có tick + chọn Kho + đủ số liệu, Web App tính
 *     xong ghi thêm 1 dòng vào sheet RIÊNG "CanDoiBDMT" (tự tạo nếu chưa
 *     có, 18 cột - xem getOrCreateCanDoiBDMTSheet_) - KHÔNG đụng cột
 *     A..AO của "Form Responses 1"/Chitiettonkho/công thức chính. Nếu
 *     THIẾU số liệu để tính (chưa nhập Kho Tiên Sa/Dung Quất MT, hoặc
 *     chưa nhập đủ Nhà máy để Sheet tính được Độ khô TB), báo cáo tồn
 *     kho chính VẪN được lưu bình thường - chỉ riêng phần cân đối BDMT
 *     báo lỗi rõ ràng cho người dùng bổ sung rồi nộp lại (không throw
 *     làm hỏng cả báo cáo chính). Vì là 1 sheet log độc lập (giống sheet
 *     "Audit"), sửa/xóa báo cáo ngày sau này KHÔNG tự động sửa/xóa theo
 *     các dòng đã ghi ở CanDoiBDMT.
 *     - Các cột %  ở sheet CanDoiBDMT lưu dạng SỐ PHẦN TRĂM THUẦN (vd
 *     51.19 nghĩa là 51.19%), KHÁC với quy ước phân số 0..1 (vd 0.5119)
 *     đang dùng cho các cột Độ ẩm/Độ khô/Định mức khác trong hệ thống -
 *     cố ý làm khác để người xem trực tiếp trên Google Sheet không cần
 *     tự đổi đơn vị.
 *  L) BÁO CÁO "Theo mẫu Tonkho_Damgo" - THÊM CHẾ ĐỘ "Đầy đủ số liệu"
 *     (v2026.8.17) - bên cạnh chế độ cũ (đổi tên thành "Theo thực tế",
 *     vẫn là MẶC ĐỊNH): nếu 1 đơn vị chưa nộp báo cáo đúng ngày được
 *     chọn, "Theo thực tế" vẫn hiển thị 0 như cũ (đúng thực trạng chưa
 *     có số liệu), còn "Đầy đủ số liệu" tự động lấy TẠM số liệu của
 *     ngày gần nhất TRƯỚC đó cho riêng đơn vị đó (xem
 *     findLatestChitietBeforeDate_/getTonkhoDamgoReport - tham số
 *     `mode`), kèm ghi chú rõ đang hiển thị số liệu của ngày nào để
 *     không nhầm là số liệu chính thức của ngày đang xem. Nếu đơn vị đó
 *     CHƯA TỪNG có báo cáo nào trước đó thì dù ở chế độ nào cũng vẫn
 *     phải hiển thị 0 (không có gì để lấy tạm). Đồng thời đổi ngày mặc
 *     định của báo cáo này từ "hôm nay" sang "hôm qua" (lùi 1 ngày) -
 *     vì đơn vị thường báo cáo cho ngày hôm trước, chọn sẵn "hôm nay"
 *     hay bị trống dữ liệu ngay lần đầu mở báo cáo.
 *  M) BOT TELEGRAM - BÁO CÁO TỒN KHO ĐỊNH KỲ (v2026.8.17) - gửi tự
 *     động vào Telegram lúc 15h chiều hàng ngày, TRỪ Chủ nhật, cho
 *     NGÀY TỒN KHO = hôm qua (ngày hiện hành trừ 1 ngày). Tái dùng
 *     NGUYÊN hàm getTonkhoDamgoReport() (mục G/L) để lấy dữ liệu, chỉ
 *     định dạng lại thành văn bản gọn gửi qua Telegram - không tính
 *     lại bất kỳ số liệu nào, tránh lệch với trang Báo Cáo trên Web
 *     App. Là bot CHỈ GỬI (không hỏi-đáp) nên KHÔNG dùng cơ chế polling
 *     nhận tin nhắn - chỉ cần 1 trigger giờ cố định. Xem hướng dẫn
 *     thiết lập đầy đủ (tạo bot, lấy Token/Chat ID, bật lịch) ngay phía
 *     trên các hàm liên quan, tìm bằng "BOT TELEGRAM - BÁO CÁO TỒN KHO
 *     ĐỊNH KỲ (mục M".
 *  N) BOT TELEGRAM - BỔ SUNG FILE PDF + GỬI ĐỘT XUẤT + 2 BÁO CÁO SẢN
 *     LƯỢNG (v2026.8.17) - mở rộng mục M:
 *     - MỖI LẦN gửi báo cáo (dù tự động 15h hay đột xuất) đều đính kèm
 *     THÊM 2 file PDF (không chỉ có tin nhắn tóm tắt như mục M): 1 bản
 *     "Theo thực tế" + 1 bản "Đầy đủ số liệu" - LUÔN gửi CẢ 2 để người
 *     nhận có đủ 2 góc nhìn dữ liệu, không phụ thuộc đang xem chế độ
 *     nào (xem taoPdfBaoCaoTonKhoDamgo_/xayHtmlBaoCaoTonKhoDamgo_ - kỹ
 *     thuật tạo Blob HTML rồi gọi getAs("application/pdf"), không cần
 *     thư viện PDF riêng hay tạo Google Doc/Sheet tạm).
 *     - THÊM nút "📨 Gửi báo cáo Telegram" ở trang Báo Cáo Tổng Hợp >
 *     Theo mẫu Tonkho_Damgo (chỉ Admin thấy/dùng được, xem
 *     guiBaoCaoTelegramTuWebApp) - gửi NGAY đúng ngày + chế độ đang xem
 *     trên màn hình, không cần chờ tới lịch 15h tự động (dùng khi cần
 *     gửi gấp/ngoài giờ).
 *     - THÊM 2 mục trong nội dung báo cáo (cả tin nhắn lẫn PDF): "Sản
 *     lượng gỗ nhập trong ngày" (= cột "Nhập trong kỳ MT" đã có sẵn ở
 *     bảng ĐỊNH MỨC SX) và "Sản lượng dăm gỗ (MT) nhập trong ngày" (=
 *     "Cộng MT" đã có sẵn ở bảng NHÀ MÁY) - tái dùng đúng số liệu có
 *     sẵn trong getTonkhoDamgoReport(), CHỈ làm nổi bật thành 2 mục
 *     riêng vì đây là 2 chỉ số hay được hỏi nhất, không tính thêm gì
 *     mới.
 *  O) SỬA LỖI TÍNH TRUNG BÌNH ĐỘ ẨM/ĐỘ KHÔ Ở MỤC "KHO XUẤT HÀNG"
 *     (v2026.8.17) - báo cáo "Theo mẫu Tonkho_Damgo" (cả trang Báo Cáo
 *     lẫn Telegram, dùng CHUNG getTonkhoDamgoReport()): dòng "Grand
 *     Total" của Kho Tiên Sa/Kho Dung Quất trước đây lấy AVERAGE độ
 *     ẩm/độ khô trên CẢ 4 đơn vị (REPORT_UNIT_ORDER), kể cả đơn vị nào
 *     hôm đó KHÔNG hề có hàng ở kho này (MT=0, vì đơn vị đó không xuất
 *     qua kho đang xét) - độ ẩm/độ khô của các dòng "không tồn" này
 *     thường là 0 hoặc số rác, kéo lệch số trung bình xuống sai. SỬA:
 *     chỉ AVERAGE trên các đơn vị THỰC SỰ có tồn tại kho đó trong ngày
 *     (MT > 0) - xem table3CoTon/table3bCoTon trong getTonkhoDamgoReport.
 *     Cột MT/BDMT (SUM) không đổi vì SUM không bị ảnh hưởng bởi việc có
 *     dòng 0 hay không.
 *  P) TIN NHẮN TELEGRAM - THÊM CHI TIẾT TỪNG ĐƠN VỊ Ở MỤC "KHO XUẤT
 *     HÀNG" (v2026.8.17) - trước đây phần tóm tắt dạng chữ gửi Telegram
 *     CHỈ hiện tổng Kho Tiên Sa/Kho Dung Quất, không rõ đơn vị nào đóng
 *     góp bao nhiêu (khác với mục NHÀ MÁY đã liệt kê sẵn từng đơn vị).
 *     Bổ sung liệt kê từng đơn vị THỰC SỰ có hàng ở kho đó (MT > 0,
 *     cùng khái niệm "có tồn" với mục O) trước dòng Tổng - đơn vị nào
 *     không có hàng ở kho đó thì KHÔNG liệt kê (tránh rối với các dòng
 *     "0 MT" không có ý nghĩa). File PDF đính kèm (mục N) vẫn giữ bảng
 *     đầy đủ 4 đơn vị (kể cả dòng 0) để tra soát khi cần.
 *  Q) SỬA LỖI TÍNH TRUNG BÌNH ĐỘ ẨM/ĐỘ KHÔ Ở MỤC "NHÀ MÁY" (v2026.8.17)
 *     - người dùng phát hiện CÙNG LỖI với mục O (Kho xuất hàng) cũng
 *     xảy ra ở bảng 2 mục NHÀ MÁY: "Độ ẩm TB"/"Độ khô TB" (Grand Total)
 *     trước đây lấy AVERAGE trên CẢ 4 đơn vị, kể cả đơn vị không có sản
 *     lượng ngày đó (Cộng MT = 0, table1) - kéo lệch số trung bình. SỬA
 *     THEO ĐÚNG CÙNG NGUYÊN TẮC mục O: chỉ AVERAGE trên đơn vị có Cộng
 *     MT > 0 (xem table2CoTon/donViCoSanLuongNhaMay). Ảnh hưởng CẢ trang
 *     Báo Cáo trên Web App LẪN báo cáo Telegram (dùng chung
 *     getTonkhoDamgoReport()) - sửa 1 chỗ khớp cả 2 nơi.
 *  R) SỬA LỖI CACHE - BÁO CÁO KHÔNG CẬP NHẬT SAU KHI SỬA DỮ LIỆU
 *     (v2026.8.17, Index.html) - người dùng phản ánh: sửa lại số liệu 1
 *     ngày ở Lịch Sử xong quay lại Báo Cáo > Theo mẫu Tonkho_Damgo vẫn
 *     thấy số CŨ. Nguyên nhân: hàm switchReportTab() (chuyển tab con
 *     "Theo khoảng thời gian" / "Theo mẫu Tonkho_Damgo" TRONG CÙNG trang
 *     Báo Cáo, không phải điều hướng trang) trước đây CHỈ tải lại báo
 *     cáo nếu phiên làm việc CHƯA từng tải lần nào (điều kiện
 *     `!state.tonkhoDamgoReport`) - nên nếu đã xem báo cáo 1 lần, sau đó
 *     sửa dữ liệu ở nơi khác rồi bấm LẠI đúng tab này (không rời hẳn
 *     trang Báo Cáo), vẫn hiện bản đã cache từ trước, KHÔNG lấy lại từ
 *     Chitiettonkho. Server-side (getTonkhoDamgoReport, updateEntry/
 *     deleteEntry đều đã tự đồng bộ Chitiettonkho đúng ngay khi sửa/xóa
 *     - không phải lỗi backend) không có vấn đề gì. SỬA: bỏ điều kiện
 *     cache, LUÔN gọi loadTonkhoDamgoReport() mỗi khi chuyển vào tab này
 *     (chi phí rất nhẹ - chỉ 1 ngày dữ liệu).
 *  S) BÁO CÁO TELEGRAM - ĐỔI SANG GỬI 1 ẢNH DUY NHẤT "Y NHƯ TRANG CHỦ" +
 *     ĐỔI GIỜ TRIGGER SANG 16H (v2026.8.17) - THAY THẾ HẲN cách gửi báo
 *     cáo ở mục M/N (trước đây: 1 tin nhắn tóm tắt dạng chữ + 2 file PDF
 *     "Theo mẫu Tonkho_Damgo"). THEO YÊU CẦU MỚI: mỗi lần gửi (tự động
 *     hay đột xuất) CHỈ gửi ĐÚNG 1 file ẢNH duy nhất, nội dung/số liệu
 *     giống với trang "Trang chủ" (Dashboard) trên Web App - tái sử dụng
 *     NGUYÊN hàm getDashboardStats() đã có sẵn (không tính lại số liệu
 *     riêng, đảm bảo khớp tuyệt đối với Trang chủ) thay vì
 *     getTonkhoDamgoReport() như trước.
 *     - KỸ THUẬT TẠO ẢNH: Apps Script KHÔNG có sẵn cách "chụp ảnh" 1
 *     trang HTML - chỉ có dịch vụ Charts dựng sẵn ảnh PNG trực tiếp từ dữ
 *     liệu (Charts.newTableChart()...build().getAs("image/png")), không
 *     cần thư viện ngoài/API bên thứ 3 (tránh phụ thuộc + tốn phí). Dùng
 *     hàm này dựng 1 bảng ảnh gộp đủ 3 phần số liệu chính của Trang chủ
 *     (Trạng thái từng đơn vị, Kho Nhà máy, Kho Xuất Hàng) + dòng "TỔNG
 *     CỘNG" - xem taoAnhBaoCaoTrangChu_(). Các KPI tổng quan (Tổng tồn
 *     kho cuối, Đơn vị chưa báo cáo hôm nay...) đưa vào phần CAPTION của
 *     ảnh (xem soanCaptionBaoCaoTrangChu_()) vì Charts service không hỗ
 *     trợ dựng thẻ "card" nhiều màu như giao diện Trang chủ thật.
 *     - GỬI ẢNH: dùng API sendPhoto của Telegram (khác sendDocument ở
 *     mục N dùng cho PDF trước đây) - ảnh sendPhoto hiện PREVIEW ngay
 *     trong khung chat, không cần bấm mở như file đính kèm thường
 *     (guiAnhTelegram_()).
 *     - ĐỔI GIỜ TỰ ĐỘNG: trigger hàng ngày đổi từ 15h sang 16h
 *     (BAT_LICH_BAO_CAO_TON_KHO_TELEGRAM, .atHour(16)) - do đổi giờ nên
 *     BẮT BUỘC chạy lại hàm BAT_LICH_BAO_CAO_TON_KHO_TELEGRAM() ĐÚNG 1
 *     LẦN sau khi cập nhật code này để trigger cũ (15h) được xóa và thay
 *     bằng trigger mới (16h) - hàm tự xóa trigger trùng tên trước khi tạo
 *     mới nên chạy lại không bị gửi trùng 2 lần/ngày.
 *     - Vì báo cáo mới lấy theo Trang chủ (LUÔN là bản ghi MỚI NHẤT của
 *     mỗi đơn vị, không theo 1 "ngày tồn kho" cụ thể như báo cáo
 *     Tonkho_Damgo) nên hàm gửi đột xuất guiBaoCaoTelegramTuWebApp()
 *     KHÔNG còn nhận tham số ngày/chế độ nữa - nút "📨 Gửi báo cáo
 *     Telegram" cũng dời từ trang Báo Cáo > Theo mẫu Tonkho_Damgo sang
 *     Trang chủ > khối "Công cụ Admin" cho hợp lý (đi cùng dữ liệu đang
 *     xem trên Trang chủ).
 *     - CÁC HÀM CŨ ĐÃ GỠ BỎ (không còn dùng): soanNoiDungBaoCaoTonKhoTelegram_,
 *     guiTaiLieuTelegram_, xayHtmlBaoCaoTonKhoDamgo_, taoPdfBaoCaoTonKhoDamgo_,
 *     guiBaoCaoTonKhoTelegramChoNgay_ - báo cáo "Theo mẫu Tonkho_Damgo"
 *     (Excel/PDF xuất tay từ trang Báo Cáo) KHÔNG bị ảnh hưởng, vẫn hoạt
 *     động bình thường (dùng cơ chế riêng, xem exportReportToPdf ở
 *     Index.html).
 *  T) BÁO CÁO TELEGRAM - ĐỔI KỸ THUẬT TẠO ẢNH SANG GOOGLE SLIDES, GIỐNG
 *     HẲN GIAO DIỆN TRANG CHỦ (v2026.8.17) - người dùng gửi kèm ảnh chụp
 *     Trang chủ thật, phản hồi ảnh Telegram ở mục S (dựng bằng
 *     Charts.newTableChart - chỉ ra được 1 bảng phẳng) CHƯA giống giao
 *     diện thật (thiếu thẻ KPI, thẻ từng đơn vị, màu sắc) - và gợi ý
 *     "tạo PDF rồi convert qua ảnh". Đã thử phương án đó: Apps Script
 *     convert HTML→PDF được (dùng ở mục N cũ) NHƯNG KHÔNG có API convert
 *     PDF→ảnh (Blob.getAs không hỗ trợ chiều này) - nên ĐỔI SANG cách
 *     khác cho ra ảnh THẬT SỰ giống giao diện: dựng 1 slide Google
 *     Slides TẠM với layout/màu phỏng theo Trang chủ (thẻ bo góc, pill
 *     trạng thái, bảng có dòng Tổng cộng tô màu - xem các hàm
 *     addRect_/addText_/addPill_/addDataTable_ ngay trước
 *     taoAnhBaoCaoTrangChu_), rồi dùng Slides API (dịch vụ NÂNG CAO, xem
 *     bước 0 bên dưới) lấy ảnh PNG thumbnail của slide đó
 *     (Slides.Presentations.Pages.getThumbnail) - đây là cách CHÍNH
 *     THỨC duy nhất trong Apps Script để "chụp ảnh" 1 layout tự dựng
 *     (nền tảng không có dịch vụ html-to-image/pdf-to-image có sẵn).
 *     File Slides tạm luôn bị xóa (thùng rác Drive) ngay sau khi lấy ảnh
 *     xong, kể cả khi có lỗi giữa chừng (khối finally) - không để lại
 *     rác trong Drive.
 *     - BƯỚC 0 (THÊM MỚI, làm 1 LẦN DUY NHẤT): phải BẬT dịch vụ nâng cao
 *     "Slides API" trước khi dùng được - mở Apps Script Editor > click
 *     dấu "+" cạnh "Services" (menu bên trái) > chọn "Slides API" > Add.
 *     KHÔNG cần thêm bước nào khác (không cần bật ở Google Cloud Console
 *     riêng - Apps Script tự làm khi bấm Add).
 *     - Hàm mới XEM_THU_ANH_BAO_CAO_TRANG_CHU() để xem thử/gỡ lỗi layout
 *     ảnh MÀ KHÔNG cần gửi qua Telegram - lưu ảnh vào Drive, in link ra
 *     Execution log để bấm mở xem trực tiếp - NÊN chạy hàm này trước để
 *     kiểm tra layout ổn rồi mới tin vào lịch tự động 16h.
 *     - soanCaptionBaoCaoTrangChu_() (caption ảnh) giữ nguyên như mục S.
 *     - QUÁ TRÌNH SỬA KÍCH THƯỚC TRANG (3 LẦN, ghi lại đầy đủ để không
 *     lặp lại nhầm lẫn về sau):
 *       1. Presentation.setPageSize() KHÔNG tồn tại trong SlidesApp (lỗi
 *          "not a function" khi chạy thử lần đầu).
 *       2. Đổi sang Slides.Presentations.create({pageSize:...}) - thử cả
 *          qua dịch vụ nâng cao LẪN gọi thẳng REST endpoint bằng
 *          UrlFetchApp+OAuth token - CẢ HAI đều bị ÂM THẦM BỎ QUA trường
 *          pageSize (xác nhận qua log gỡ lỗi 2 lần liên tiếp: ảnh luôn
 *          bị cắt đúng bằng khổ mặc định/16:9 dù request đúng định
 *          dạng). Đây là giới hạn THẬT SỰ của Slides API khi tạo mới
 *          presentation (nhiều nơi đã ghi nhận), KHÔNG phải lỗi code.
 *          Kích thước trang KHÔNG đổi được sau khi tạo (không có
 *          batchUpdate request nào cho việc này) nên bắt buộc phải có
 *          sẵn ĐÚNG kích thước NGAY LÚC TẠO.
 *       3. CÁCH DUY NHẤT ĐÁNG TIN CẬY (đang dùng): COPY từ 1 file Slides
 *          MẪU đã đặt sẵn đúng kích thước qua GIAO DIỆN Slides thật
 *          (không qua API) - copy file (DriveApp.getFileById(...).
 *          makeCopy()) giữ NGUYÊN kích thước trang gốc của file mẫu.
 *          BƯỚC 0b (THÊM MỚI, làm 1 LẦN DUY NHẤT): tạo file mẫu:
 *            a. Mở slides.google.com > "Trống" (Blank presentation).
 *            b. Menu File > "Page setup" (Thiết lập trang) > chọn
 *               "Custom" (Tùy chỉnh) > nếu có dropdown đơn vị thì chọn
 *               "Points" và nhập Width=1008, Height=936 - nếu chỉ có
 *               đơn vị inch thì nhập 14 x 13 (≈ đúng 1008x936 điểm) >
 *               Apply/OK.
 *            c. Nội dung slide KHÔNG quan trọng (hàm tự xóa hết trước
 *               khi vẽ lại) - chỉ kích thước trang là quan trọng.
 *            d. Copy Presentation ID từ URL, đoạn giữa "/d/" và "/edit":
 *               https://docs.google.com/presentation/d/ĐOẠN_NÀY/edit
 *            e. Trong Apps Script Editor, chọn hàm LUU_TEMPLATE_SLIDE_ID
 *               ở thanh công cụ > sửa tạm dòng cuối hàm để truyền đúng
 *               ID vừa copy > Run 1 lần (hoặc đơn giản hơn: thêm Script
 *               property tên "TEMPLATE_SLIDE_ID" = ID đó, cùng chỗ
 *               Project Settings > Script Properties).
 *          Thiếu TEMPLATE_SLIDE_ID thì taoAnhBaoCaoTrangChu_() báo lỗi rõ
 *          ràng thay vì âm thầm gửi ảnh cắt cụt.
 *  U) TRANG CHỦ - THÊM KPI "TỔNG GỖ KEO NHẬP" + KHÔI PHỤC MẪU TELEGRAM
 *     CŨ CHO BÁO CÁO TONKHO_DAMGO (v2026.8.17):
 *     - Trang chủ (và ảnh báo cáo Telegram tự động, vì dùng CHUNG
 *     getDashboardStats()) THÊM 1 thẻ KPI mới "Tổng lượng gỗ keo nhập
 *     trong ngày (ngày gần nhất mỗi đơn vị)" - CỘNG "Nhập gỗ keo"
 *     (nhapGo) của bản ghi gần nhất TỪNG đơn vị (xem trường mới
 *     `tongNhapGo` trong getDashboardStats()) - hiển thị NGAY PHÍA TRÊN
 *     hàng 4 thẻ thống kê cũ trên Trang chủ (Index.html), và thêm làm
 *     thẻ KPI thứ 2 trong ảnh Telegram (taoAnhBaoCaoTrangChu_) + 1 dòng
 *     trong caption ảnh (soanCaptionBaoCaoTrangChu_).
 *     - KHÔI PHỤC LẠI mẫu gửi Telegram CŨ (1 tin tóm tắt dạng chữ + 2
 *     file PDF: Theo thực tế + Đầy đủ số liệu) CHỈ RIÊNG cho nút "📨 Gửi
 *     báo cáo Telegram" ở trang Báo Cáo Tổng Hợp > Theo mẫu Tonkho_Damgo
 *     - các hàm đã gỡ ở mục S (soanNoiDungBaoCaoTonKhoTelegram_,
 *     guiTaiLieuTelegram_, xayHtmlBaoCaoTonKhoDamgo_,
 *     taoPdfBaoCaoTonKhoDamgo_, guiBaoCaoTonKhoTelegramChoNgay_) nay
 *     được ĐƯA LẠI NGUYÊN VẸN vào file (xem khối "BÁO CÁO TELEGRAM THEO
 *     MẪU TONKHO_DAMGO" ngay sau fmtNumVN_/fmtPctVN_/escHtml_), cùng 1
 *     hàm mới `guiBaoCaoTonkhoDamgoTelegramTuWebApp(ngayISO, mode)` gọi
 *     từ nút đó. HAI luồng gửi Telegram giờ TÁCH BIỆT hoàn toàn, không
 *     dùng chung hàm nào:
 *       - Trang Báo Cáo > Theo mẫu Tonkho_Damgo: nút riêng, gửi mẫu CŨ
 *         (chữ + 2 PDF), theo ngày/chế độ đang xem trên trang đó.
 *       - Trang chủ > Công cụ Admin: nút riêng (guiBaoCaoTelegramTuWebApp,
 *         không tham số) GỬI ẢNH (mục S/T) - CHỈ 2 nơi ảnh được gửi:
 *         bấm nút này, HOẶC lịch tự động 16h hàng ngày
 *         (BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_) - ảnh KHÔNG bao giờ gửi
 *         từ trang Báo Cáo nữa.
 *  V) BÁO CÁO TỔNG HỢP - THÊM "CHI TIẾT THEO NHÀ MÁY", SỬA XUẤT EXCEL,
 *     PDF KHỔ NGANG (v2026.8.17): 3 yêu cầu riêng biệt, gộp chung 1 mục
 *     vì cùng nằm trong trang Báo Cáo Tổng Hợp.
 *     - CHI TIẾT THEO NHÀ MÁY: trước đây trang "Theo khoảng thời gian"
 *     chỉ lọc được theo ĐƠN VỊ (4 pháp nhân ở CFG.UNITS) và các bảng chi
 *     tiết (Kho Nhà máy/Kho Xuất Hàng) chỉ có số CUỐI KỲ (1 dòng/đơn vị,
 *     từ getReportSummary) - không có cách xem DIỄN BIẾN TỪNG NGÀY của
 *     riêng 1 trong 4 "nhà máy" (Hòa Nhơn/Quế Sơn/Đại Hiệp/HAKQN - đây
 *     là 4 NGUỒN NHẬP GỖ dùng chung ở cả 4 đơn vị, KHÁC KHÁI NIỆM với 4
 *     "đơn vị" pháp nhân, dễ nhầm vì tên gần giống). Thêm hàm mới
 *     getNhaMayDetailReport(fDate, tDate, donViFilter, nhaMay) trả về 1
 *     DÒNG/NGÀY/ĐƠN VỊ (không gộp đầu/cuối kỳ), lọc thêm được theo 1
 *     trong 4 nhà máy qua dropdown mới "Nhà máy (chi tiết theo ngày)" ở
 *     Index.html - kết quả hiển thị ở bảng mới "Chi tiết theo Nhà máy
 *     (từng ngày)" ngay dưới 2 bảng cuối kỳ cũ, tải song song (không
 *     chung 1 lệnh gọi) với getReportSummary trong loadReport().
 *     - XUẤT EXCEL: trước đây dùng thư viện SheetJS tải từ CDN ngoài
 *     (cdnjs.cloudflare.com) - người dùng báo "không kết xuất Excel
 *     được", nhiều khả năng do mạng/trình duyệt/chính sách công ty chặn
 *     tải script từ CDN ngoài (Web App chạy trong trình duyệt người
 *     dùng, không phải server Apps Script, nên không kiểm soát được).
 *     SỬA: bỏ HẲN phụ thuộc CDN ngoài - Index.html tự dựng file Excel
 *     (.xls, định dạng HTML đặc biệt Excel hiểu, nhiều sheet THẬT dùng
 *     namespace "urn:schemas-microsoft-com:office:excel" CHÍNH THỨC của
 *     Microsoft, không phải hack) hoàn toàn bằng JS thuần ngay trong
 *     trình duyệt (xem xuatBangHtmlThanhExcel_ trong Index.html) - không
 *     cần tải bất kỳ thư viện ngoài nào nữa.
 *     - PDF KHỔ NGANG: đặt landscape làm mặc định cho cả 2 luồng xuất
 *     PDF - (a) xuất PDF từ trang Báo Cáo qua nút "🖨️ Xuất PDF"
 *     (window.print của trình duyệt, thêm @page{size:landscape} trong
 *     @media print ở Index.html) và (b) PDF đính kèm khi gửi Telegram từ
 *     nút "📨 Gửi báo cáo Telegram" ở tab Tonkho_Damgo (thêm
 *     @page{size:A4 landscape} vào xayHtmlBaoCaoTonKhoDamgo_() ở đây) -
 *     vì các bảng nhiều cột (Nhà máy: 10 cột) hay bị tràn/cắt cột khi in
 *     khổ dọc.
 *  W) TRANG CHỦ / ẢNH TELEGRAM - ĐỔI THẺ "SỐ NGÀY ĐÃ GHI NHẬN" THÀNH
 *     "SỐ LƯỢNG NHÀ MÁY VÉT BÃI" (v2026.8.17): thẻ KPI thứ 4 ở Trang chủ
 *     (và ảnh Telegram, dùng chung getDashboardStats()) trước đây hiện
 *     "Số ngày đã ghi nhận (Chitiettonkho)" - ít giá trị vận hành hàng
 *     ngày - đổi thành đếm số ĐƠN VỊ có "Kiểm kê vét bãi" = Có ở bản ghi
 *     GẦN NHẤT (field mới getDashboardStats().soLuongVetBai/vetBaiDetail,
 *     cùng cách tính "gần nhất của từng đơn vị" như tongNhapGo ở mục U)
 *     + hiển thị chi tiết (thời điểm vét bãi, KL ước tính còn lại, chênh
 *     lệch) ngay dưới hàng KPI trên Trang chủ, và thêm vào caption ảnh
 *     Telegram (soanCaptionBaoCaoTrangChu_).
 *  X) PHÂN QUYỀN THEO ĐƠN VỊ + ĐIỀU KIỆN KIỂM TRA DUYỆT + BÁO CÁO LỆCH
 *     ĐẦU KỲ CHỜ ADMIN DUYỆT (v2026.8.17) - 4 phần liên quan, gộp
 *     chung 1 mục:
 *     1. MENU "CÀI ĐẶT" MỚI (Index.html, admin-only): gộp "Công cụ
 *     Admin" (trước đây nằm ở Trang chủ, nay CHUYỂN HẲN vào đây) + 2
 *     mục mới "Phân quyền" và "Điều kiện kiểm tra duyệt" vào 1 trang có
 *     3 tab con.
 *     2. PHÂN QUYỀN (sheet mới "PhanQuyen", xem getOrCreatePhanQuyenSheet_):
 *     mỗi dòng = (Email, Đơn vị, Quyền) với Quyền là 1 trong 3:
 *     "nhap_sua" (nhập/sửa được đúng Đơn vị đó, tự động bao gồm Xem),
 *     "xem" (chỉ xem), "admin" (toàn quyền mọi Đơn vị + chức năng quản
 *     trị, Đơn vị bỏ trống). ĐÃ THỐNG NHẤT với người dùng: phân quyền
 *     tính theo ĐƠN VỊ (4 pháp nhân, khớp cấu trúc 1-form/1-đơn-vị hiện
 *     có), KHÔNG theo "nhà máy" nguồn (Hòa Nhơn/Quế Sơn/Đại Hiệp/HAKQN -
 *     đây là các CỘT trong CÙNG 1 form, không tách được theo quyền).
 *     Email CHƯA có dòng nào (và không nằm trong CFG.ADMIN_EMAILS) bị
 *     CHẶN HẲN - Index.html gọi getMyAccess() lúc khởi động, nếu
 *     !isAdmin && !coQuyenGi thì thay toàn bộ giao diện bằng màn "chưa
 *     được cấp quyền". utils.isAdmin() được SỬA để nhận thêm các email
 *     có dòng Quyền="admin" trong sheet này (ngoài CFG.ADMIN_EMAILS cứng
 *     - vẫn giữ lại làm "admin gốc" không thể tự khóa nhầm mình), nên
 *     MỌI chỗ gọi utils.isAdmin() sẵn có trong file tự động áp dụng đúng
 *     theo nguồn mới, không cần sửa từng chỗ. submitInventoryEntry()
 *     chặn nộp nếu người dùng không có quyền "nhap_sua" cho đúng Đơn vị
 *     đang nộp. Nhập Tồn Kho (Index.html) lọc dropdown Đơn vị theo
 *     donViNhapSua cho non-admin; Báo Cáo/Lịch Sử lọc theo donViNhapSua
 *     ∪ donViXem.
 *     3. ĐIỀU KIỆN KIỂM TRA DUYỆT (sheet mới "DieuKienDuyet"): Admin
 *     nhập khoảng % (tối thiểu-tối đa) cho cột "Định mức" có sẵn
 *     (COL.DINH_MUC, công thức Sheet) của TỪNG Đơn vị. Sau khi
 *     submitInventoryEntry() ghi xong + kéo công thức + flush, đọc LẠI
 *     giá trị Định mức vừa tính cho đúng dòng đó, so với khoảng đã cấu
 *     hình (nếu Đơn vị có cấu hình) - lệch thì GỬI EMAIL cảnh báo (người
 *     nộp + toàn bộ CFG.ADMIN_EMAILS) "báo cáo chưa khớp định mức, đề
 *     nghị báo cáo lại" qua kiemTraDinhMucVaCanhBao_() - CHỈ CẢNH BÁO,
 *     KHÔNG chặn lưu báo cáo (khác với mục 4 bên dưới).
 *     4. BÁO CÁO LỆCH ĐẦU KỲ - CHỜ ADMIN DUYỆT: cột mới COL.TRANG_THAI_DUYET
 *     (cột thứ 42 = AP, nối cuối theo đúng phương án Kho Dung Quất ở mục
 *     H - xem CFG.TOTAL_COL_COUNT, và hàm DAM_BAO_COT_TRANG_THAI_DUYET()
 *     CẦN CHẠY 1 LẦN để thêm nhãn tiêu đề cột cho sheet thật). Khi 1
 *     người dùng KHÔNG PHẢI ADMIN nộp báo cáo mới mà "Tồn kho đầu ngày"
 *     nhập vào KHÔNG khớp "Tồn kho cuối kỳ" (COL.TON_CK) của bản ghi
 *     CHÍNH THỨC (Chitiettonkho) ngày liền trước cùng Đơn vị
 *     (timTonCuoiKyTruoc_) - ĐÃ THỐNG NHẤT với người dùng: vẫn LƯU bình
 *     thường (không chặn nộp) nhưng gắn trạng thái "Chờ duyệt", báo email
 *     ngay cho Admin, và syncChitietTonKhoForKey_() được sửa để LOẠI các
 *     bản ghi "Chờ duyệt"/"Từ chối" khỏi danh sách xét "bản mới nhất" khi
 *     đồng bộ vào Chitiettonkho (áp dụng luôn cho rebuildAllChitietTonKho())
 *     - nghĩa là báo cáo lệch đầu kỳ KHÔNG hiển thị trên
 *     Dashboard/Báo cáo/ảnh Telegram cho tới khi được duyệt. Admin xem +
 *     bấm "✅ Duyệt"/"❌ Từ chối" ngay tại trang LỊCH SỬ (nút mới, chỉ hiện
 *     khi trạng thái = "Chờ duyệt") - gọi duyetBaoCao(rowIndex, chapNhan),
 *     tự đồng bộ lại Chitiettonkho + báo email kết quả cho người nộp.
 *     Admin tự nộp thì BỎ QUA toàn bộ kiểm tra này (đã có toàn quyền).
 *     LƯU Ý PHẠM VI: kiểm tra lệch đầu kỳ + phân quyền nộp CHỈ áp dụng
 *     cho kênh Web App (submitInventoryEntry) - kênh Google Form song
 *     song (onFormSubmit, mục E) vẫn "nộp thoải mái" như cũ, không qua
 *     2 lớp kiểm tra mới này (Form không có khái niệm đăng nhập/quyền).
 *  Y) NÚT "GỬI BÁO CÁO TELEGRAM" (ẢNH) - CHO CHỌN NGÀY LẬP BÁO CÁO
 *     (v2026.8.17): trước đây nút này ở Cài đặt > Công cụ Admin LUÔN gửi
 *     số liệu MỚI NHẤT của mỗi đơn vị (giống hệt getDashboardStats gốc)
 *     - THEO YÊU CẦU MỚI: đôi lúc Admin cần GỬI LẠI báo cáo của 1 NGÀY
 *     TRƯỚC ĐÓ (không phải ngày hiện tại). Thêm ô chọn "Ngày lập báo
 *     cáo" (Index.html, mặc định = hôm nay) cạnh nút gửi - để nguyên hôm
 *     nay thì hành vi y hệt cũ (không truyền tham số ngày lên server);
 *     đổi sang ngày khác thì gọi hàm MỚI getDashboardStatsForDate_(ngayISO)
 *     thay vì getDashboardStats() gốc. Hàm mới này CỐ Ý viết RIÊNG (copy
 *     gần như nguyên logic, không refactor dùng chung) để KHÔNG rủi ro
 *     ảnh hưởng luồng mặc định (Trang chủ tương tác + lịch tự động 16h,
 *     cả 2 vẫn gọi getDashboardStats() gốc y nguyên, không đổi 1 dòng).
 *     Với mỗi đơn vị, getDashboardStatsForDate_ lấy bản ghi Chitiettonkho
 *     GẦN NHẤT có Ngày tồn kho <= ngày được chọn (bỏ qua báo cáo SAU
 *     ngày đó, đúng ngữ cảnh "gửi lại báo cáo ngày cũ" - không lộ số
 *     liệu mới hơn). taoAnhBaoCaoTrangChu_/soanCaptionBaoCaoTrangChu_ tự
 *     nhận diện qua field `ngayBaoCaoDisplay` (CHỈ có ở biến thể theo
 *     ngày) để đổi dòng phụ đề ("Báo cáo cho ngày X" thay vì "Trang chủ
 *     · giờ hiện tại") và nhãn thẻ "chưa báo cáo hôm nay" -> "chưa báo
 *     cáo đúng ngày này" cho khớp ngữ cảnh. Chuỗi gọi:
 *     guiBaoCaoTelegramDotXuat() [client, đọc ô ngày] ->
 *     guiBaoCaoTelegramTuWebApp(ngayISO) [server, admin-gated] ->
 *     guiBaoCaoTrangChuTelegram_(null, ngayISO) [dùng chung với lịch tự
 *     động - ngayISO rỗng/null thì y hệt hành vi gốc].
 *  Z) "ĐIỀU KIỆN KIỂM TRA DUYỆT" - THÊM KHOẢNG NGÀY ÁP DỤNG (v2026.8.17):
 *     bản đầu (mục X) mỗi Đơn vị chỉ có ĐÚNG 1 dòng định mức, áp dụng
 *     MÃI MÃI - người dùng phản hồi "kg phải nhất nhất 1 điều kiện mãi
 *     mãi" vì định mức thực tế thay đổi theo giai đoạn/mùa vụ. SỬA: sheet
 *     "DieuKienDuyet" thêm 2 cột "Từ ngày"/"Đến ngày" - mỗi Đơn vị giờ có
 *     thể có NHIỀU dòng cấu hình cho các khoảng ngày khác nhau (không còn
 *     tự động ghi đè theo Đơn vị). Bỏ trống "Từ ngày"/"Đến ngày" = không
 *     giới hạn quá khứ/tương lai tương ứng. luuDieuKienDuyet() đổi sang
 *     nhận 1 object (donVi, tuNgay, denNgay, minPct, maxPct, rowIndex tùy
 *     chọn để SỬA) thay vì 3 tham số vị trí như bản đầu - Index.html có
 *     nút "Sửa" riêng từng dòng (giống mẫu Phân quyền). Khi kiểm tra 1
 *     báo cáo vừa nộp (kiemTraDinhMucVaCanhBao_), giờ nhận thêm `ngayISO`
 *     (Ngày tồn kho của báo cáo) - tìm ĐÚNG dòng cấu hình có khoảng ngày
 *     CHỨA ngày đó; nếu nhiều dòng cùng Đơn vị chồng lấn ngày, ưu tiên
 *     dòng có "Từ ngày" GẦN NHẤT (coi là thiết lập mới hơn, ghi đè ý định
 *     dòng cũ Admin quên xóa).
 *  AA) "DIEUKIENDUYET" CHẶN LƯU (không chỉ gửi email) + MỞ FILE GỐC +
 *     PHÂN QUYỀN NHIỀU ĐƠN VỊ 1 LẦN (v2026.8.17):
 *     1. Trước đây (mục X/Z) lệch định mức CHỈ gửi email cảnh báo, báo
 *        cáo vẫn lưu chính thức bình thường - THEO YÊU CẦU MỚI: lệch định
 *        mức giờ CŨNG CHẶN không cho vào Chitiettonkho, dùng LẠI đúng cơ
 *        chế "Chờ duyệt" đã có sẵn cho "lệch đầu kỳ" (mục X) - Admin sửa
 *        xong đảm bảo số liệu thì duyệt ở Lịch Sử (duyệtBaoCao) mới chính
 *        thức tính vào Chitiettonkho/Dashboard/Báo cáo. kiemTraDinhMucVaCanhBao_
 *        đổi từ void sang trả về true/false (true = lệch); submitInventoryEntry
 *        gọi hàm này TRƯỚC syncChitietTonKhoForKey_ (thay vì sau như cũ) để
 *        kịp set "Chờ duyệt" trước khi đồng bộ Chitiettonkho. Admin nộp báo
 *        cáo vẫn được BỎ QUA việc chặn (tin tưởng toàn quyền) - chỉ nhận
 *        email nhắc kiểm tra lại số liệu, không bị "Chờ duyệt".
 *     2. Công cụ Admin (Cài đặt > Công cụ Admin) thêm nút "Mở file dữ liệu
 *        gốc (Google Sheet)" - gọi getSpreadsheetUrl() (admin-gated ở
 *        server) trả về SpreadsheetApp.getActive().getUrl(), mở tab mới -
 *        tiện tra soát trực tiếp Form Responses 1/PhanQuyen/DieuKienDuyet/
 *        Audit khi cần sâu hơn giao diện Web App cho phép.
 *     3. Phân quyền: ban đầu người dùng hỏi có cần thêm mức quyền "xem
 *        riêng" hay tách "Nhập, sửa" thành 2 quyền - hỏi lại thì xác nhận
 *        đây là NHẦM LẪN, "xem"/"xem riêng" là 1 (chỉ xem đúng Đơn vị được
 *        cấp), giữ nguyên 3 mức quyền cũ (Nhập-sửa/Xem/Admin), KHÔNG đổi
 *        schema PhanQuyen. Yêu cầu THẬT SỰ chỉ là: 1 email có thể được cấp
 *        NHIỀU Đơn vị cùng lúc dễ dàng hơn (trước đây phải lặp lại thao
 *        tác Thêm cho từng Đơn vị). Ô "Đơn vị" ở form Phân quyền đổi sang
 *        <select multiple> - khi THÊM MỚI (không phải Sửa) và quyền khác
 *        "admin", cho chọn nhiều Đơn vị (Ctrl/Cmd-click), client tự gọi
 *        luuPhanQuyen() TUẦN TỰ (tránh ghi đồng thời) 1 lần / Đơn vị đã
 *        chọn để tạo riêng từng dòng PhanQuyen (mỗi dòng vẫn 1 Đơn vị -
 *        không đổi cấu trúc sheet). Khi ĐANG SỬA 1 dòng có sẵn (có
 *        rowIndex) hoặc quyền = "admin", vẫn lưu 1 Đơn vị/rỗng như cũ.
 *  AB) 2 LỖI PHÁT SINH THỰC TẾ SAU KHI TRIỂN KHAI mục X/AA (v2026.8.17):
 *     1. "Chưa được cấp quyền" hiện SAI cho cả email Admin gốc: màn hình
 *        chặn hẳn (renderBlockedAccess_) hiện thông báo giống hệt nhau dù
 *        nguyên nhân là "server không lấy được email đăng nhập" (thường
 *        do deploy "Ai có quyền truy cập" = "Bất kỳ ai", không bắt đăng
 *        nhập, nên Session.getActiveUser().getEmail() trả về rỗng) HAY
 *        "có email nhưng chưa được cấp Phân quyền" - khiến Admin tưởng
 *        nhầm là lỗi Phân quyền. SỬA: renderBlockedAccess_ tách 2 thông
 *        báo riêng - email rỗng thì hiện hướng dẫn kiểm tra cấu hình
 *        Deploy/đăng nhập trình duyệt, KHÔNG nhắc tới Phân quyền.
 *     2. "Xem" 1 Đơn vị vẫn thấy dữ liệu CẢ 4 Đơn vị: getDashboardStats/
 *        getHistoryList/getReportSummary/getNhaMayDetailReport/
 *        getUnitTimeline trước đây CHỈ dựa vào việc Index.html tự ẩn bớt
 *        lựa chọn trong dropdown Đơn vị (myUnitOptions) - khi để bộ lọc
 *        trống ("-- Tất cả --", là lựa chọn MẶC ĐỊNH) thì server vẫn trả
 *        về TOÀN BỘ 4 Đơn vị cho bất kỳ ai gọi, kể cả người chỉ được
 *        cấp "Xem" đúng 1 Đơn vị (vd HAKQN) - không đúng ý đã thống nhất
 *        trước đó ("Xem chỉ được xem đúng dữ liệu Nhà máy được phân
 *        quyền"). SỬA: thêm hàm donViChoPhepCuaToi_(email) (trả về
 *        null = Admin không giới hạn, hoặc mảng Đơn vị được phép) - gọi
 *        NGAY ĐẦU mỗi hàm kể trên để lọc cứng ở server (không chỉ dựa
 *        giao diện, an toàn kể cả khi có ai gọi thẳng API). Đồng thời
 *        Index.html (renderHistory/renderReport) mặc định CHỌN SẴN Đơn
 *        vị được phân quyền (thay vì để "Tất cả") khi người dùng chỉ có
 *        đúng 1 Đơn vị, và tab "Báo Cáo Tổng Hợp > Theo khoảng thời
 *        gian" tự tải báo cáo luôn (đỡ phải bấm "Xem báo cáo" thêm 1
 *        lần); các nhãn "Tổng tồn kho cuối (4 đơn vị)"/"chưa báo cáo
 *        hôm nay / X đơn vị" ở Trang chủ cũng đổi sang lấy đúng số Đơn
 *        vị mà NGƯỜI ĐANG XEM được phép (s.units.length, đã lọc), không
 *        còn cố định "4" hay dùng số Đơn vị toàn công ty.
 *  AC) SỬA NGAY LỖI TIỀM ẨN CỦA mục AB TRƯỚC KHI XẢY RA THỰC TẾ
 *     (v2026.8.17) - người dùng hỏi "bot Telegram có bị ảnh hưởng bởi
 *     Phân quyền không": rà lại thì phát hiện CÓ RỦI RO THẬT - trigger
 *     tự động gửi báo cáo Telegram lúc 16h hàng ngày
 *     (BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_) gọi guiBaoCaoTrangChuTelegram_()
 *     KHÔNG kèm ngày -> gọi getDashboardStats() -> hàm này (mục AB mới
 *     thêm) tự lọc Đơn vị theo email người gọi. NHƯNG trigger nền (time-
 *     driven trigger) chạy KHÔNG có phiên đăng nhập trình duyệt, nên
 *     Session.getActiveUser().getEmail() (dùng trong getCurrentUserEmail_)
 *     THƯỜNG trả về RỖNG trong ngữ cảnh này (khác hẳn lúc mở Web App qua
 *     trình duyệt) - nếu coi rỗng là "0 quyền" thì mỗi lần trigger chạy
 *     sẽ lọc còn 0 Đơn vị, gửi ảnh báo cáo Telegram TRẮNG mỗi ngày lúc
 *     16h. SỬA: donViChoPhepCuaToi_() coi email RỖNG là KHÔNG giới hạn
 *     (giống Admin) - đúng bản chất báo cáo Telegram là báo cáo TOÀN
 *     CÔNG TY, không gắn với 1 người xem cụ thể. Luồng NHẬP/SỬA dữ liệu
 *     (submitInventoryEntry) và luồng chặn hẳn giao diện lúc mở Web App
 *     (getMyAccess/renderBlockedAccess_) KHÔNG dùng donViChoPhepCuaToi_,
 *     vẫn kiểm tra coQuyenGi/isAdmin trực tiếp như cũ - không bị nới
 *     lỏng theo thay đổi này, chỉ riêng các hàm ĐỌC báo cáo (Trang chủ/
 *     Lịch Sử/Báo Cáo Tổng Hợp/Chi tiết Nhà máy) được nới cho ngữ cảnh
 *     "không xác định được người gọi" (trigger/hệ thống) mới áp dụng.
 *  AD) SỬA CÔNG THỨC "LỆCH ĐẦU KỲ" + THÔNG BÁO/EMAIL RÕ LÝ DO
 *     (v2026.8.18) - THEO YÊU CẦU MỚI, đã hỏi lại và xác nhận với người
 *     dùng qua AskUserQuestion:
 *     1. CÔNG THỨC "Đầu kỳ dự kiến" (so sánh với "Tồn kho đầu ngày" vừa
 *        nhập để phát hiện lệch đầu kỳ): TRƯỚC ĐÂY chỉ so với TON_CK
 *        (Tồn kho CK) thô của báo cáo chính thức ngày liền trước - GIỜ
 *        = TON_CK đó (đã sẵn = Cộng MT Kho Nhà máy + Kho Tiên Sa MT +
 *        Kho Dung Quất MT, công thức Sheet có sẵn từ mục H) CỘNG THÊM
 *        "Điều chỉnh MT" (sheet CanDoiBDMT, mục K) NẾU CÓ cân đối BDMT
 *        xuất hàng ĐÚNG NGÀY với báo cáo đó (đã xác nhận: KHÔNG lấy tạm
 *        lần cân đối cũ hơn nếu đúng ngày không có) - xem
 *        tongDieuChinhMTCanDoiDungNgay_/timTonCuoiKyTruoc_ (hàm này đổi
 *        từ trả về 1 số sang trả về 1 object {ngayISO, ngayDisplay,
 *        tonCK, dieuChinhMT, tonCuoiKyDuKien}).
 *     2. THÔNG BÁO RÕ TRẠNG THÁI TRÊN WEB APP: kết quả trả về của
 *        submitInventoryEntry giờ LUÔN có dòng "TRẠNG THÁI: CHƯA DUYỆT"
 *        (kèm lý do cụ thể, hiện dạng toast dài hơn - xem hàm toast() ở
 *        Index.html, tự kéo dài thời gian hiện cho thông báo warn/err)
 *        hoặc "TRẠNG THÁI: ĐÃ DUYỆT" ngay sau khi nộp - không phải chờ
 *        vào Lịch Sử mới biết.
 *     3. CỘT MỚI "Lý do chờ duyệt" (COL.LY_DO_CHO_DUYET, cột AQ, thứ 43,
 *        NỐI VÀO CUỐI - CẦN CHẠY LẠI 1 LẦN DAM_BAO_COT_TRANG_THAI_DUYET()
 *        để thêm nhãn tiêu đề cho cột mới vào Form Responses 1 +
 *        Chitiettonkho, giống lần thêm "Trạng thái duyệt" ở mục X) - ghi
 *        lại NGAY LÚC nộp lý do vì sao "Chờ duyệt" (lệch đầu kỳ/lệch
 *        định mức/cả 2, gộp bằng " | ") - dùng để: (a) hiện ngay dưới
 *        badge trạng thái ở bảng Lịch Sử, (b) duyetBaoCao() đọc lại lý
 *        do NÀY khi gửi email duyệt/từ chối thay vì hardcode cứng "do
 *        lệch đầu kỳ" như trước (sai khi thực ra là lệch định mức).
 *        kiemTraDinhMucVaCanhBao_() đổi từ trả true/false sang trả
 *        false/CHUỖI LÝ DO (vẫn dùng được như boolean ở nơi gọi cũ).
 *     4. EMAIL "LỆCH ĐẦU KỲ" GIỜ GỬI CẢ CHO NGƯỜI NỘP (trước đây CHỈ
 *        gửi Admin, khác với "lệch định mức" đã gửi cả 2 từ đầu) - kèm
 *        lý do cụ thể (số Tồn đầu ngày đã nhập vs Đầu kỳ dự kiến, có
 *        breakdown Tồn CK + Điều chỉnh MT nếu có).
 *     5. LỊCH SỬ MẶC ĐỊNH BẬT SẴN "Chỉ hiện Chờ duyệt" (trước đây mặc
 *        định TẮT, và chỉ ADMIN thấy được checkbox này) - giờ áp dụng
 *        cho MỌI người dùng (an toàn vì đã lọc theo allowedUnits/mục AB
 *        ở getHistoryList, người dùng thường chỉ thấy đúng Đơn vị mình
 *        được cấp quyền, không lộ thêm gì).
 *     6. BADGE SỐ LƯỢNG "Chờ duyệt" Ở MENU: mục nav "Lịch Sử" hiện thêm
 *        số đếm (getSoLuongChoDuyet(), tự lọc theo allowedUnits, ẩn khi
 *        = 0) - tải lúc khởi động, sau khi nộp báo cáo, và sau khi
 *        Duyệt/Từ chối.
 *     (Email "khi được duyệt cũng gửi" - mục duyetBaoCao() - ĐÃ CÓ SẴN
 *     từ mục X, không cần thêm gì, chỉ sửa lại wording lấy đúng lý do ở
 *     mục 3 thay vì hardcode như nói ở trên.)
 *  AE) NGƯỜI DÙNG BÁO "ĐÃ TEST VÀ KHÔNG NHẬN ĐƯỢC EMAIL" (v2026.8.18) -
 *     rà lại thì phát hiện CẢ 3 CHỖ gửi email (lệch đầu kỳ, lệch định
 *     mức, duyệt/từ chối) đều bọc trong try/catch NUỐT LỖI ÂM THẦM (chỉ
 *     có comment "không để lỗi gửi mail làm hỏng luồng chính") - nếu
 *     MailApp.sendEmail() thất bại (VD hết quota gửi mail trong ngày -
 *     tài khoản Gmail cá nhân giới hạn ~100 mail/ngày, Google Workspace
 *     ~1500 mail/ngày; hoặc "to" sai định dạng...) thì KHÔNG CÓ CÁCH NÀO
 *     biết được lỗi thật, chỉ thấy hiện tượng "không nhận được mail".
 *     SỬA:
 *     1. Thêm guiEmailAnToan_(options, nguCanh) DÙNG CHUNG cho cả 3 chỗ
 *        gửi email tự động - vẫn KHÔNG throw làm hỏng luồng chính
 *        (giống trước), nhưng nếu lỗi thì GHI LẠI vào sheet Audit (cột
 *        Email = "(HỆ THỐNG)") kèm NGUYÊN VĂN lỗi thật từ Google + gửi
 *        tới địa chỉ nào + ngữ cảnh nào - vào Nhật Ký (Audit) trên Web
 *        App (hoặc mở thẳng sheet Audit) là thấy ngay, không cần đoán.
 *     2. Thêm công cụ Admin MỚI "Gửi email thử nghiệm" (Cài đặt > Công
 *        cụ Admin) - guiEmailThuNghiem(toEmail) gửi 1 email test tới
 *        địa chỉ tự nhập, CỐ Ý KHÔNG dùng guiEmailAnToan_ (để lỗi thật
 *        LỘ RA NGAY trên màn hình thay vì phải vào Audit tra) - cũng trả
 *        về luôn số quota MailApp còn lại trong ngày
 *        (MailApp.getRemainingDailyQuota()) khi gửi thành công, để Admin
 *        biết có đang gần hết quota hay không. Nếu gửi thành công nhưng
 *        người nhận vẫn báo không thấy, khả năng cao rơi vào Spam - đã
 *        ghi chú nhắc trong cả UI lẫn nội dung email test.
 *  AF) TRANG CHỦ - THÊM BDMT CHO "GỖ KEO NHẬP TRONG NGÀY" + "TỒN KHO" +
 *     THẺ "ĐỘ ẨM TRUNG BÌNH" (v2026.8.18) - THEO PHẢN HỒI người dùng
 *     "trang chủ tổng lượng gỗ keo nhập trong ngày mới có khối lượng MT,
 *     chưa có BDMT, tổng lượng tồn kho cũng chưa có BDMT, chưa có độ ẩm
 *     trung bình trong ngày":
 *     1. "Tổng lượng gỗ keo nhập" (nhapGo) là 1 Ô NHẬP TAY THUẦN, KHÔNG
 *        có cột Độ ẩm/Độ khô riêng đi kèm trong sheet - hỏi lại người
 *        dùng cách quy đổi và được xác nhận: DÙNG "Độ khô TB Kho Nhà
 *        máy" (COL.DO_KHO) đã ghi nhận CÙNG dòng/CÙNG ngày/CÙNG đơn vị
 *        đó → nhapGoBDMT = nhapGo × doKho (không cần thêm cột/sửa form
 *        nhập liệu). Áp dụng ở CẢ getDashboardStats() (Trang chủ +
 *        16h tự động) LẪN getDashboardStatsForDate_() (gửi lại báo cáo
 *        ngày cũ) để 2 nguồn số liệu luôn khớp nhau.
 *     2. "Tổng lượng tồn kho" (tongTonCK) vốn đã đúng bằng Cộng MT + Kho
 *        Tiên Sa MT + Kho Dung Quất MT (mục H) - BDMT tương ứng
 *        (tongTonCKBDMT) tính CÙNG CÔNG THỨC nhưng cộng các cột BDMT đã
 *        có sẵn (khoTotal.congBDMT + khoTotal.tienSaBDMT +
 *        khoTotal.dungQuatBDMT) - không cần số liệu mới.
 *     3. "Độ ẩm trung bình" MỚI - tính THEO TRỌNG SỐ khối lượng tồn kho
 *        (không phải trung bình cộng đơn giản giữa các đơn vị, vì mỗi
 *        đơn vị tồn kho nhiều/ít khác nhau): doAmTrungBinh = 1 -
 *        (tongTonCKBDMT / tongTonCK) - nhất quán với đúng số BDMT/MT
 *        đang hiển thị cùng lúc (doKho + doAm cộng lại luôn = 100%).
 *     Cả 3 số mới đều thêm vào Trang chủ (Index.html renderDashboard),
 *     ảnh + caption báo cáo Telegram (taoAnhBaoCaoTrangChu_/
 *     soanCaptionBaoCaoTrangChu_) để 2 nơi luôn khớp số.
 *  AG) TRANG CHỦ - THÊM "ĐỊNH MỨC TIÊU HAO HIỆN TẠI ÁP DỤNG" + "TỒN KHO
 *     TẠI CẢNG" + ĐỐI CHIẾU TỰ ĐỘNG "NHẬP GỖ KEO" VỚI PHIẾU CÂN NGOÀI
 *     (v2026.8.18) - THEO YÊU CẦU MỚI, đã hỏi lại 3 điểm mơ hồ trước khi
 *     làm (xem câu trả lời người dùng):
 *     1. "Định mức tiêu hao hiện tại áp dụng tại các nhà máy" (HAKQN,
 *        HAK, Đại Hiệp, CNQS - trùng khớp CFG.UNITS hiện có, không cần
 *        thêm đơn vị) - NGƯỜI DÙNG CHỌN hiển thị Định mức THỰC TẾ tính
 *        được (COL.DINH_MUC) của bản ghi GẦN NHẤT mỗi nhà máy (KHÔNG
 *        phải khoảng min%-max% cấu hình ở "Điều kiện duyệt" - đó là
 *        NGƯỠNG kiểm tra, không phải "định mức đang áp dụng thực tế").
 *        Thêm trường `dinhMuc` vào units[] của getDashboardStats() (đọc
 *        COL.DINH_MUC), hiển thị ở Trang chủ (card mới "Định mức tiêu
 *        hao hiện tại áp dụng").
 *     2. "Tồn Kho tại Cảng Tiên Sa, Dung Quất: MT/BDMT (tổng kg chi
 *        tiết)" - KHÔNG CẦN số liệu backend mới (khoTotal.tienSaMT/BDMT,
 *        dungQuatMT/BDMT đã có sẵn từ trước) - chỉ thêm 1 bảng mới ở
 *        Trang chủ (card "Tồn kho tại Cảng") quy đổi thêm ra kg
 *        (MT/BDMT × 1000) cho chi tiết hơn, cạnh số liệu MT/BDMT gốc.
 *     3. ĐỐI CHIẾU TỰ ĐỘNG "Nhập gỗ keo trong ngày" (nhập tay) với PHIẾU
 *        CÂN THỰC TẾ - mỗi Đơn vị có 1 file Google Sheet RIÊNG (NGOÀI
 *        file dữ liệu chính, do bộ phận cân xe ghi - xem
 *        CFG.PHIEUCAN_MAP): lấy TỔNG cột "KL hàng (KG)" (cột J) của các
 *        dòng có "Ngày cân 1" (cột B) = đúng Ngày tồn kho đang báo cáo,
 *        chia 1000 ra MT (xem docTongPhieuCanNgoai_). NGƯỜI DÙNG CHỌN:
 *          - % lệch = |Nhập gỗ keo - Tổng phiếu cân| / TỔNG PHIẾU CÂN
 *            (coi phiếu cân - số liệu cân THỰC TẾ từng xe - là chuẩn
 *            khách quan hơn số nhập tay, dùng làm MẪU SỐ).
 *          - Lệch ≤ 5% → coi như khớp, không cần báo (chữ "kg" người
 *            dùng gõ trong yêu cầu = viết tắt "không", đã thấy quy ước
 *            này nhiều lần trong hội thoại trước - vd "kg hề có sẵn").
 *          - Lệch > 5% → CÙNG cơ chế "Chờ duyệt" + gửi email như "lệch
 *            đầu kỳ"/"lệch định mức" đã có (xem
 *            kiemTraPhieuCanVaCanhBao_, gọi trong submitInventoryEntry
 *            NGAY SAU bước kiểm tra lệch định mức, gộp chung
 *            lyDoChoDuyetList/COL.LY_DO_CHO_DUYET nếu bị nhiều lỗi cùng
 *            lúc). Admin tự nộp vẫn BỎ QUA việc chặn (cùng nguyên tắc 2
 *            check trước) nhưng vẫn nhận email lưu ý.
 *          - Tên sheet/tab BÊN TRONG mỗi file phiếu cân: NGƯỜI DÙNG XÁC
 *            NHẬN trùng tên file (PhieuCan_DN/DH/QC/QS).
 *          - Nếu KHÔNG có dòng phiếu cân nào đúng ngày đó (chưa kịp
 *            nhập) HOẶC lỗi đọc file (chưa chia sẻ quyền Xem...) → BỎ
 *            QUA hoàn toàn (không báo lỗi/không chặn oan) - lỗi đọc file
 *            NGOÀI được ghi riêng vào Audit (email "(HỆ THỐNG)") để Admin
 *            biết mà xử lý, KHÔNG làm hỏng luồng nộp báo cáo chính.
 *        QUAN TRỌNG - CẦN LÀM 1 LẦN, KHÔNG TỰ ĐỘNG ĐƯỢC: tài khoản đứng
 *        sau Web App (mục "Execute as" lúc Deploy) phải được CHIA SẺ
 *        quyền Xem (Viewer) trên cả 4 file Phiếu cân trong
 *        CFG.PHIEUCAN_MAP thì đối chiếu mới đọc được - nếu chưa chia sẻ,
 *        mỗi lần nộp báo cáo sẽ tự ghi cảnh báo vào Audit thay vì chặn
 *        cứng, nên Admin cứ vào Nhật Ký (Audit) kiểm tra nếu thấy tính
 *        năng này "im lặng không hoạt động".
 *  AH) KHỐI "TỒN KHO TẠI CẢNG" - THÊM ĐỘ ẨM/ĐỘ KHÔ TRUNG BÌNH + KHỐI MỚI
 *     "CÂN ĐỐI XUẤT HÀNG" (v2026.8.18) - THEO YÊU CẦU MỚI:
 *     1. Độ ẩm/Độ khô TRUNG BÌNH của Kho Tiên Sa/Kho Dung Quất - tính
 *        CÙNG NGUYÊN TẮC mục O/Q (Báo Cáo Tổng Hợp): trung bình cộng
 *        ĐƠN GIẢN (KHÔNG theo trọng số khối lượng, khác với
 *        doAmTrungBinh của mục AF) chỉ trên đơn vị THỰC SỰ có tồn ở
 *        đúng kho đó (MT > 0) - bỏ qua đơn vị không xuất qua kho này
 *        (Độ ẩm/Độ khô ghi 0/rác nếu tính chung sẽ kéo lệch số). Cần
 *        đọc thêm COL.DO_AM_TIEN_SA/DO_KHO_TIEN_SA/DO_AM_DUNG_QUAT/
 *        DO_KHO_DUNG_QUAT (đã có sẵn cột, TRƯỚC ĐÓ getDashboardStats()
 *        chưa từng đọc 4 cột này).
 *     2. Khối "Cân đối xuất hàng" MỚI - hiện LẦN CÂN ĐỐI BDMT XUẤT HÀNG
 *        GẦN NHẤT (xem mục K/sheet CanDoiBDMT) của MỖI nhà máy (4 đơn
 *        vị), gồm Kho, Ngày cân đối, "Điều chỉnh MT"/"Điều chỉnh BDMT"
 *        (= LỆCH giữa số Kho Nhà máy đang ghi sổ và số THỰC TẾ đo lúc
 *        xuất hàng - dương = phải XUẤT điều chỉnh bổ sung, âm = phải
 *        NHẬP điều chỉnh bổ sung, xem computeCanDoiBDMT_). [SỬA LẠI ở
 *        mục AI ngay dưới - "gần nhất bất kỳ" dễ hiểu lầm là còn hiệu
 *        lực dù đã cũ, đổi sang so khớp ĐÚNG ngày báo kho.]
 *  AI) SỬA "CÂN ĐỐI XUẤT HÀNG" THEO ĐÚNG NGÀY BÁO KHO + CÔNG THỨC ĐỘ
 *     ẨM/ĐỘ KHÔ TỪ BDMT/MT + BOT TELEGRAM (v2026.8.18) - THEO YÊU CẦU
 *     MỚI, 3 điểm:
 *     1. "Cân đối xuất hàng" KHÔNG còn lấy lần cân đối GẦN NHẤT bất kỳ
 *        nữa (bản mục AH ban đầu) - CHỈ lấy đúng cân đối có "Ngày cân
 *        đối" (cột A) TRÙNG với "ngày báo kho" (= ngày báo cáo tồn kho
 *        gần nhất đang hiển thị, u.ngayGanNhatISO) của CHÍNH đơn vị đó;
 *        không có thì hiện "Chưa cân đối xuất hàng" (KHÔNG bị ẩn khỏi
 *        danh sách như trước) - xem layCanDoiBDMTDungNgayMoiDonVi_ (thay
 *        thế layCanDoiBDMTGanNhatMoiDonVi_ cũ).
 *     2. Công thức Độ ẩm/Độ khô cho TỔNG (không phải trung bình cộng)
 *        dùng CHUNG 1 quy tắc, đúng người dùng yêu cầu: Độ khô = TỔNG
 *        BDMT / TỔNG MT × 100%, Độ ẩm = 100% - Độ khô. Áp dụng cho dòng
 *        "Tổng cộng" của khối "Tồn kho tại Cảng" (trước đó để trống "–")
 *        VÀ cho "Tổng lượng gỗ keo nhập hàng ngày" (doAmNhapTB/
 *        doKhoNhapTB, mới thêm - KHÁC doAmTienSaTB/doKhoTienSaTB... của
 *        mục AH vốn là trung bình cộng đơn giản trên đơn vị có tồn).
 *     3. BOT TELEGRAM (ảnh + caption, dùng CHUNG
 *        taoAnhBaoCaoTrangChu_/soanCaptionBaoCaoTrangChu_ cho cả lịch
 *        16h tự động lẫn gửi thủ công): bổ sung dòng Độ ẩm/Độ khô của
 *        tổng lượng tồn (đã có từ mục AF) + tổng lượng nhập hàng ngày
 *        (mới). Mục "KHO XUẤT HÀNG" trong ẢNH ĐỔI từ bảng chi tiết theo
 *        đơn vị (addDataTable_, giống "KHO NHÀ MÁY") SANG chỉ báo BẰNG
 *        CHỮ (text đơn giản, theo đúng yêu cầu "chỉ báo bằng chữ Kho
 *        xuất hàng") - gồm Tổng MT/BDMT + Độ ẩm/Độ khô TỔNG của Kho Tiên
 *        Sa + Dung Quất gộp lại, kèm khối "Cân đối xuất hàng" (text,
 *        không phải bảng) ngay bên dưới. getDashboardStatsForDate_ (biến
 *        thể "gửi lại báo cáo ngày cũ") ĐƯỢC CẬP NHẬT ĐỒNG BỘ (đọc thêm
 *        4 cột Độ ẩm/Độ khô Tiên Sa/Dung Quất + gọi
 *        layCanDoiBDMTDungNgayMoiDonVi_ y hệt getDashboardStats gốc) để
 *        2 luồng Telegram (16h tự động vs gửi lại ngày cũ) luôn khớp số,
 *        không bị thiếu trường khi dùng chung 2 hàm dựng ảnh/caption ở
 *        trên.
 *  AJ) ĐỔI 3 KHỐI "ĐỊNH MỨC TIÊU HAO HIỆN TẠI ÁP DỤNG", "TỒN KHO TẠI
 *     CẢNG", "CÂN ĐỐI XUẤT HÀNG" SANG THẺ NHỎ "unit-card" (v2026.8.18) -
 *     CHỈ SỬA GIAO DIỆN Index.html, KHÔNG đổi logic/dữ liệu Code.gs. Theo
 *     yêu cầu người dùng (kèm ảnh mẫu thẻ "HAK (Bà Nà)" ở khối "Tình
 *     trạng theo đơn vị"): 3 khối trên trước đó hiện dạng bảng
 *     (Tồn kho tại Cảng, Cân đối xuất hàng dùng <table> overflow-x:auto)
 *     hoặc ô KPI to (Định mức tiêu hao) - nay ĐỔI ĐỒNG BỘ sang lưới thẻ
 *     nhỏ `class="grid cols-4"` chứa nhiều `.unit-card` (mỗi thẻ: tiêu đề
 *     `.uname` + các dòng `.urow` label/giá trị), giống hệt style thẻ
 *     "Tình trạng theo đơn vị" sẵn có. Chi tiết:
 *     1. "Định mức tiêu hao hiện tại áp dụng": mỗi đơn vị 1 thẻ - Định
 *        mức (%) + Ngày báo cáo.
 *     2. "Tồn kho tại Cảng": 3 thẻ - Kho Tiên Sa, Kho Dung Quất, Tổng
 *        cộng (thẻ Tổng cộng tô nền nhạt để nổi bật) - mỗi thẻ: MT,
 *        BDMT, Độ ẩm (TB hoặc TỔNG), Độ khô (TB hoặc TỔNG).
 *     3. "Cân đối xuất hàng": mỗi nhà máy 1 thẻ - có cân đối đúng ngày
 *        báo kho thì hiện Kho/Ngày cân đối/Điều chỉnh MT/Điều chỉnh
 *        BDMT; không có thì thẻ chỉ hiện nhãn "Chưa cân đối xuất hàng".
 *        [SỬA LẠI ở mục AK ngay dưới - gộp 3 khối này lại còn 1 thẻ mỗi
 *        khối + thêm khối mới "Độ ẩm trung bình nhà máy".]
 *  AK) GỘP 3 KHỐI TRANG CHỦ THÀNH 1 THẺ/KHỐI + THÊM "ĐỘ ẨM TRUNG BÌNH
 *     NHÀ MÁY" (v2026.8.18) - THEO YÊU CẦU MỚI, CHỈ SỬA GIAO DIỆN
 *     Index.html (KHÔNG đổi logic/dữ liệu Code.gs, mọi số liệu vẫn lấy
 *     từ getDashboardStats() có sẵn - kể cả canDoiBDMTList, tính gộp
 *     theo Kho được làm NGAY TẠI CLIENT). Thay bản "mỗi đơn vị 1 thẻ nhỏ"
 *     (mục AJ) bằng:
 *     1. "Định mức tiêu hao hiện tại áp dụng": GỘP 1 thẻ DUY NHẤT, mỗi
 *        đơn vị 1 dòng "Tên đơn vị: Định mức % (ngày báo cáo)".
 *     2. "Tồn kho tại Cảng" ĐỔI TÊN THÀNH "Kho xuất hàng" (khớp tên BOT
 *        Telegram, mục AI) - GỘP 1 thẻ DUY NHẤT, 2 dòng Kho Tiên Sa/Kho
 *        Dung Quất (MT/BDMT + Độ ẩm/Độ khô TB) - BỎ dòng "Tổng cộng"
 *        riêng (đã có sẵn ở thẻ KPI "Tổng tồn kho" đầu Trang chủ).
 *     3. "Cân đối xuất hàng" ĐỔI TÊN THÀNH "Cân đối kho xuất hàng" - GỘP
 *        1 thẻ DUY NHẤT theo YÊU CẦU MỚI "cộng tổng 4 đơn vị": thay vì
 *        hiện riêng từng nhà máy, CỘNG DỒN "Điều chỉnh MT"/"Điều chỉnh
 *        BDMT" của các nhà máy có cân đối đúng ngày báo kho THEO TỪNG
 *        KHO (Kho Tiên Sa / Kho Dung Quất, dựa vào c.kho của mỗi đơn vị
 *        trong canDoiBDMTList) -> 2 dòng tổng theo Kho; đơn vị chưa cân
 *        đối đúng ngày báo kho liệt kê tên ở dòng ghi chú cuối thẻ (không
 *        cộng vào tổng, KHÔNG ẩn khỏi giao diện).
 *     4. "Độ ẩm trung bình nhà máy" - KHỐI MỚI: dòng đầu là Độ ẩm/Độ khô
 *        trung bình CHUNG của Kho Nhà máy (KHÁC thẻ KPI "Độ ẩm trung
 *        bình" mục AF vốn tính TOÀN CÔNG TY gồm cả Cảng) - tính từ
 *        TỔNG congBDMT / TỔNG congMT (Cộng MT/BDMT Kho Nhà máy, đã có
 *        sẵn ở units[]) × 100% CÙNG công thức Độ khô/Độ ẩm dùng xuyên
 *        suốt (mục AI); mỗi đơn vị 1 dòng dùng Độ ẩm/Độ khô (u.doAm/
 *        u.doKho) + ngày báo cáo GẦN NHẤT của chính đơn vị đó.
 *     Cả 4 khối dùng thẻ `.unit-card` rộng 100% (không còn `grid cols-4`
 *     nhiều thẻ nhỏ) để "rộng ra, cân đối" với các khối phía trên theo
 *     đúng yêu cầu người dùng.
 *  AL) LIVE-FORMAT DẤU PHÂN CÁCH NGHÌN NGAY LÚC GÕ Ở CÁC Ô NHẬP MT/BDMT
 *     (v2026.8.18) - CHỈ SỬA GIAO DIỆN Index.html (KHÔNG đổi logic/dữ
 *     liệu Code.gs). THEO PHẢN HỒI người dùng: cách làm cũ (mục
 *     v2026.8.10 - "format khi BLUR, bỏ format khi FOCUS" để né lỗi nhảy
 *     con trỏ) khiến lúc ĐANG GÕ DỞ hoàn toàn không có dấu phân cách nên
 *     rất dễ gõ NHẦM THỪA/THIẾU SỐ 0 (VD gõ 100000 mà không để ý, trong
 *     khi ý định là 10000) vì không đếm được chữ số bằng mắt. Bổ sung
 *     listener 'input' cho mọi ô `.num-fmt` (xem liveFormatNumberInputValue_/
 *     attachNumberFormatting_ trong Index.html) - thêm dấu chấm phân
 *     cách nghìn NGAY SAU MỖI PHÍM GÕ (VD gõ "10000" sẽ thấy ngay
 *     "10.000" thay vì phải rời ô mới thấy), đồng thời TỰ TÍNH LẠI vị
 *     trí con trỏ (đếm số ký tự "có nghĩa" - chữ số/dấu phẩy thập
 *     phân/dấu trừ - đứng trước con trỏ ở giá trị CŨ rồi đặt con trỏ vào
 *     đúng vị trí tương ứng ở giá trị MỚI) để KHÔNG bị nhảy con trỏ như
 *     lo ngại ban đầu của mục v2026.8.10. KHÔNG ép đủ 2 số thập phân khi
 *     đang gõ dở (chỉ ép khi BLUR như cũ, dùng formatNumberInputValue_
 *     không đổi) để không cản trở việc gõ tiếp phần thập phân.
 *  AM) THU GỌN 3 KHỐI "ĐỊNH MỨC/KHO XUẤT HÀNG/CÂN ĐỐI KHO XUẤT HÀNG"
 *     THÀNH 1 HÀNG 3 Ô + ĐỒNG BỘ ẢNH/CAPTION TELEGRAM (v2026.8.18) -
 *     THEO YÊU CẦU MỚI, xác nhận qua NHIỀU vòng vẽ mockup (ảnh xem
 *     trước) trước khi code vào file thật, theo đúng yêu cầu người dùng
 *     "vẽ lại đưa tôi xem rồi code". Thay bản mục AK (mỗi khối 1
 *     `.card` riêng, xếp dọc, có thêm khối "Độ ẩm trung bình nhà máy"):
 *     1. GỘP CHUNG 1 `.card` DUY NHẤT (tiêu đề "Định mức tiêu hao hiện
 *        tại áp dụng"), bên trong dùng `grid cols-3` xếp 3 `.unit-card`
 *        NGANG HÀNG (Định mức tiêu hao / Kho xuất hàng / Cân đối kho
 *        xuất hàng) - THEO YÊU CẦU "1 dòng được 3 ô", rộng hơn bản mục
 *        AJ (4 thẻ nhỏ/hàng) nhưng KHÔNG dàn tràn 1 thẻ/hàng như mục AK.
 *     2. BỎ HẲN khối "Độ ẩm trung bình nhà máy" (mục AK) vì người dùng
 *        thấy TRÙNG LẶP với thẻ KPI "Độ ẩm trung bình" đã có sẵn đầu
 *        Trang chủ (mục AF) - không tính/hiện lại ở Index.html nữa.
 *     3. "Định mức tiêu hao hiện tại áp dụng": mỗi đơn vị 1 dòng, BỔ
 *        SUNG thêm Độ ẩm (u.doAm) NGAY TRONG dòng đó - "{đơn vị}: {Định
 *        mức}% với độ ẩm {Độ ẩm}% (ngày {ngày báo cáo})".
 *     4. "Kho xuất hàng": BỎ dòng "Tổng cộng" (đã có mục AK) VÀ BỎ Độ ẩm
 *        (chỉ giữ Độ khô) - "Kho Tiên Sa/Kho Dung Quất: {MT} MT / {BDMT}
 *        BDMT — {Độ khô}%" (KHÔNG còn chữ nhãn "Độ khô", chỉ số %).
 *     5. "Cân đối kho xuất hàng" (đổi tên từ "Cân đối xuất hàng"): BỎ
 *        chữ nhãn "Điều chỉnh" - chỉ còn "Kho Tiên Sa/Kho Dung Quất: MT
 *        {...} / BDMT {...}" (số vẫn CỘNG TỔNG theo Kho như mục AK).
 *     6. ĐỒNG BỘ ảnh (taoAnhBaoCaoTrangChu_) + caption
 *        (soanCaptionBaoCaoTrangChu_) BOT Telegram theo ĐÚNG 5 thay đổi
 *        trên - THÊM MỚI khối "ĐỊNH MỨC TIÊU HAO" vào ảnh/caption (TRƯỚC
 *        ĐÂY CHƯA TỪNG CÓ ở Telegram, chỉ có ở Trang chủ web từ mục AG).
 *        Ảnh Telegram (khung cố định CF.H=936, KHÔNG cuộn được) rút gọn
 *        khối "Cân đối kho xuất hàng" chỉ còn 2 dòng tổng theo Kho + 1
 *        dòng gộp tên đơn vị chưa cân đối (nếu có) - KHÁC caption (text
 *        thường, không giới hạn khung) vẫn liệt kê đủ từng đơn vị chưa
 *        cân đối, để không mất thông tin dù ảnh phải rút gọn cho vừa
 *        khung.
 *  AN) BỎ "ĐỊNH MỨC TIÊU HAO" + "CÂN ĐỐI KHO XUẤT HÀNG" KHỎI ẢNH/CAPTION
 *     TELEGRAM (v2026.8.18) - THEO YÊU CẦU MỚI: sau khi xem thử nội dung
 *     caption đầy đủ (mục AM) - người dùng hỏi "telegram báo text gì",
 *     được trả lời kèm cảnh báo caption ví dụ đã ~1170 ký tự, VƯỢT giới
 *     hạn 1024 ký tự Telegram cho phép (guiAnhTelegram_ tự cắt bớt phần
 *     dư) - người dùng chọn bỏ bớt 2 khối mới thêm ở mục AM để giảm rủi
 *     ro bị cắt, thay vì sắp xếp lại thứ tự. taoAnhBaoCaoTrangChu_ +
 *     soanCaptionBaoCaoTrangChu_ nay CHỈ còn "KHO XUẤT HÀNG" (giữ
 *     nguyên, không đổi định dạng mục AM) - BỎ HẲN 2 đoạn "ĐỊNH MỨC TIÊU
 *     HAO"/"CÂN ĐỐI KHO XUẤT HÀNG" vừa thêm. CHỈ sửa 2 hàm này (ảnh +
 *     caption Telegram) - Trang chủ (Index.html, mục AM) GIỮ NGUYÊN đủ 3
 *     khối (Định mức/Kho xuất hàng/Cân đối kho xuất hàng), vì Trang chủ
 *     không bị giới hạn ký tự như Telegram.
 *  AO) LÀM RÕ MỤC AN - CHỈ BỎ 2 KHỐI KHỎI CAPTION, KHÔI PHỤC LẠI Ở ẢNH
 *     (v2026.8.18) - THEO YÊU CẦU MỚI: người dùng làm rõ ý mục AN - CHỈ
 *     muốn bỏ "Định mức tiêu hao"/"Cân đối kho xuất hàng" khỏi CAPTION
 *     (phần CHỮ đi kèm ảnh, bị Telegram giới hạn CỨNG 1024 ký tự và tự
 *     cắt bớt phần dư - guiAnhTelegram_), KHÔNG phải bỏ khỏi ẢNH (ẢNH
 *     không bị giới hạn ký tự như caption, chỉ bị giới hạn CHIỀU CAO CỐ
 *     ĐỊNH của khung Slides CF.H=936 - đã tính đủ ngân sách chiều cao ở
 *     mục AM, y cuối cùng ~910/936). taoAnhBaoCaoTrangChu_ (ẢNH) KHÔI
 *     PHỤC LẠI đủ 3 khối (Định mức tiêu hao/Kho xuất hàng/Cân đối kho
 *     xuất hàng) - GIỮ NGUYÊN định dạng mục AM (không đổi lại cách trình
 *     bày). soanCaptionBaoCaoTrangChu_ (CAPTION) GIỮ NGUYÊN như mục AN
 *     (chỉ còn "Kho xuất hàng"). Trang chủ (Index.html) không đổi gì
 *     thêm ở mục này.
 *  AP) BỎ HẲN LẠI 2 KHỐI "ĐỊNH MỨC TIÊU HAO"/"CÂN ĐỐI KHO XUẤT HÀNG"
 *     KHỎI ẢNH TELEGRAM (v2026.8.18) - THEO YÊU CẦU MỚI: sau khi xem ẢNH
 *     THẬT do taoAnhBaoCaoTrangChu_ dựng (mục AO khôi phục lại 2 khối
 *     này), người dùng gửi ảnh chụp kèm nhận xét "phía dưới xấu quá,
 *     không cân đối, sau không để 3 khối như trang chủ webapp" - lý do:
 *     addText_/addRect_ (Slides API vẽ text/hình chữ nhật THÔ theo tọa
 *     độ x/y cố định) KHÔNG tự canh lề/bọc cột đẹp như CSS flexbox thật
 *     của `.unit-card` ở Trang chủ - 2 khối "Định mức tiêu hao"/"Cân đối
 *     kho xuất hàng" khi dựng bằng cách xếp dòng addText_ chồng lên nhau
 *     (mục AM/AO) bị xem là xấu/lộn xộn trong ẢNH THẬT, dù Y HỆT nội
 *     dung với bản trên Trang chủ. QUYẾT ĐỊNH: BỎ HẲN 2 khối này khỏi
 *     ẢNH (không cố canh chỉnh lại cho đẹp hơn) - taoAnhBaoCaoTrangChu_
 *     nay CHỈ còn "KHO XUẤT HÀNG", KHỚP Y HỆT caption
 *     (soanCaptionBaoCaoTrangChu_, mục AN, không đổi). Trang chủ
 *     (Index.html) KHÔNG đổi gì - vẫn giữ nguyên đủ 3 khối card đẹp như
 *     đã duyệt (mục AM), vì bố cục HTML/CSS thật không gặp vấn đề canh
 *     lề như Slides API.
 *  AQ) DỰNG LẠI ĐỦ 3 THẺ (Ô KHUNG THẬT) CHO ẢNH TELEGRAM - THAY VÌ BỎ
 *     (v2026.8.18) - THEO YÊU CẦU MỚI: người dùng gửi lại ảnh chụp 3 thẻ
 *     THẬT của Trang chủ, hỏi "sao không tạo 3 khối như Trang chủ" - LÀM
 *     RÕ lại mục AP: vấn đề KHÔNG phải ở NỘI DUNG 2 khối "Định mức tiêu
 *     hao"/"Cân đối kho xuất hàng" (nên bỏ hẳn), mà ở CÁCH DỰNG - mục
 *     AM/AO chỉ dùng addText_ xếp CHỮ CHỒNG DÒNG, KHÔNG có khung/nền
 *     (khác "TÌNH TRẠNG THEO ĐƠN VỊ" phía trên VỐN ĐÃ dùng addRect_ vẽ
 *     khung thẻ cho từng đơn vị, nhìn đẹp/cân đối bình thường) - đây mới
 *     là lý do bị chê xấu, KHÔNG phải do có 3 khối. SỬA ĐÚNG: dựng lại
 *     ĐỦ 3 thẻ (Định mức tiêu hao/Kho xuất hàng/Cân đối kho xuất hàng)
 *     NGANG HÀNG, MỖI thẻ 1 addRect_ (khung/nền CF.CARD/CF.BORDER, CÙNG
 *     CÁCH "TÌNH TRẠNG THEO ĐƠN VỊ") rộng bằng nhau (dmCardW = (CF.W -
 *     2*CF.M - 2*gap)/3), cao bằng nhau (dmCardH=190, tính theo thẻ
 *     nhiều dòng nhất - Định mức 4 đơn vị) để nhìn CÂN ĐỐI như ảnh chụp
 *     Trang chủ người dùng gửi. Nội dung/công thức mỗi thẻ GIỮ NGUYÊN
 *     như mục AM/AO (không đổi số liệu, chỉ đổi CÁCH VẼ). Ngân sách
 *     chiều cao: y bắt đầu ~704 (sau bảng Kho Nhà máy), +190 = ~894,
 *     trong khung CF.H=936 (dư ~42px, không tràn). Caption
 *     (soanCaptionBaoCaoTrangChu_) KHÔNG đổi - vẫn chỉ có "Kho xuất
 *     hàng" như mục AN (câu hỏi lần này chỉ về ẢNH).
 *  AR) PHÂN TÁN LẠI 3 KHỐI VÀO CÁC KHỐI SẴN CÓ TRÊN ẢNH TELEGRAM, THAY
 *     VÌ 1 HÀNG 3 THẺ RIÊNG (v2026.8.18) - THEO YÊU CẦU MỚI: người dùng
 *     gửi ảnh chụp 2 khối THẬT của Trang chủ (thẻ "Tình trạng theo đơn
 *     vị" + bảng "Kho Xuất Hàng" kiểu CŨ - dash-xuathang-wrap, KHÁC thẻ
 *     "Kho xuất hàng" tóm tắt mới ở mục AM) làm mẫu, yêu cầu 3 điểm:
 *     1. BỎ thẻ riêng "ĐỊNH MỨC TIÊU HAO" (mục AQ) - THÊM 1 dòng "Định
 *        mức" (fmtPctVN_(u.dinhMuc)) vào MỖI thẻ đơn vị ở "TÌNH TRẠNG
 *        THEO ĐƠN VỊ" (5 dòng thay vì 4: Ngày gần nhất/Tồn kho cuối/
 *        Nhập gỗ keo/Độ ẩm/Định mức) - cardH tăng 150->162, khoảng cách
 *        dòng giảm 20->18 để vừa 5 dòng mà không tăng quá nhiều chiều
 *        cao thẻ.
 *     2. "CÂN ĐỐI KHO XUẤT HÀNG" ĐỔI THÀNH 1 THẺ KPI (hàng 5 thẻ đầu
 *        Trang chủ), THAY THẾ thẻ "TỔNG LƯỢT NỘP FORM" (bỏ luôn, không
 *        còn hiện ở ảnh Telegram) - value = Tổng Điều chỉnh MT (cộng cả
 *        2 Kho), sub = Tổng Điều chỉnh BDMT - NGẮN GỌN, BỎ HẲN danh sách
 *        "Chưa cân đối: ..." (diễn giải chữ phía dưới) như bản thẻ card
 *        mục AQ.
 *     3. "KHO XUẤT HÀNG" bỏ dạng thẻ tóm tắt 2 dòng (mục AM/AQ) - QUAY
 *        LẠI bảng CHI TIẾT THEO ĐƠN VỊ bằng addDataTable_ (CÙNG CÁCH
 *        "KHO NHÀ MÁY" ngay phía trên) - cột: Đơn vị/Kho Tiên Sa MT/BDMT/
 *        Kho Dung Quất MT/BDMT + dòng Tổng cộng - giống HỆT bảng
 *        "Kho Xuất Hàng" kiểu cũ ở Trang chủ (ảnh mẫu người dùng gửi).
 *     Ngân sách chiều cao đã tính lại đủ 3 thay đổi trên: y cuối cùng
 *     ~918/936 (dư ~18px, không tràn). Caption
 *     (soanCaptionBaoCaoTrangChu_) KHÔNG đổi gì - vẫn chỉ có "Kho xuất
 *     hàng" như mục AN. Trang chủ (Index.html) KHÔNG đổi gì - vẫn giữ
 *     nguyên các khối hiện có.
 * ============================================================
 */

const CFG = {
  ADMIN_EMAILS: [
    "saoluucvhak@gmail.com",
    "phuthuy.apple@gmail.com"
  ],
  SHEET_RESPONSES: "Form Responses 1",
  SHEET_AUDIT: "Audit",
  SHEET_CHITIET: "Chitiettonkho",
  // Sheet log riêng cho tab "Cân đối BDMT xuất hàng" (mục K, v2026.8.12)
  // - độc lập hoàn toàn với Form Responses 1/Chitiettonkho, không dùng
  // COL/TOTAL_COL_COUNT ở trên (xem logCanDoiBDMT_).
  SHEET_CANDOIBDMT: "CanDoiBDMT",
  // 2 sheet mới (mục X, v2026.8.17) - xem ghi chú thiết kế ở mục X đầu
  // file: SHEET_PHANQUYEN lưu danh sách email được cấp quyền theo từng
  // Đơn vị (Nhập/Sửa | Xem | Admin); SHEET_DIEUKIENDUYET lưu khoảng định
  // mức (%) admin cấu hình cho từng Đơn vị để tự động kiểm tra khớp.
  SHEET_PHANQUYEN: "PhanQuyen",
  SHEET_DIEUKIENDUYET: "DieuKienDuyet",
  // Danh sách đơn vị báo cáo (đã thấy trong dữ liệu thực tế) - có thể
  // thêm/bớt tại đây nếu công ty mở thêm đơn vị mới.
  UNITS: ["HAK (Bà Nà)", "CNHAK (QS)", "Đại Hiệp (Đại Lộc)", "HAKQN (QS Trung)"],
  // Đối chiếu tự động "Nhập gỗ keo trong ngày" với PHIẾU CÂN THỰC TẾ -
  // mỗi Đơn vị có 1 file Google Sheet RIÊNG (KHÔNG thuộc file dữ liệu
  // đứng sau Web App này) do bộ phận cân xe ghi - xem mục AG,
  // v2026.8.18/kiemTraPhieuCanVaCanhBao_/docTongPhieuCanNgoai_. `id` lấy
  // từ URL file (đoạn giữa "/d/" và "/edit"); `sheetName` = tên
  // sheet/tab BÊN TRONG file đó (đã xác nhận TRÙNG tên file). QUAN
  // TRỌNG: tài khoản đứng sau Web App (mục "Execute as" lúc Deploy) BẮT
  // BUỘC phải được CHIA SẺ quyền Xem (Viewer) trên cả 4 file này thì mới
  // đọc được - nếu chưa chia sẻ, docTongPhieuCanNgoai_ sẽ lỗi và TỰ ĐỘNG
  // ghi cảnh báo vào Audit (không chặn luồng nộp báo cáo).
  PHIEUCAN_MAP: {
    "HAK (Bà Nà)": { id: "1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g", sheetName: "PhieuCan_DN" },
    "Đại Hiệp (Đại Lộc)": { id: "1VmfNI0Q6Q1f7KXJr_9sQjlhzUc9ngv91HWf1AR5SJZI", sheetName: "PhieuCan_DH" },
    "HAKQN (QS Trung)": { id: "1wR7ZcbdJjIJcsz-4kdLpgRqZq7zR7ewL6eP4t4oshWE", sheetName: "PhieuCan_QC" },
    "CNHAK (QS)": { id: "1Ul0PRtMr579jKcaNFLvPHH2AA2APdAp6dzuJKNwf9x4", sheetName: "PhieuCan_QS" }
  },
  // Số cột INPUT (người dùng nhập / web app ghi) tính từ cột A = cột
  // thứ 1 tới cột W = cột thứ 23. Từ cột X trở đi (thứ 24) là công
  // thức tính tự động, Web App không ghi trực tiếp mà copy công thức
  // xuống (xem extendFormulasToNewRow_).
  // v2026.8.5: +4 cột do thêm "Kho Dung Quất" - NỐI VÀO CUỐI sheet (sau
  // "Định mức") thay vì chèn giữa, cho đỡ rối / không dịch cột cũ (mục
  // H ở đầu file, đã đổi phương án so với v2026.8.4 ban đầu). 37 cột
  // gốc A..AK giữ NGUYÊN vị trí, cộng 4 cột mới AL..AO.
  // v2026.8.17 (mục X): +1 cột "Trạng thái duyệt" NỐI VÀO CUỐI (cột AP,
  // thứ 42) - CÙNG PHƯƠNG ÁN với Kho Dung Quất ở mục H (nối cuối, không
  // chèn giữa, không dịch cột cũ). Cột này KHÔNG PHẢI người dùng tự
  // nhập - Web App tự ghi "" (bình thường) hoặc "Chờ duyệt"/"Đã
  // duyệt"/"Từ chối" (xem COL.TRANG_THAI_DUYET). CẦN CHẠY 1 LẦN hàm
  // DAM_BAO_COT_TRANG_THAI_DUYET() (Apps Script Editor > chọn hàm > Run)
  // để thêm nhãn tiêu đề cho cột mới vào sheet thật (Form Responses 1 +
  // Chitiettonkho) - xem hàm đó để biết chi tiết.
  // v2026.8.18 (mục AD): +1 cột "Lý do chờ duyệt" NỐI VÀO CUỐI (cột AQ,
  // thứ 43) - CÙNG PHƯƠNG ÁN nối cuối như 2 lần mở rộng trước (Kho Dung
  // Quất mục H, Trạng thái duyệt mục X). Lưu lại (dạng text) VÌ SAO 1
  // dòng bị đánh "Chờ duyệt" (lệch đầu kỳ/lệch định mức/cả 2) NGAY LÚC
  // ghi - để khi Admin duyệt (duyetBaoCao) hoặc gửi email không cần đoán
  // lại lý do (xem COL.LY_DO_CHO_DUYET).
  INPUT_COL_COUNT: 25, // A..Y (không đổi - 2 cột input Dung Quất mới nằm NGOÀI dải này, ở cuối AL:AM, xem mục H)
  TOTAL_COL_COUNT: 43 // A..AQ
};

// Chỉ số cột 0-based (khớp mảng giá trị 1 dòng đọc bằng getValues()).
// v2026.8.5: 37 cột gốc (TIMESTAMP..DINH_MUC) giữ NGUYÊN chỉ số như bản
// trước khi có Kho Dung Quất - 4 cột Dung Quất (DUNG_QUAT_MT/BDMT +
// DO_AM_DUNG_QUAT/DO_KHO_DUNG_QUAT) NỐI VÀO CUỐI (mục H).
const COL = {
  TIMESTAMP: 0, EMAIL: 1, NGAY_BAO_CAO: 2, DON_VI: 3, NGAY_TON_KHO: 4,
  TON_DAU_NGAY: 5, HOA_NHON_MT: 6, HOA_NHON_BDMT: 7, QUE_SON_MT: 8, QUE_SON_BDMT: 9,
  DAI_HIEP_MT: 10, DAI_HIEP_BDMT: 11, HAKQN_MT: 12, HAKQN_BDMT: 13,
  DIEU_CHINH: 14, MUON_TRA: 15, NHAP_GO: 16, TIEN_SA_MT: 17, TIEN_SA_BDMT: 18,
  KIEM_KE_VET_BAI: 19, THOI_DIEM_VET_BAI: 20, KL_UOC_TINH_CON_LAI: 21, CHENH_LECH_VET_BAI: 22,
  RESERVED_X: 23, DO_AM_TIEN_SA: 24, DO_KHO_TIEN_SA: 25, CONG_MT: 26, CONG_BDMT: 27,
  DO_AM_HN: 28, DO_AM_QS: 29, DO_AM_DH: 30, DO_AM_QC: 31, DO_AM: 32, DO_KHO: 33,
  TON_CK: 34, NHAP_TRONG_KY: 35, DINH_MUC: 36,
  // --- Cột mới NỐI VÀO CUỐI (v2026.8.5, mục H) ---
  DUNG_QUAT_MT: 37, DUNG_QUAT_BDMT: 38,           // input (AL, AM)
  DO_AM_DUNG_QUAT: 39, DO_KHO_DUNG_QUAT: 40,       // công thức (AN, AO)
  // --- Cột mới NỐI VÀO CUỐI (v2026.8.17, mục X) - xem CFG.TOTAL_COL_COUNT ---
  TRANG_THAI_DUYET: 41,                            // Web App tự ghi (AP)
  // --- Cột mới NỐI VÀO CUỐI (v2026.8.18, mục AD) ---
  LY_DO_CHO_DUYET: 42                              // Web App tự ghi (AQ)
};

const utils = {
  isBlank: (v) => v === "" || v === null || v === undefined,
  parseNum: (v) => {
    if (typeof v === "number") return isNaN(v) ? 0 : v;
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
    return isNaN(n) ? 0 : n;
  },
  formatDate: (d) => (d instanceof Date && d.getFullYear() > 1900)
    ? Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy") : "",
  formatDateISO: (d) => (d instanceof Date && d.getFullYear() > 1900)
    ? Utilities.formatDate(d, "GMT+7", "yyyy-MM-dd") : "",
  isSameDay: (d1, d2) => {
    if (!(d1 instanceof Date) || !(d2 instanceof Date)) return false;
    return Utilities.formatDate(d1, "GMT+7", "yyyy-MM-dd") === Utilities.formatDate(d2, "GMT+7", "yyyy-MM-dd");
  },
  normEmail: (v) => String(v || "").trim().toLowerCase(),
  // THEO YÊU CẦU MỚI (mục X, v2026.8.17): Admin giờ có 2 nguồn - danh
  // sách cứng CFG.ADMIN_EMAILS (luôn có, không thể bị khóa nhầm ngay cả
  // khi sheet PhanQuyen bị xóa/sai) VÀ các email được gán quyền "admin"
  // trong sheet PhanQuyen (xem phanQuyenIsAdmin_) - CHỈ CẦN 1 TRONG 2 là
  // đủ. Toàn bộ chỗ gọi utils.isAdmin() sẵn có trong file (sửa/xóa Lịch
  // Sử, đồng bộ Chitiettonkho, gửi Telegram...) tự động áp dụng đúng
  // theo nguồn mới này, không cần sửa từng chỗ gọi riêng lẻ.
  isAdmin: (email) => {
    const e = utils.normEmail(email);
    if (CFG.ADMIN_EMAILS.map(utils.normEmail).includes(e)) return true;
    return phanQuyenIsAdmin_(e);
  }
};

function getCurrentUserEmail_() {
  try { return Session.getActiveUser().getEmail() || ""; } catch (e) { return ""; }
}

function doGet(e) {
  return HtmlService.createTemplateFromFile("Index").evaluate()
    .setTitle("QUẢN LÝ TỒN KHO DĂM - HAK GROUP")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// TRUY CẬP SHEET
// ============================================================
function getResponsesSheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEET_RESPONSES);
  if (!sh) throw new Error(`Không tìm thấy sheet "${CFG.SHEET_RESPONSES}".`);
  return sh;
}

/** Tự tìm dòng tiêu đề thực sự (có ô "Timestamp" ở cột A) trong 6 dòng
 * đầu - phòng trường hợp sheet có dòng trống/ẩn phía trên (freeze
 * panes tại A3 đã thấy trong dữ liệu thực tế), thay vì giả định cứng
 * header luôn ở dòng 1. */
function findHeaderRow_(sh) {
  const maxCheck = Math.min(6, sh.getLastRow());
  for (let r = 1; r <= maxCheck; r++) {
    const v = String(sh.getRange(r, 1).getValue() || "").trim().toLowerCase();
    if (v === "timestamp") return r;
  }
  return 1; // fallback
}

function getOrCreateAuditSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET_AUDIT);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_AUDIT);
    sh.appendRow(["Thời gian vi phạm", "Email", "Đơn vị", "Ngày tồn kho", "Lý do"]);
    sh.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#d9d9d9");
  }
  return sh;
}

function logAudit_(email, donVi, ngayTonKho, lyDo) {
  const sh = getOrCreateAuditSheet_();
  sh.appendRow([new Date(), email, donVi, ngayTonKho, lyDo]);
}

/** Gửi email AN TOÀN (không throw làm hỏng luồng chính) NHƯNG KHÔNG
 * NUỐT LỖI ÂM THẦM như trước (mục AE, v2026.8.18 - THEO PHẢN HỒI người
 * dùng "đã test và KHÔNG nhận được email"): mọi lỗi gửi mail (VD hết
 * quota MailApp trong ngày, "to" rỗng/sai định dạng, tài khoản chưa
 * được cấp quyền Gmail...) giờ được GHI LẠI vào sheet Audit (donVi =
 * "(HỆ THỐNG)") kèm nguyên văn lỗi - vào Nhật Ký (Audit) trên Web App
 * hoặc mở thẳng sheet Audit để xem lý do THẬT thay vì đoán mò. Trả về
 * true/false để nơi gọi biết gửi có thành công hay không nếu cần. */
function guiEmailAnToan_(options, nguCanh) {
  try {
    MailApp.sendEmail(options);
    return true;
  } catch (e) {
    try {
      logAudit_("(HỆ THỐNG)", "(HỆ THỐNG)", utils.formatDate(new Date()),
        "❌ GỬI EMAIL THẤT BẠI (" + (nguCanh || "?") + ") - to: " + (options && options.to) + " - lỗi: " + e.toString());
    } catch (e2) { /* kể cả ghi Audit cũng lỗi thì đành chịu, không throw tiếp */ }
    return false;
  }
}

// ============================================================
// PHÂN QUYỀN THEO ĐƠN VỊ (mục X, v2026.8.17) - sheet mới "PhanQuyen"
// ------------------------------------------------------------
// THEO YÊU CẦU MỚI: mỗi email được gán 1 hoặc nhiều dòng (Email, Đơn
// vị, Quyền) - Quyền là 1 trong 3: "nhap_sua" (nhập/sửa được báo cáo
// của đúng Đơn vị đó), "xem" (chỉ xem, không nhập/sửa được), "admin"
// (toàn quyền mọi Đơn vị + các chức năng quản trị khác - Đơn vị để
// trống cho dòng "admin"). ĐÃ THỐNG NHẤT với người dùng (v2026.8.17):
// - Phân quyền tính theo ĐƠN VỊ (4 pháp nhân), KHÔNG theo "nhà máy"
//   nguồn (Hòa Nhơn/Quế Sơn/Đại Hiệp/HAKQN) - vì 1 form nộp/sửa LUÔN
//   thuộc đúng 1 Đơn vị, khớp đúng cấu trúc dữ liệu hiện có.
// - Email CHƯA có dòng nào trong sheet này (và không nằm trong
//   CFG.ADMIN_EMAILS) bị CHẶN HẲN - không nhập/sửa/xem được gì cho tới
//   khi Admin chủ động thêm quyền (xem layPhanQuyenNguoiDung_,
//   getMyAccess() ở Index.html dùng để hiện màn "chưa được cấp quyền").
// ============================================================
function getOrCreatePhanQuyenSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET_PHANQUYEN);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_PHANQUYEN);
    sh.appendRow(["Email", "Đơn vị (để trống nếu Quyền = admin)", "Quyền (nhap_sua | xem | admin)", "Ghi chú", "Cập nhật lúc", "Cập nhật bởi"]);
    sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Cache trong phạm vi 1 lần thực thi (1 request Apps Script) - tránh
// đọc lại sheet PhanQuyen nhiều lần cho cùng 1 request (utils.isAdmin
// có thể được gọi rất nhiều lần trong 1 hàm). Bị xóa (= null) mỗi khi
// luuPhanQuyen()/xoaPhanQuyen() thay đổi dữ liệu.
let __phanQuyenCache = null;
function getPhanQuyenRows_() {
  if (__phanQuyenCache) return __phanQuyenCache;
  const sh = getOrCreatePhanQuyenSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) { __phanQuyenCache = []; return __phanQuyenCache; }
  const data = sh.getRange(2, 1, lastRow - 1, 3).getValues();
  __phanQuyenCache = data
    .filter(r => !utils.isBlank(r[0]))
    .map(r => ({ email: utils.normEmail(r[0]), donVi: String(r[1] || "").trim(), quyen: String(r[2] || "").trim().toLowerCase() }));
  return __phanQuyenCache;
}

function phanQuyenIsAdmin_(email) {
  return getPhanQuyenRows_().some(r => r.email === email && r.quyen === "admin");
}

/** Tổng hợp quyền của 1 email: admin (toàn quyền) hoặc danh sách Đơn vị
 * được Nhập/Sửa + danh sách Đơn vị được Xem (Nhập/Sửa TỰ ĐỘNG bao gồm
 * Xem). `coQuyenGi` = false nghĩa là email này CHƯA được cấp bất kỳ
 * quyền nào - Web App phải chặn hẳn (xem getMyAccess()). */
function layPhanQuyenNguoiDung_(email) {
  const e = utils.normEmail(email);
  const isAdminFull = utils.isAdmin(e);
  const rows = getPhanQuyenRows_().filter(r => r.email === e);
  const donViNhapSuaSet = new Set(), donViXemSet = new Set();
  rows.forEach(r => {
    if (r.quyen === "nhap_sua") { donViNhapSuaSet.add(r.donVi); donViXemSet.add(r.donVi); }
    else if (r.quyen === "xem") donViXemSet.add(r.donVi);
  });
  return {
    isAdmin: isAdminFull,
    donViNhapSua: Array.from(donViNhapSuaSet),
    donViXem: Array.from(donViXemSet),
    coQuyenGi: isAdminFull || rows.length > 0
  };
}

/** Danh sách Đơn vị mà 1 email được phép XEM dữ liệu (gộp cả Nhập/Sửa
 * lẫn Xem, vì Nhập/Sửa tự động bao gồm Xem) - dùng để CHẶN Ở SERVER cho
 * Dashboard/Lịch Sử/Báo Cáo Tổng Hợp/Chi tiết Nhà máy (mục AB,
 * v2026.8.17). THEO YÊU CẦU MỚI: trước đây các hàm getDashboardStats/
 * getHistoryList/getReportSummary/getNhaMayDetailReport/getUnitTimeline
 * CHỈ dựa vào việc giao diện tự ẩn bớt lựa chọn trong dropdown Đơn vị -
 * nhưng khi bộ lọc để trống (mặc định "-- Tất cả --") thì server vẫn
 * trả về TOÀN BỘ 4 Đơn vị cho bất kỳ ai, kể cả người chỉ được cấp
 * quyền "Xem" đúng 1 Đơn vị (ví dụ HAKQN) - không đúng ý đã thống nhất
 * "Xem chỉ được xem đúng dữ liệu Đơn vị được phân quyền". Trả về `null`
 * nghĩa là KHÔNG giới hạn (Admin - xem được hết); trả về 1 mảng (có thể
 * rỗng nếu chưa được cấp Đơn vị nào) nếu bị giới hạn.
 * QUAN TRỌNG (mục AC, v2026.8.17): email RỖNG (không xác định được
 * người gọi) được coi là KHÔNG giới hạn (giống Admin), KHÔNG PHẢI "0
 * Đơn vị". Đây là tình huống XUẤT HIỆN THẬT SỰ khi getDashboardStats()
 * được gọi từ trigger tự động 16h gửi báo cáo Telegram
 * (BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_) - trigger chạy nền không có
 * phiên đăng nhập trình duyệt nên Session.getActiveUser().getEmail()
 * thường trả về rỗng (khác hẳn lúc người dùng mở Web App qua trình
 * duyệt). Báo cáo Telegram vốn là báo cáo TOÀN CÔNG TY (không gắn với
 * 1 người xem cụ thể) - nếu coi email rỗng là "chưa được cấp quyền" thì
 * mỗi lần trigger chạy sẽ lọc còn 0 Đơn vị, gửi ảnh báo cáo TRẮNG mỗi
 * ngày lúc 16h - lỗi nghiêm trọng, ĐÃ PHÁT HIỆN VÀ SỬA TRƯỚC KHI xảy ra
 * trên thực tế. Luồng NHẬP/SỬA dữ liệu (submitInventoryEntry) và luồng
 * chặn hẳn giao diện lúc mở Web App (getMyAccess/renderBlockedAccess_)
 * KHÔNG dùng hàm này - vẫn kiểm tra coQuyenGi/isAdmin riêng như cũ, nên
 * không bị nới lỏng theo thay đổi này. */
function donViChoPhepCuaToi_(email) {
  const e = utils.normEmail(email);
  if (!e) return null; // không xác định được người gọi (trigger nền) - không giới hạn
  if (utils.isAdmin(e)) return null;
  const pq = layPhanQuyenNguoiDung_(e);
  return Array.from(new Set([].concat(pq.donViNhapSua || [], pq.donViXem || [])));
}

/** Dùng cho Index.html lúc khởi động - trả về quyền của người đang mở
 * Web App để: (a) chặn hẳn giao diện nếu coQuyenGi=false, (b) lọc bớt
 * danh sách Đơn vị hiển thị ở các dropdown cho khớp quyền Xem/Nhập. */
function getMyAccess() {
  const email = getCurrentUserEmail_();
  const pq = layPhanQuyenNguoiDung_(email);
  return Object.assign({ email }, pq);
}

/** Danh sách Phân quyền hiện có (CHỈ Admin xem được) - dùng cho màn
 * Cài đặt > Phân quyền. */
function getPhanQuyenList() {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { allowed: false, rows: [] };
  const sh = getOrCreatePhanQuyenSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return { allowed: true, rows: [] };
  const data = sh.getRange(2, 1, lastRow - 1, 6).getValues();
  const rows = data.map((r, i) => ({
    rowIndex: i + 2,
    email: String(r[0] || ""),
    donVi: String(r[1] || ""),
    quyen: String(r[2] || ""),
    ghiChu: String(r[3] || ""),
    capNhatLuc: r[4] instanceof Date ? utils.formatDate(r[4]) : String(r[4] || ""),
    capNhatBoi: String(r[5] || "")
  })).filter(r => r.email);
  return { allowed: true, rows };
}

/** Thêm mới (payload.rowIndex trống) hoặc sửa (payload.rowIndex có giá
 * trị) 1 dòng Phân quyền - CHỈ Admin. */
function luuPhanQuyen(payload) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được sửa Phân quyền." };
  payload = payload || {};
  const targetEmail = utils.normEmail(payload.email);
  if (!targetEmail) return { success: false, message: "❌ Vui lòng nhập Email." };
  const quyen = String(payload.quyen || "").trim().toLowerCase();
  if (["nhap_sua", "xem", "admin"].indexOf(quyen) === -1) return { success: false, message: "❌ Quyền không hợp lệ." };
  const donVi = quyen === "admin" ? "" : String(payload.donVi || "").trim();
  if (quyen !== "admin" && !donVi) return { success: false, message: "❌ Vui lòng chọn Đơn vị (trừ khi cấp Quyền = admin)." };

  const sh = getOrCreatePhanQuyenSheet_();
  const rowVals = [targetEmail, donVi, quyen, String(payload.ghiChu || ""), new Date(), email];
  if (payload.rowIndex) {
    const rowIndex = Number(payload.rowIndex);
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };
    sh.getRange(rowIndex, 1, 1, 6).setValues([rowVals]);
  } else {
    sh.appendRow(rowVals);
  }
  SpreadsheetApp.flush();
  __phanQuyenCache = null;
  return { success: true, message: "✅ Đã lưu phân quyền cho " + targetEmail + "." };
}

function xoaPhanQuyen(rowIndex) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được xóa Phân quyền." };
  const sh = getOrCreatePhanQuyenSheet_();
  if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };
  sh.deleteRow(rowIndex);
  __phanQuyenCache = null;
  return { success: true, message: "✅ Đã xóa phân quyền." };
}

// ============================================================
// ĐIỀU KIỆN KIỂM TRA DUYỆT - ĐỊNH MỨC THEO ĐƠN VỊ + KHOẢNG NGÀY ÁP
// DỤNG (mục X, v2026.8.17; THÊM khoảng ngày áp dụng ở mục Z, v2026.8.17)
// ------------------------------------------------------------
// Sheet mới "DieuKienDuyet": Admin nhập khoảng % (tối thiểu - tối đa)
// cho cột "Định mức" đã có sẵn (COL.DINH_MUC, tính tự động theo công
// thức Sheet, xem bảng "Định mức SX" ở báo cáo Tonkho_Damgo) của TỪNG
// Đơn vị. THEO YÊU CẦU MỚI (mục Z): định mức KHÔNG CỐ ĐỊNH MÃI MÃI -
// mỗi dòng cấu hình có thêm "Từ ngày"/"Đến ngày" xác định KHOẢNG NGÀY
// TỒN KHO mà định mức đó áp dụng, nên 1 Đơn vị có thể có NHIỀU dòng
// cấu hình cho các giai đoạn khác nhau (không còn giới hạn 1 dòng/Đơn
// vị như bản đầu). Bỏ trống "Từ ngày" = không giới hạn quá khứ, bỏ
// trống "Đến ngày" = áp dụng tới khi có thay đổi mới (không giới hạn
// tương lai). Sau mỗi lần nộp báo cáo (submitInventoryEntry), tìm ĐÚNG
// dòng cấu hình khớp Đơn vị + có khoảng ngày CHỨA ngày tồn kho của báo
// cáo đó - nếu Định mức tính được nằm NGOÀI khoảng cho phép, hệ thống
// tự gửi email cảnh báo "báo cáo chưa khớp định mức, đề nghị báo cáo
// lại" cho người nộp + Admin (xem kiemTraDinhMucVaCanhBao_) - KHÔNG
// chặn lưu báo cáo, chỉ cảnh báo.
// ============================================================
function getOrCreateDieuKienDuyetSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET_DIEUKIENDUYET);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_DIEUKIENDUYET);
    sh.appendRow(["Đơn vị", "Từ ngày (để trống = không giới hạn)", "Đến ngày (để trống = không giới hạn)", "Định mức tối thiểu (%)", "Định mức tối đa (%)", "Cập nhật lúc", "Cập nhật bởi"]);
    sh.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
    sh.setFrozenRows(1);
  }
  return sh;
}

function getDieuKienDuyetList() {
  const sh = getOrCreateDieuKienDuyetSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  const data = sh.getRange(2, 1, lastRow - 1, 7).getValues();
  return data.map((r, i) => ({
    rowIndex: i + 2,
    donVi: String(r[0] || "").trim(),
    tuNgayISO: utils.formatDateISO(r[1]), // "" nếu để trống -> không giới hạn quá khứ
    denNgayISO: utils.formatDateISO(r[2]), // "" nếu để trống -> không giới hạn tương lai
    tuNgayDisplay: utils.formatDate(r[1]),
    denNgayDisplay: utils.formatDate(r[2]),
    minPct: utils.parseNum(r[3]),
    maxPct: utils.parseNum(r[4]),
    capNhatLuc: r[5] instanceof Date ? utils.formatDate(r[5]) : String(r[5] || "")
  })).filter(r => r.donVi);
}

/** Thêm mới (payload.rowIndex trống) hoặc sửa (payload.rowIndex có giá
 * trị) 1 dòng Điều kiện kiểm tra duyệt - CHỈ Admin. THEO YÊU CẦU MỚI
 * (mục Z): 1 Đơn vị có thể có NHIỀU dòng cho các khoảng ngày khác nhau
 * (không còn tự động ghi đè theo Đơn vị như bản đầu mục X) - admin tự
 * quản lý các khoảng ngày không nên chồng lấn (nếu chồng lấn, xem
 * kiemTraDinhMucVaCanhBao_ để biết dòng nào được ưu tiên). */
function luuDieuKienDuyet(payload) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được sửa Điều kiện kiểm tra duyệt." };
  payload = payload || {};
  const donVi = String(payload.donVi || "").trim();
  if (!donVi) return { success: false, message: "❌ Vui lòng chọn Đơn vị." };
  const tuNgay = String(payload.tuNgay || "").trim();   // "" hợp lệ = không giới hạn quá khứ
  const denNgay = String(payload.denNgay || "").trim(); // "" hợp lệ = không giới hạn tương lai
  if (tuNgay && denNgay && tuNgay > denNgay) return { success: false, message: "❌ \"Từ ngày\" phải trước hoặc bằng \"Đến ngày\"." };
  const minPct = utils.parseNum(payload.minPct), maxPct = utils.parseNum(payload.maxPct);
  if (minPct > maxPct) return { success: false, message: "❌ Định mức tối thiểu phải nhỏ hơn hoặc bằng tối đa." };

  const sh = getOrCreateDieuKienDuyetSheet_();
  const rowVals = [donVi, tuNgay ? new Date(tuNgay) : "", denNgay ? new Date(denNgay) : "", minPct, maxPct, new Date(), email];
  if (payload.rowIndex) {
    const rowIndex = Number(payload.rowIndex);
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };
    sh.getRange(rowIndex, 1, 1, 7).setValues([rowVals]);
  } else {
    sh.appendRow(rowVals);
  }
  SpreadsheetApp.flush();
  return { success: true, message: "✅ Đã lưu điều kiện kiểm tra duyệt cho " + donVi + (tuNgay || denNgay ? " (" + (tuNgay || "…") + " → " + (denNgay || "…") + ")" : " (không giới hạn ngày)") + "." };
}

function xoaDieuKienDuyet(rowIndex) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được xóa Điều kiện kiểm tra duyệt." };
  const sh = getOrCreateDieuKienDuyetSheet_();
  if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };
  sh.deleteRow(rowIndex);
  return { success: true, message: "✅ Đã xóa." };
}

/** Kiểm tra "Định mức" (COL.DINH_MUC, công thức Sheet, đọc LẠI sau khi
 * đã ghi + kéo công thức) của báo cáo vừa nộp so với khoảng cho phép
 * ĐÚNG khoảng ngày áp dụng chứa "Ngày tồn kho" của báo cáo đó (mục Z) -
 * lệch ra ngoài thì gửi email cảnh báo cho người nộp + Admin, VÀ TRẢ VỀ
 * true để nơi gọi (submitInventoryEntry) gắn trạng thái "Chờ duyệt"
 * (mục AA, v2026.8.17 - SỬA LẠI so với bản đầu mục X: trước đây CHỈ
 * cảnh báo qua email rồi vẫn lưu chính thức bình thường; nay lệch định
 * mức cũng CHẶN không cho vào Chitiettonkho, CÙNG cơ chế "Chờ duyệt"
 * với "lệch đầu kỳ", chờ Admin duyệt ở Lịch Sử). Nếu có NHIỀU dòng cấu
 * hình cùng Đơn vị khớp ngày (khoảng ngày chồng lấn), ƯU TIÊN dòng có
 * "Từ ngày" GẦN NHẤT (mới thiết lập gần đây nhất) - coi như dòng mới
 * hơn ghi đè ý định của dòng cũ hơn mà Admin quên xóa. Trả về false nếu
 * không có cấu hình khớp hoặc định mức khớp khoảng cho phép. Bọc
 * try/catch ở nơi gọi để lỗi gửi mail (VD hết quota MailApp) không làm
 * hỏng luồng nộp báo cáo. */
/** Trả về `false` nếu KHÔNG lệch định mức (hoặc chưa cấu hình gì cho
 * Đơn vị/khoảng ngày này); trả về CHUỖI LÝ DO (truthy) nếu lệch - vừa
 * dùng làm điều kiện boolean ở nơi gọi, vừa dùng để ghi vào
 * COL.LY_DO_CHO_DUYET (mục AD, v2026.8.18 - trước đây chỉ trả
 * true/false, không lưu lại lý do cụ thể). Luôn gửi email cảnh báo
 * (submitter + Admin) như cũ khi lệch, bất kể Admin hay không. */
function kiemTraDinhMucVaCanhBao_(donVi, ngayISO, rowIndex, sh, submitterEmail) {
  const ungVien = getDieuKienDuyetList().filter(function (d) {
    if (d.donVi !== donVi) return false;
    if (d.tuNgayISO && ngayISO < d.tuNgayISO) return false;
    if (d.denNgayISO && ngayISO > d.denNgayISO) return false;
    return true;
  });
  if (!ungVien.length) return false; // Đơn vị chưa cấu hình định mức cho đúng khoảng ngày này -> bỏ qua, không báo gì

  // Ưu tiên "Từ ngày" gần nhất (chuỗi rỗng coi như xa xưa nhất, luôn xếp
  // sau các giá trị có ngày cụ thể khi so sánh chuỗi ISO yyyy-mm-dd).
  ungVien.sort(function (a, b) { return (b.tuNgayISO || "0000-00-00").localeCompare(a.tuNgayISO || "0000-00-00"); });
  const dieuKien = ungVien[0];

  const rawVal = sh.getRange(rowIndex, COL.DINH_MUC + 1).getValue();
  const dinhMucPct = utils.parseNum(rawVal) * 100; // cột lưu dạng thập phân (0.95 = 95%)
  if (dinhMucPct >= dieuKien.minPct && dinhMucPct <= dieuKien.maxPct) return false; // khớp định mức -> không cần báo

  const laAdmin = utils.isAdmin(submitterEmail);
  const khoangNgay = (dieuKien.tuNgayDisplay || "…") + " → " + (dieuKien.denNgayDisplay || "…");
  const lyDo = "Lệch định mức: Định mức tính được " + dinhMucPct.toFixed(2) + "% nằm NGOÀI khoảng cho phép (" +
    dieuKien.minPct + "% - " + dieuKien.maxPct + "%) áp dụng cho giai đoạn " + khoangNgay + ".";
  const subject = "⚠️ Báo cáo tồn kho CHƯA KHỚP định mức - " + donVi;
  const body = "Báo cáo tồn kho của đơn vị \"" + donVi + "\" (người nộp: " + submitterEmail + ") có Định mức tính được là " +
    dinhMucPct.toFixed(2) + "%, nằm NGOÀI khoảng cho phép (" + dieuKien.minPct + "% - " + dieuKien.maxPct + "%) áp dụng cho giai đoạn " + khoangNgay + ".\n\n" +
    (laAdmin
      ? "Người nộp là Admin nên báo cáo vẫn được lưu chính thức bình thường (không bị chặn) - email này chỉ để lưu ý kiểm tra lại số liệu."
      : "Báo cáo đã được LƯU ở trạng thái \"Chờ duyệt\" (CHƯA tính vào Chitiettonkho/Dashboard/Báo cáo). Vào trang Lịch Sử trên Web App để xem chi tiết và Duyệt/Từ chối, hoặc đề nghị người nộp kiểm tra lại số liệu và báo cáo lại.") +
    "\n\n(Email tự động từ Web App Quản Lý Tồn Kho Dăm - HAK Group)";
  const toList = [submitterEmail].concat(CFG.ADMIN_EMAILS).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  guiEmailAnToan_({ to: toList.join(","), subject: subject, body: body }, "lệch định mức - " + donVi);
  return lyDo;
}

/** Đọc TỔNG "KL hàng (KG)" (cột J) từ file Phiếu cân NGOÀI của 1 đơn vị,
 * lọc đúng "Ngày cân 1" (cột B) = ngayISO - dùng để đối chiếu tự động
 * với "Nhập gỗ keo trong ngày" (mục AG, v2026.8.18 - xem
 * CFG.PHIEUCAN_MAP + kiemTraPhieuCanVaCanhBao_). Trả về {tongKG, tongMT,
 * soDong} hoặc `null` nếu KHÔNG đọc được (đơn vị chưa cấu hình file/lỗi
 * quyền truy cập/đổi cấu trúc cột...) - lỗi này KHÔNG throw ra ngoài
 * (không được để 1 file NGOÀI lỗi làm hỏng luồng nộp báo cáo chính) mà
 * ghi vào Audit để Admin biết mà xử lý (thường do CHƯA CHIA SẺ quyền
 * Xem file đó cho tài khoản đứng sau Web App - xem CFG.PHIEUCAN_MAP). */
function docTongPhieuCanNgoai_(donVi, ngayISO) {
  const cfg = CFG.PHIEUCAN_MAP[donVi];
  if (!cfg) return null; // đơn vị chưa có file Phiếu cân cấu hình -> bỏ qua
  try {
    const ssNgoai = SpreadsheetApp.openById(cfg.id);
    const sh = ssNgoai.getSheetByName(cfg.sheetName) || ssNgoai.getSheets()[0];
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { tongKG: 0, tongMT: 0, soDong: 0 };
    // Đọc 1 lần cả khoảng B..J (9 cột: Ngày cân 1 ở B, KL hàng (KG) ở J)
    // cho nhanh, thay vì đọc từng cột riêng.
    const data = sh.getRange(2, 2, lastRow - 1, 9).getValues(); // B..J
    let tongKG = 0, soDong = 0;
    data.forEach(function (r) {
      const rISO = ngayCanDoiToISO_(r[0]); // cột B (Ngày cân 1) = index 0 trong khoảng B..J
      if (rISO !== ngayISO) return;
      tongKG += utils.parseNum(r[8]); // cột J (KL hàng KG) = index 8 trong khoảng B..J
      soDong++;
    });
    return { tongKG: tongKG, tongMT: tongKG / 1000, soDong: soDong };
  } catch (e) {
    try {
      logAudit_("(HỆ THỐNG)", donVi, utils.formatDate(new Date()),
        "❌ KHÔNG ĐỌC ĐƯỢC file Phiếu cân ngoài của \"" + donVi + "\" (ngày " + ngayISO + ") - lỗi: " + e.toString() +
        " - kiểm tra lại: (1) ID file trong CFG.PHIEUCAN_MAP còn đúng không, (2) tài khoản đứng sau Web App (mục \"Execute as\" lúc Deploy) đã được CHIA SẺ quyền Xem file đó chưa.");
    } catch (e2) { /* kể cả ghi Audit cũng lỗi thì đành chịu, không throw tiếp */ }
    return null;
  }
}

/** Đối chiếu "Nhập gỗ keo trong ngày" (người nhập tay trên form) với
 * TỔNG "KL hàng (KG)" từ file Phiếu cân NGOÀI đúng đơn vị/ngày (mục AG,
 * v2026.8.18) - THEO YÊU CẦU MỚI: lệch quá 5% (MẪU SỐ là TỔNG PHIẾU CÂN
 * - coi số liệu cân thực tế từng xe là chuẩn khách quan hơn số nhập tay)
 * -> CÙNG cơ chế "Chờ duyệt" + gửi email như "lệch đầu kỳ"/"lệch định
 * mức" (xem kiemTraDinhMucVaCanhBao_, cùng khuôn mẫu). Nếu KHÔNG có dữ
 * liệu phiếu cân đúng ngày đó (chưa kịp nhập/đơn vị chưa cấu hình
 * file/lỗi đọc file) THÌ BỎ QUA (không báo lỗi, không chặn oan) - vì
 * phiếu cân có thể đơn giản là CHƯA được nhập kịp lúc báo cáo tồn kho
 * được nộp, không có nghĩa là số liệu sai. */
function kiemTraPhieuCanVaCanhBao_(donVi, ngayISO, nhapGoMT, submitterEmail) {
  const kq = docTongPhieuCanNgoai_(donVi, ngayISO);
  if (!kq || kq.tongMT <= 0) return false;
  const pctLech = Math.abs(nhapGoMT - kq.tongMT) / kq.tongMT;
  if (pctLech <= 0.05) return false; // lệch trong 5% -> coi như khớp, không cần báo

  const laAdmin = utils.isAdmin(submitterEmail);
  const lyDo = "Lệch phiếu cân: \"Nhập gỗ keo trong ngày\" nhập tay (" + fmtNumVN_(nhapGoMT) + " MT) lệch " +
    (pctLech * 100).toFixed(2) + "% so với TỔNG Phiếu cân thực tế ngày " + ngayISO + " (" + fmtNumVN_(kq.tongMT) + " MT, " + kq.soDong + " phiếu cân) - vượt ngưỡng cho phép 5%.";
  const subject = "⚠️ Báo cáo tồn kho LỆCH PHIẾU CÂN - " + donVi;
  const body = "Báo cáo tồn kho của đơn vị \"" + donVi + "\" (người nộp: " + submitterEmail + ") có \"Nhập gỗ keo trong ngày\" nhập tay KHÔNG khớp TỔNG Phiếu cân thực tế (nguồn: file Phiếu cân ngoài, cột \"KL hàng (KG)\", lọc theo \"Ngày cân 1\").\n\n" +
    lyDo + "\n\n" +
    (laAdmin
      ? "Người nộp là Admin nên báo cáo vẫn được lưu chính thức bình thường (không bị chặn) - email này chỉ để lưu ý kiểm tra lại số liệu."
      : "Báo cáo đã được LƯU ở trạng thái \"Chờ duyệt\" (CHƯA tính vào Chitiettonkho/Dashboard/Báo cáo). Vào trang Lịch Sử trên Web App để xem chi tiết và Duyệt/Từ chối, hoặc đề nghị người nộp kiểm tra lại số liệu \"Nhập gỗ keo trong ngày\" và nộp lại.") +
    "\n\n(Email tự động từ Web App Quản Lý Tồn Kho Dăm - HAK Group)";
  const toList = [submitterEmail].concat(CFG.ADMIN_EMAILS).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  guiEmailAnToan_({ to: toList.join(","), subject: subject, body: body }, "lệch phiếu cân - " + donVi);
  return lyDo;
}

// ============================================================
// "CÂN ĐỐI BDMT XUẤT HÀNG" (mục K, v2026.8.13 - Web App TỰ TÍNH)
// ------------------------------------------------------------
// THEO YÊU CẦU MỚI (đã sửa lại so với bản đầu - lúc đầu là nhập tay,
// nay người dùng cung cấp ĐÚNG công thức và yêu cầu Web App TỰ TÍNH):
// tab tùy chọn ở màn "Nhập Tồn Kho" (sau tab "Kiểm kê vét bãi"), người
// dùng chỉ cần nhập: Kho (Tiên Sa/Dung Quất), "Độ ẩm cân đối" (%, gõ
// tay) và "Khối lượng thực tế MT" (gõ tay) - Web App tự tính toàn bộ
// chuỗi công thức còn lại rồi ghi 1 dòng log vào sheet riêng "CanDoiBDMT"
// (không đụng cột A..AO của Form Responses 1/Chitiettonkho/công thức
// chính, vì đây là sự kiện theo đơn hàng xuất bán, không phải tồn kho
// hàng ngày). Công thức (đúng theo yêu cầu, xem tính toán ở
// computeCanDoiBDMT_):
//   MT kho, BDMT kho       = lấy tại đúng Kho đã chọn, CHÍNH dòng đang
//                             nộp (payload.tienSaMT/BDMT hoặc
//                             dungQuatMT/BDMT tùy Kho) - vì đơn vị/ngày
//                             đang nộp đã tự nhập 2 số này ở tab "Kho
//                             Tiên Sa & Dung Quất" của CÙNG form rồi.
//   Độ khô kho (%)          = BDMT kho / MT kho × 100
//   Độ ẩm kho (%)           = 100 - Độ khô kho
//   Độ ẩm cân đối (%)       = payload.candoiDoAm (gõ tay)
//   Độ khô cân đối (%)      = 100 - Độ ẩm cân đối
//   Khối lượng thực tế MT   = payload.candoiMTThucTe (gõ tay)
//   Khối lượng thực tế BDMT = KL thực tế MT × Độ khô cân đối (dạng phân
//                             số 0..1)
//   Độ khô TB Kho Nhà máy   = đọc lại cột Y "Độ khô" (COL.DO_KHO) của
//                             CHÍNH dòng vừa lưu, SAU KHI Sheet đã tính
//                             xong công thức (sau extendFormulasToNewRow_
//                             + flush) - KHÔNG đoán công thức này, phải
//                             lấy đúng giá trị Sheet đã tính cho đơn
//                             vị/ngày đang nộp.
//   Điều chỉnh BDMT         = Khối lượng thực tế BDMT - BDMT kho
//                             (dương = Kho Nhà máy phải XUẤT điều chỉnh
//                             bổ sung BDMT; âm = phải NHẬP điều chỉnh bổ
//                             sung BDMT)
//   Điều chỉnh MT            = (Khối lượng thực tế BDMT / Độ khô TB Kho
//                             Nhà máy) - MT kho (cùng quy ước dấu, cho MT)
// Vì "Độ khô TB Kho Nhà máy" chỉ có SAU KHI lưu (phụ thuộc công thức
// Sheet), toàn bộ phép tính này chạy Ở SERVER sau khi đã appendRow +
// extendFormulasToNewRow_ + flush - KHÔNG tính trước ở client (Index.html
// chỉ xem trước được các phần không phụ thuộc công thức Sheet: MT/BDMT
// kho, Độ khô/Độ ẩm kho, Khối lượng thực tế BDMT).
// Cấu trúc sheet CanDoiBDMT (tự tạo nếu chưa có, cột theo đúng thứ tự
// tính toán ở trên để dễ tra soát):
//   A Ngày cân đối | B Kho | C MT kho | D BDMT kho | E Độ khô kho (%) |
//   F Độ ẩm kho (%) | G Độ ẩm cân đối (%) | H Độ khô cân đối (%) |
//   I Khối lượng thực tế MT | J Khối lượng thực tế BDMT |
//   K Độ khô TB Kho Nhà máy (%) | L Điều chỉnh BDMT | M Diễn giải BDMT |
//   N Điều chỉnh MT | O Diễn giải MT | P Đơn vị nhập | Q Email |
//   R Thời gian ghi
// LƯU Ý: nếu sheet "CanDoiBDMT" đã được tạo từ bản THỬ TRƯỚC (9 cột,
// nhập tay) thì cấu trúc cột cũ sẽ KHÔNG khớp - xóa sheet đó đi để Web
// App tự tạo lại đúng 18 cột mới ở trên.
// ============================================================
function getOrCreateCanDoiBDMTSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET_CANDOIBDMT);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_CANDOIBDMT);
    sh.appendRow([
      "Ngày cân đối", "Kho", "MT kho", "BDMT kho", "Độ khô kho (%)", "Độ ẩm kho (%)",
      "Độ ẩm cân đối (%)", "Độ khô cân đối (%)", "Khối lượng thực tế MT", "Khối lượng thực tế BDMT",
      "Độ khô TB Kho Nhà máy (%)", "Điều chỉnh BDMT", "Diễn giải BDMT", "Điều chỉnh MT", "Diễn giải MT",
      "Đơn vị nhập", "Email", "Thời gian ghi"
    ]);
    sh.getRange(1, 1, 1, 18).setFontWeight("bold").setBackground("#d9d9d9");
  }
  return sh;
}

/** Tự tính toàn bộ chuỗi công thức "Cân đối BDMT xuất hàng" (mục K) cho
 * ĐÚNG dòng vừa lưu (newRowIndex) - đọc lại "Độ khô TB Kho Nhà máy" từ
 * chính dòng đó SAU KHI Sheet đã tính công thức xong. Trả về object kết
 * quả đầy đủ để vừa ghi vào sheet CanDoiBDMT vừa trả cho Index.html hiển
 * thị popup kết quả, hoặc { error: "..." } nếu thiếu số liệu không tính
 * được (KHÔNG throw - lỗi này không nên làm hỏng việc lưu báo cáo chính
 * đã thành công trước đó). */
function computeCanDoiBDMT_(sh, newRowIndex, kho, mtKho, bdmtKho, doAmCanDoi, mtThucTe, donVi, ngayTonKho, email) {
  if (!mtKho) {
    return { error: `Chưa có số liệu "MT kho" cho "${kho}" ở đơn vị/ngày đang nộp - vui lòng nhập ở tab "Kho Tiên Sa & Dung Quất" trước khi tất toán Cân đối BDMT xuất hàng.` };
  }
  const doKhoTBNhaMayFrac = utils.parseNum(sh.getRange(newRowIndex, COL.DO_KHO + 1).getValue());
  if (!doKhoTBNhaMayFrac) {
    return { error: `Chưa tính được "Độ khô TB Kho Nhà máy" cho đơn vị/ngày đang nộp - vui lòng đảm bảo đã nhập đủ số liệu MT/BDMT ở tab "Nhà máy (MT/BDMT)" trước khi tất toán Cân đối BDMT xuất hàng.` };
  }

  const doKhoKhoPct = bdmtKho / mtKho * 100;
  const doAmKhoPct = 100 - doKhoKhoPct;
  const doKhoCanDoi = 100 - doAmCanDoi;
  const klThucTeBDMT = mtThucTe * (doKhoCanDoi / 100);
  const doKhoTBNhaMayPct = doKhoTBNhaMayFrac * 100;

  const dieuChinhBDMT = klThucTeBDMT - bdmtKho;
  const dieuChinhMT = (klThucTeBDMT / doKhoTBNhaMayFrac) - mtKho;
  const dienGiai = (v, don) => v > 0
    ? `Dương - Kho Nhà máy phải XUẤT điều chỉnh bổ sung ${don} về "${kho}".`
    : (v < 0 ? `Âm - Kho Nhà máy phải NHẬP điều chỉnh bổ sung ${don} ở kho Nhà máy.` : `Đã khớp - không cần điều chỉnh ${don}.`);

  return {
    ngayCanDoi: utils.formatDate(ngayTonKho), kho, donVi, email,
    mtKho, bdmtKho, doKhoKhoPct, doAmKhoPct,
    doAmCanDoi, doKhoCanDoi, mtThucTe, klThucTeBDMT, doKhoTBNhaMayPct,
    dieuChinhBDMT, dieuChinhMT,
    dienGiaiBDMT: dienGiai(dieuChinhBDMT, "BDMT"),
    dienGiaiMT: dienGiai(dieuChinhMT, "MT")
  };
}

function logCanDoiBDMT_(r) {
  const sh = getOrCreateCanDoiBDMTSheet_();
  sh.appendRow([
    r.ngayCanDoi, r.kho, r.mtKho, r.bdmtKho, r.doKhoKhoPct, r.doAmKhoPct,
    r.doAmCanDoi, r.doKhoCanDoi, r.mtThucTe, r.klThucTeBDMT, r.doKhoTBNhaMayPct,
    r.dieuChinhBDMT, r.dienGiaiBDMT, r.dieuChinhMT, r.dienGiaiMT,
    r.donVi, r.email, new Date()
  ]);
}

/** Lấy LẦN CÂN ĐỐI BDMT XUẤT HÀNG đúng "ngày báo kho" (= ngày báo cáo
 * tồn kho gần nhất hiện đang hiển thị ở Trang chủ) của MỖI nhà máy (cột
 * P "Đơn vị nhập") từ sheet CanDoiBDMT - dùng cho khối "Cân đối xuất
 * hàng" ở Trang chủ/Telegram (mục AH/AI, v2026.8.18 - xem
 * getDashboardStats). THEO YÊU CẦU MỚI (mục AI): KHÔNG lấy lần cân đối
 * GẦN NHẤT bất kỳ nữa (dễ hiểu lầm là "còn hiệu lực" dù đã cũ) - CHỈ lấy
 * ĐÚNG cân đối có "Ngày cân đối" (cột A) TRÙNG với ngày báo kho của
 * chính đơn vị đó; nếu không có, coi như "Chưa cân đối xuất hàng". Tham
 * số `donViNgayISOMap` = {donVi: "yyyy-mm-dd" (ngày báo kho gần nhất
 * của đơn vị đó) | null}. Trả về {donVi: {...coCanDoi:true} |
 * {donVi, coCanDoi:false}} cho ĐÚNG các đơn vị có trong map (thường là
 * `units` đã lọc theo Phân quyền). Nếu 1 ngày có NHIỀU lần cân đối
 * (hiếm) thì lấy lần GHI SAU CÙNG (cột R "Thời gian ghi"). */
function layCanDoiBDMTDungNgayMoiDonVi_(donViNgayISOMap) {
  const result = {};
  Object.keys(donViNgayISOMap).forEach(function (u) {
    result[u] = { donVi: u, coCanDoi: false };
  });
  const sh = getOrCreateCanDoiBDMTSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return result;
  const data = sh.getRange(2, 1, lastRow - 1, 18).getValues();
  const bestTime = {};
  data.forEach(function (r) {
    const donVi = String(r[15] || "").trim(); // P Đơn vị nhập
    if (!donVi || !(donVi in result)) return;
    const ngayBaoKhoISO = donViNgayISOMap[donVi];
    if (!ngayBaoKhoISO) return; // đơn vị chưa từng có báo cáo tồn kho -> không có "ngày báo kho" để so khớp
    const rISO = ngayCanDoiToISO_(r[0]); // A Ngày cân đối
    if (rISO !== ngayBaoKhoISO) return; // KHÔNG đúng ngày báo kho -> bỏ qua (mục AI)
    const thoiGianGhi = r[17]; // R Thời gian ghi
    const tgTime = thoiGianGhi instanceof Date ? thoiGianGhi.getTime() : 0;
    if (result[donVi].coCanDoi && bestTime[donVi] >= tgTime) return; // đã có bản ghi mới hơn/bằng cùng ngày
    bestTime[donVi] = tgTime;
    result[donVi] = {
      donVi: donVi,
      coCanDoi: true,
      kho: String(r[1] || "").trim(), // B Kho
      ngayCanDoi: utils.formatDate(new Date(rISO + "T00:00:00")),
      dieuChinhBDMT: utils.parseNum(r[11]), // L
      dienGiaiBDMT: String(r[12] || ""),    // M
      dieuChinhMT: utils.parseNum(r[13]),   // N
      dienGiaiMT: String(r[14] || ""),      // O
      thoiGianGhi: thoiGianGhi instanceof Date ? utils.formatDate(thoiGianGhi) : ""
    };
  });
  return result;
}

/** Đọc toàn bộ dữ liệu (không header) dạng mảng 2 chiều. */
function readAllData_() {
  const sh = getResponsesSheet_();
  const headerRow = findHeaderRow_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow <= headerRow) return { sh, headerRow, data: [] };
  const data = sh.getRange(headerRow + 1, 1, lastRow - headerRow, CFG.TOTAL_COL_COUNT).getValues();
  return { sh, headerRow, data };
}

// ============================================================
// SHEET "Chitiettonkho" - BẢNG DỮ LIỆU SẠCH, 1 DÒNG / (Đơn vị, Ngày
// tồn kho), TỰ ĐỘNG ĐỒNG BỘ (mục E trong ghi chú đầu file)
// ============================================================
function getOrCreateChitietSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET_CHITIET);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_CHITIET);
    const shSrc = getResponsesSheet_();
    const headerRow = findHeaderRow_(shSrc);
    const headerVals = shSrc.getRange(headerRow, 1, 1, CFG.TOTAL_COL_COUNT).getValues();
    sh.getRange(1, 1, 1, CFG.TOTAL_COL_COUNT).setValues(headerVals).setFontWeight("bold").setBackground("#d9ead3");
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAllChitietData_() {
  const sh = getOrCreateChitietSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return { sh, data: [] };
  const data = sh.getRange(2, 1, lastRow - 1, CFG.TOTAL_COL_COUNT).getValues();
  return { sh, data };
}

/** Tìm index (0-based, trong mảng data không tính header) của dòng
 * Chitiettonkho khớp đúng (donVi, ngayISO), hoặc -1 nếu chưa có. */
function findChitietIndex_(chData, donVi, ngayISO) {
  for (let i = 0; i < chData.length; i++) {
    const r = chData[i];
    if (String(r[COL.DON_VI] || "").trim() === donVi && utils.formatDateISO(r[COL.NGAY_TON_KHO]) === ngayISO) return i;
  }
  return -1;
}

/**
 * Đồng bộ lại DÚNG 1 dòng của Chitiettonkho cho 1 khóa (donVi, ngayISO):
 * quét lại TOÀN BỘ "Form Responses 1" khớp khóa này, lấy bản ghi có
 * Timestamp MỚI NHẤT làm dữ liệu chính thức, rồi upsert vào
 * Chitiettonkho (nếu không còn bản ghi nào khớp - ví dụ Admin vừa xóa
 * hết ở Lịch Sử - thì xóa luôn dòng tương ứng trong Chitiettonkho).
 * Gọi hàm này sau MỌI thao tác làm thay đổi dữ liệu của 1 khóa: nộp
 * mới (Form/Web App), sửa, xóa.
 */
function syncChitietTonKhoForKey_(donVi, ngayISO) {
  if (!donVi || !ngayISO) return;
  const { data: formData } = readAllData_();
  const matches = formData.filter(r =>
    String(r[COL.DON_VI] || "").trim() === donVi && utils.formatDateISO(r[COL.NGAY_TON_KHO]) === ngayISO);

  // THEO YÊU CẦU MỚI (mục X, v2026.8.17): bản ghi đang "Chờ duyệt" (lệch
  // đầu kỳ, chưa được Admin duyệt) hoặc đã "Từ chối" KHÔNG được coi là
  // dữ liệu chính thức - loại khỏi danh sách xét "mới nhất" để đồng bộ
  // vào Chitiettonkho (dù vẫn giữ nguyên trong Form Responses 1/Lịch Sử
  // để Admin xem lại/duyệt sau). Nếu TOÀN BỘ các lần nộp khớp khóa này
  // đều đang chờ duyệt/bị từ chối thì coi như CHƯA có báo cáo chính
  // thức cho (Đơn vị, Ngày) đó - xóa khỏi Chitiettonkho nếu trước đó có.
  const officialMatches = matches.filter(r => {
    const st = String(r[COL.TRANG_THAI_DUYET] || "");
    return st !== "Chờ duyệt" && st !== "Từ chối";
  });

  const chSh = getOrCreateChitietSheet_();
  const chLastRow = chSh.getLastRow();
  const chData = chLastRow > 1 ? chSh.getRange(2, 1, chLastRow - 1, CFG.TOTAL_COL_COUNT).getValues() : [];
  const existingIndex = findChitietIndex_(chData, donVi, ngayISO);

  if (officialMatches.length === 0) {
    if (existingIndex >= 0) chSh.deleteRow(existingIndex + 2); // +2: bù header (dòng 1) + 1-based
    return;
  }

  officialMatches.sort((a, b) => {
    const ta = a[COL.TIMESTAMP] instanceof Date ? a[COL.TIMESTAMP].getTime() : 0;
    const tb = b[COL.TIMESTAMP] instanceof Date ? b[COL.TIMESTAMP].getTime() : 0;
    return tb - ta; // mới nhất trước
  });
  const latest = officialMatches[0];

  if (existingIndex >= 0) {
    chSh.getRange(existingIndex + 2, 1, 1, CFG.TOTAL_COL_COUNT).setValues([latest]);
  } else {
    chSh.appendRow(latest);
  }
}

/**
 * Đồng bộ lại TOÀN BỘ Chitiettonkho từ đầu, dựa trên toàn bộ dữ liệu
 * hiện có trong "Form Responses 1" - dùng 1 LẦN sau khi triển khai để
 * lấp đầy dữ liệu lịch sử đã có sẵn trước khi có sheet Chitiettonkho
 * (xem mục E ở đầu file), hoặc bất cứ khi nào nghi ngờ 2 sheet bị lệch
 * nhau. Chỉ Admin được chạy (qua Web App).
 */
function rebuildAllChitietTonKho() {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được đồng bộ lại Chitiettonkho." };

    const { data: formData } = readAllData_();
    const latestByKey = {}; // key = donVi + "|" + ngayISO -> row mới nhất
    formData.forEach(r => {
      const donVi = String(r[COL.DON_VI] || "").trim();
      const ngayISO = utils.formatDateISO(r[COL.NGAY_TON_KHO]);
      if (!donVi || !ngayISO) return;
      // THEO YÊU CẦU MỚI (mục X, v2026.8.17): giữ ĐỒNG NHẤT với
      // syncChitietTonKhoForKey_ - bỏ qua bản ghi "Chờ duyệt"/"Từ chối"
      // khi chọn bản "mới nhất" cho mỗi khóa, để "Đồng bộ lại
      // Chitiettonkho từ đầu" không vô tình đưa báo cáo lệch đầu kỳ
      // chưa được duyệt thành dữ liệu chính thức.
      const trangThai = String(r[COL.TRANG_THAI_DUYET] || "");
      if (trangThai === "Chờ duyệt" || trangThai === "Từ chối") return;
      const key = donVi + "|" + ngayISO;
      const ts = r[COL.TIMESTAMP] instanceof Date ? r[COL.TIMESTAMP].getTime() : 0;
      if (!latestByKey[key] || ts > latestByKey[key].__ts) {
        latestByKey[key] = r;
        latestByKey[key].__ts = ts; // đính kèm tạm để so sánh, không ghi vào sheet
      }
    });

    const chSh = getOrCreateChitietSheet_();
    const chLastRow = chSh.getLastRow();
    if (chLastRow > 1) chSh.getRange(2, 1, chLastRow - 1, CFG.TOTAL_COL_COUNT).clearContent();

    const rows = Object.values(latestByKey).map(r => {
      const clean = r.slice(0, CFG.TOTAL_COL_COUNT);
      return clean;
    });
    if (rows.length > 0) {
      chSh.getRange(2, 1, rows.length, CFG.TOTAL_COL_COUNT).setValues(rows);
    }

    SpreadsheetApp.flush();
    return { success: true, message: `✅ Đã đồng bộ lại Chitiettonkho: ${rows.length} dòng (1 dòng / Đơn vị+Ngày).` };
  } catch (err) {
    return { success: false, message: "❌ Lỗi: " + err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ============================================================
// KÉO CÔNG THỨC XUỐNG DÒNG MỚI (mục C trong ghi chú đầu file)
// ------------------------------------------------------------
// v2026.8.5 (mục H): TỪ KHI CÓ "Kho Dung Quất" nối vào CUỐI sheet, dải
// cột công thức KHÔNG còn liền mạch 1 khối nữa - dải gốc Y..AK
// (DO_AM_TIEN_SA..DINH_MUC) và dải mới AN..AO (DO_AM_DUNG_QUAT..
// DO_KHO_DUNG_QUAT) BỊ NGĂN CÁCH bởi 2 cột INPUT thường ở giữa (AL, AM
// = Kho Dung Quất MT/BDMT) - nếu copy 1 dải liền từ Y đến hết (như bản
// cũ) sẽ LỠ COPY ĐÈ cả 2 cột input AL/AM bằng dữ liệu của DÒNG TRƯỚC,
// xóa mất số liệu Kho Dung Quất người dùng vừa nhập. Vì vậy đổi sang
// copy TỪNG DẢI RIÊNG theo FORMULA_COL_RANGES bên dưới - khai báo tập
// trung ở đây để sau này thêm kho khác (nối cuối tiếp) chỉ cần thêm 1
// dòng vào mảng này, không phải sửa logic hàm.
// ============================================================
const FORMULA_COL_RANGES = [
  { start: COL.DO_AM_TIEN_SA, end: COL.DINH_MUC },          // Y..AK (gốc)
  { start: COL.DO_AM_DUNG_QUAT, end: COL.DO_KHO_DUNG_QUAT }  // AN..AO (Kho Dung Quất)
];

function extendFormulasToNewRow_(sh, newRowIndex, headerRow) {
  const prevRow = newRowIndex - 1;
  if (prevRow <= headerRow) return; // không có dòng mẫu để copy công thức
  FORMULA_COL_RANGES.forEach(range => {
    const startCol = range.start + 1; // 1-based
    const numCols = range.end - range.start + 1;
    const srcRange = sh.getRange(prevRow, startCol, 1, numCols);
    // Chỉ copy nếu dòng trên thực sự có công thức (tránh copy dòng trống)
    const formulas = srcRange.getFormulas()[0];
    const hasFormula = formulas.some(f => f && f.toString().startsWith("="));
    if (!hasFormula) return;
    srcRange.copyTo(sh.getRange(newRowIndex, startCol, 1, numCols));
  });
}

// ============================================================
// VALIDATE DÙNG CHUNG cho cả Web App (submitInventoryEntry) VÀ
// Google Form (onFormSubmit) - đảm bảo 2 kênh nhập liệu áp dụng ĐÚNG
// CÙNG 1 bộ quy tắc (trùng Đơn vị+Ngày, giới hạn 1 lần/email/ngày).
// `excludeRowIndex`: khi gọi từ onFormSubmit, dòng vừa được Form tự
// ghi (0-based trong mảng `data`) cần bị loại ra khi so sánh, vì nó
// chính là dòng đang xét (không phải dữ liệu "cũ" để so sánh với).
// ============================================================
function checkDuplicates_(data, email, donVi, ngayTonKho, now, excludeIndex) {
  let duplicateUnitDate = false, emailUsedToday = false;
  data.forEach((r, idx) => {
    if (idx === excludeIndex) return;
    const oldDonVi = String(r[COL.DON_VI] || "").trim();
    const oldNgay = r[COL.NGAY_TON_KHO];
    if (oldDonVi === donVi && utils.isSameDay(oldNgay, ngayTonKho)) duplicateUnitDate = true;

    const oldEmail = utils.normEmail(r[COL.EMAIL]);
    const oldTimestamp = r[COL.TIMESTAMP];
    if (oldEmail === email && utils.isSameDay(oldTimestamp, now)) emailUsedToday = true;
  });
  return { duplicateUnitDate, emailUsedToday };
}

// ============================================================
// GHI DÒNG MỚI + VALIDATE - dùng khi nộp qua WEB APP
// ============================================================
function submitInventoryEntry(payload) {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    if (!payload) throw new Error("Không nhận được dữ liệu.");
    const email = utils.normEmail(payload.overrideEmail || getCurrentUserEmail_());
    const isAdmin = utils.isAdmin(email);

    const donVi = String(payload.donVi || "").trim();
    if (!donVi) return { success: false, message: "❌ Vui lòng chọn Đơn vị." };
    if (!payload.ngayTonKho) return { success: false, message: "❌ Vui lòng chọn Ngày nhập tồn kho." };
    const ngayTonKho = new Date(payload.ngayTonKho);
    if (isNaN(ngayTonKho.getTime())) return { success: false, message: "❌ Ngày nhập tồn kho không hợp lệ." };

    // THEO YÊU CẦU MỚI (mục X, v2026.8.17): kiểm tra Phân quyền TRƯỚC
    // khi ghi - email chưa được cấp quyền gì bị chặn hẳn; email có
    // quyền nhưng không phải "nhap_sua" cho ĐÚNG Đơn vị này cũng bị
    // chặn (Admin luôn qua được, không cần kiểm tra).
    if (!isAdmin) {
      const pq = layPhanQuyenNguoiDung_(email);
      if (!pq.coQuyenGi) {
        return { success: false, message: "❌ Email " + email + " chưa được Admin cấp quyền sử dụng hệ thống. Vui lòng liên hệ Admin (mục Cài đặt > Phân quyền)." };
      }
      if (pq.donViNhapSua.indexOf(donVi) === -1) {
        return { success: false, message: "❌ Bạn không có quyền Nhập/Sửa cho đơn vị \"" + donVi + "\"." + (pq.donViNhapSua.length ? " Bạn chỉ được Nhập/Sửa: " + pq.donViNhapSua.join(", ") + "." : "") };
      }
    }

    const now = new Date();
    const { sh, headerRow, data } = readAllData_();

    const { duplicateUnitDate, emailUsedToday } = checkDuplicates_(data, email, donVi, ngayTonKho, now, -1);

    // THEO YÊU CẦU MỚI (mục F): nếu (Đơn vị, Ngày tồn kho) ĐÃ có dữ liệu,
    // Web App KHÔNG còn coi đây là vi phạm cần chặn nữa - mà hiểu đây là
    // 1 lượt SỬA lại báo cáo đã có (giao diện "Nhập Tồn Kho" tự chuyển
    // sang chế độ Sửa khi phát hiện trùng, xem getExistingEntryForKey).
    // Mọi người dùng (không chỉ Admin) đều sửa được theo cách này - vẫn
    // ghi 1 dòng MỚI vào Form Responses 1 (giữ nguyên lịch sử để tra
    // soát), Chitiettonkho sẽ tự lấy đúng dòng mới nhất này làm chính
    // thức. Giới hạn "1 lần/email/ngày" CHỈ áp dụng cho lượt NHẬP MỚI
    // thật sự (chưa có dữ liệu cho ngày đó) - không áp dụng khi đang SỬA,
    // để không cản trở việc tự sửa lại ngay trong ngày.
    if (!duplicateUnitDate && emailUsedToday && !isAdmin) {
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Mỗi email chỉ được nhập 1 lần mỗi ngày");
      return { success: false, message: "❌ Email của bạn đã nộp báo cáo hôm nay rồi. Mỗi email chỉ được nhập 1 lần mỗi ngày (chỉ Admin mới ghi đè được)." };
    }

    // --- Ghi dữ liệu ---
    const row = new Array(CFG.TOTAL_COL_COUNT).fill("");
    row[COL.TIMESTAMP] = now;
    row[COL.EMAIL] = email;
    row[COL.NGAY_BAO_CAO] = Utilities.formatDate(now, "GMT+7", "MM/dd/yyyy");
    row[COL.DON_VI] = donVi;
    row[COL.NGAY_TON_KHO] = ngayTonKho;
    row[COL.TON_DAU_NGAY] = utils.parseNum(payload.tonDauNgay);
    row[COL.HOA_NHON_MT] = utils.parseNum(payload.hoaNhonMT);
    row[COL.HOA_NHON_BDMT] = utils.parseNum(payload.hoaNhonBDMT);
    row[COL.QUE_SON_MT] = utils.parseNum(payload.queSonMT);
    row[COL.QUE_SON_BDMT] = utils.parseNum(payload.queSonBDMT);
    row[COL.DAI_HIEP_MT] = utils.parseNum(payload.daiHiepMT);
    row[COL.DAI_HIEP_BDMT] = utils.parseNum(payload.daiHiepBDMT);
    row[COL.HAKQN_MT] = utils.parseNum(payload.hakqnMT);
    row[COL.HAKQN_BDMT] = utils.parseNum(payload.hakqnBDMT);
    row[COL.DIEU_CHINH] = utils.parseNum(payload.dieuChinh);
    row[COL.MUON_TRA] = utils.parseNum(payload.muonTra);
    row[COL.NHAP_GO] = utils.parseNum(payload.nhapGo);
    row[COL.TIEN_SA_MT] = utils.parseNum(payload.tienSaMT);
    row[COL.TIEN_SA_BDMT] = utils.parseNum(payload.tienSaBDMT);
    row[COL.DUNG_QUAT_MT] = utils.parseNum(payload.dungQuatMT);
    row[COL.DUNG_QUAT_BDMT] = utils.parseNum(payload.dungQuatBDMT);
    row[COL.KIEM_KE_VET_BAI] = payload.kiemKeVetBai ? "Có" : "";
    if (payload.kiemKeVetBai) {
      row[COL.THOI_DIEM_VET_BAI] = payload.thoiDiemVetBai ? new Date(payload.thoiDiemVetBai) : "";
      row[COL.KL_UOC_TINH_CON_LAI] = utils.parseNum(payload.klUocTinhConLai);
      row[COL.CHENH_LECH_VET_BAI] = utils.parseNum(payload.chenhLechVetBai);
    }

    // THEO YÊU CẦU MỚI (mục X, v2026.8.17; SỬA LẠI công thức + email ở
    // mục AD, v2026.8.18): "Báo cáo lệch đầu kỳ" - Tồn kho đầu ngày vừa
    // nhập KHÔNG khớp "Đầu kỳ DỰ KIẾN" (= Tồn kho CK của báo cáo CHÍNH
    // THỨC ngày liền trước cùng Đơn vị, đã sẵn gồm Cộng MT + Kho Xuất
    // hàng Tiên Sa/Dung Quất MT + "Điều chỉnh MT" của Cân đối BDMT xuất
    // hàng NẾU có cân đối đúng ngày đó - xem timTonCuoiKyTruoc_) -> vẫn
    // LƯU bình thường nhưng đánh dấu "Chờ duyệt" (KHÔNG đưa vào
    // Chitiettonkho/Dashboard/Báo cáo chính thức cho tới khi Admin duyệt
    // ở trang Lịch Sử - xem syncChitietTonKhoForKey_ + duyetBaoCao()).
    // Admin tự nộp thì BỎ QUA kiểm tra này (admin đã có toàn quyền, tự
    // chịu trách nhiệm số liệu, không cần tự duyệt lại chính mình).
    let lechDauKy = false;
    let dauKyInfo = null;
    let lyDoLechDauKy = "";
    if (!isAdmin) {
      dauKyInfo = timTonCuoiKyTruoc_(donVi, utils.formatDateISO(ngayTonKho));
      if (dauKyInfo !== null && Math.abs(utils.parseNum(payload.tonDauNgay) - dauKyInfo.tonCuoiKyDuKien) > 0.01) {
        lechDauKy = true;
        lyDoLechDauKy = "Lệch đầu kỳ: Tồn kho đầu ngày nhập (" + fmtNumVN_(payload.tonDauNgay) + " MT) không khớp Đầu kỳ dự kiến (" +
          fmtNumVN_(dauKyInfo.tonCuoiKyDuKien) + " MT) tính từ báo cáo chính thức ngày " + dauKyInfo.ngayDisplay + " = Tồn CK " + fmtNumVN_(dauKyInfo.tonCK) + " MT" +
          (dauKyInfo.dieuChinhMT ? " + Điều chỉnh MT (Cân đối BDMT xuất hàng cùng ngày) " + fmtNumVN_(dauKyInfo.dieuChinhMT) + " MT" : "") + ".";
      }
    }
    row[COL.TRANG_THAI_DUYET] = lechDauKy ? "Chờ duyệt" : "";
    const lyDoChoDuyetList = [];
    if (lechDauKy) lyDoChoDuyetList.push(lyDoLechDauKy);

    sh.appendRow(row);
    const newRowIndex = sh.getLastRow();
    extendFormulasToNewRow_(sh, newRowIndex, headerRow);

    if (duplicateUnitDate) {
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Sửa báo cáo đã có qua Web App" + (isAdmin ? " (admin)" : ""));
    }
    if (emailUsedToday && isAdmin) {
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Override giới hạn 1 lần/ngày bởi admin");
    }
    if (lechDauKy) {
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Báo cáo lệch đầu kỳ - Chờ Admin duyệt");
      // THEO YÊU CẦU MỚI (mục AD, v2026.8.18): trước đây email này CHỈ
      // gửi cho Admin - giờ gửi CẢ cho người nộp (đơn vị) kèm lý do cụ
      // thể, giống cách kiemTraDinhMucVaCanhBao_ đã làm cho "lệch định
      // mức" (để người nhập biết ngay vì sao chưa được duyệt).
      const toListDauKy = [email].concat(CFG.ADMIN_EMAILS).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      guiEmailAnToan_({
        to: toListDauKy.join(","),
        subject: "🔔 Báo cáo lệch đầu kỳ đang CHỜ DUYỆT - " + donVi,
        body: "Đơn vị \"" + donVi + "\" nộp báo cáo ngày " + utils.formatDate(ngayTonKho) + " (người nộp: " + email + ") có Tồn kho đầu ngày KHÔNG khớp Đầu kỳ dự kiến.\n\n" +
          lyDoLechDauKy + "\n\n" +
          "Báo cáo đã được LƯU ở trạng thái \"Chờ duyệt\" (chưa tính vào Chitiettonkho/Dashboard/Báo cáo). Vào trang Lịch Sử trên Web App để xem chi tiết, hoặc đề nghị người nộp kiểm tra lại Tồn kho đầu ngày và nộp lại. Admin có thể Duyệt/Từ chối ở trang Lịch Sử.\n\n(Email tự động từ Web App Quản Lý Tồn Kho Dăm - HAK Group)"
      }, "lệch đầu kỳ - " + donVi);
    }

    SpreadsheetApp.flush();

    // Mục X/AA (v2026.8.17): kiểm tra "Định mức" vừa tính được (đọc lại
    // SAU khi đã kéo công thức + flush ở trên) so với khoảng cho phép
    // Admin cấu hình cho Đơn vị này ĐÚNG khoảng ngày áp dụng chứa Ngày
    // tồn kho của báo cáo (nếu có) - THEO YÊU CẦU MỚI (SỬA LẠI so với
    // bản đầu mục X): lệch định mức giờ CŨNG CHẶN không cho vào
    // Chitiettonkho (gắn "Chờ duyệt", CÙNG cơ chế với "lệch đầu kỳ" ở
    // trên) thay vì chỉ gửi email cảnh báo rồi vẫn lưu chính thức như
    // trước - phải chạy TRƯỚC syncChitietTonKhoForKey_ (đặt phía dưới)
    // để lần đồng bộ đó thấy đúng trạng thái mới nhất. Admin tự nộp vẫn
    // BỎ QUA việc chặn (cùng nguyên tắc với "lệch đầu kỳ"), nhưng vẫn
    // nhận được email cảnh báo như bình thường (để biết mà tự kiểm tra).
    let lechDinhMuc = false;
    try {
      const lyDoDinhMuc = kiemTraDinhMucVaCanhBao_(donVi, utils.formatDateISO(ngayTonKho), newRowIndex, sh, email);
      lechDinhMuc = !!lyDoDinhMuc;
      if (lyDoDinhMuc) lyDoChoDuyetList.push(lyDoDinhMuc);
    } catch (e) { /* không để lỗi gửi mail làm hỏng luồng nộp báo cáo */ }
    if (lechDinhMuc && !isAdmin && row[COL.TRANG_THAI_DUYET] !== "Chờ duyệt") {
      sh.getRange(newRowIndex, COL.TRANG_THAI_DUYET + 1).setValue("Chờ duyệt");
      row[COL.TRANG_THAI_DUYET] = "Chờ duyệt";
      SpreadsheetApp.flush();
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Báo cáo lệch định mức - Chờ Admin duyệt");
    }

    // Mục AG (v2026.8.18): đối chiếu "Nhập gỗ keo trong ngày" (nhập tay)
    // với TỔNG "KL hàng (KG)" từ file Phiếu cân NGOÀI đúng đơn vị/ngày -
    // CÙNG cơ chế "Chờ duyệt" với lệch đầu kỳ/lệch định mức ở trên (xem
    // kiemTraPhieuCanVaCanhBao_/CFG.PHIEUCAN_MAP). Đặt SAU lệch định mức
    // để lyDoChoDuyetList gộp đủ cả 3 lý do nếu bị cả 3 cùng lúc.
    let lechPhieuCan = false;
    try {
      const lyDoPhieuCan = kiemTraPhieuCanVaCanhBao_(donVi, utils.formatDateISO(ngayTonKho), utils.parseNum(payload.nhapGo), email);
      lechPhieuCan = !!lyDoPhieuCan;
      if (lyDoPhieuCan) lyDoChoDuyetList.push(lyDoPhieuCan);
    } catch (e) { /* không để lỗi đối chiếu phiếu cân (file ngoài) làm hỏng luồng nộp báo cáo */ }
    if (lechPhieuCan && !isAdmin && row[COL.TRANG_THAI_DUYET] !== "Chờ duyệt") {
      sh.getRange(newRowIndex, COL.TRANG_THAI_DUYET + 1).setValue("Chờ duyệt");
      row[COL.TRANG_THAI_DUYET] = "Chờ duyệt";
      SpreadsheetApp.flush();
      logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Báo cáo lệch phiếu cân - Chờ Admin duyệt");
    }

    // Mục AD (v2026.8.18): ghi lại lý do (gộp cả các trường hợp nếu bị
    // nhiều lỗi cùng lúc) vào COL.LY_DO_CHO_DUYET - để Lịch Sử hiển thị
    // và duyetBaoCao() không phải đoán lại lý do khi gửi email lúc
    // duyệt/từ chối.
    if (!isAdmin && lyDoChoDuyetList.length) {
      sh.getRange(newRowIndex, COL.LY_DO_CHO_DUYET + 1).setValue(lyDoChoDuyetList.join(" | "));
      SpreadsheetApp.flush();
    }

    syncChitietTonKhoForKey_(donVi, utils.formatDateISO(ngayTonKho));

    // Mục K (v2026.8.13): TỰ TÍNH toàn bộ chuỗi công thức "Cân đối BDMT
    // xuất hàng" nếu người dùng có tick + chọn Kho - xem computeCanDoiBDMT_
    // ở trên. Phải chạy SAU extendFormulasToNewRow_ + flush (đã ở trên)
    // vì cần đọc lại "Độ khô TB Kho Nhà máy" (COL.DO_KHO) đúng công thức
    // Sheet đã tính cho CHÍNH dòng vừa lưu.
    let candoiResult = null;
    if (payload.candoiCo && String(payload.candoiKho || "").trim()) {
      const kho = String(payload.candoiKho).trim();
      const mtKho = kho === "Kho Tiên Sa" ? row[COL.TIEN_SA_MT] : row[COL.DUNG_QUAT_MT];
      const bdmtKho = kho === "Kho Tiên Sa" ? row[COL.TIEN_SA_BDMT] : row[COL.DUNG_QUAT_BDMT];
      candoiResult = computeCanDoiBDMT_(
        sh, newRowIndex, kho, mtKho, bdmtKho,
        utils.parseNum(payload.candoiDoAm), utils.parseNum(payload.candoiMTThucTe),
        donVi, ngayTonKho, email
      );
      if (!candoiResult.error) logCanDoiBDMT_(candoiResult);
    }

    let msg = duplicateUnitDate
      ? `✅ Đã cập nhật báo cáo tồn kho cho "${donVi}" ngày ${utils.formatDate(ngayTonKho)}.`
      : `✅ Đã lưu báo cáo tồn kho mới cho "${donVi}" ngày ${utils.formatDate(ngayTonKho)}.`;
    // THEO YÊU CẦU MỚI (mục AD, v2026.8.18): thông báo rõ ràng "CHƯA
    // DUYỆT" (kèm lý do) hoặc "ĐÃ DUYỆT" ngay trên Web App để người
    // nhập biết ngay - không chỉ hiện ở Lịch Sử.
    if (lyDoChoDuyetList.length) {
      msg += "\n\n⚠️ 🔶 TRẠNG THÁI: CHƯA DUYỆT - báo cáo đang \"Chờ duyệt\", CHƯA hiển thị trên Dashboard/Báo cáo cho tới khi Admin duyệt ở Lịch Sử.\n" +
        lyDoChoDuyetList.map(function (l) { return "• " + l; }).join("\n");
    } else if (!isAdmin) {
      msg += "\n\n✅ TRẠNG THÁI: ĐÃ DUYỆT (khớp đầu kỳ + định mức, không cần Admin duyệt lại).";
    }
    return { success: true, message: msg, wasEdit: duplicateUnitDate, candoiResult, lechDauKy, lechDinhMuc, lechPhieuCan, lyDoChoDuyet: lyDoChoDuyetList.join(" | ") };
  } catch (err) {
    return { success: false, message: "❌ Lỗi: " + err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ============================================================
// TRIGGER "ON FORM SUBMIT" - dùng khi nộp qua GOOGLE FORM (song song
// với Web App, cùng ghi vào 1 sheet "Form Responses 1").
// ------------------------------------------------------------
// CÁCH BẬT LẠI TRIGGER NÀY (nếu paste code vào 1 Apps Script project
// MỚI, chưa từng có trigger): mở Apps Script Editor > biểu tượng
// đồng hồ "Triggers" bên trái > Add Trigger > chọn hàm "onFormSubmit",
// Event source = "From spreadsheet", Event type = "On form submit".
// Nếu bạn paste đè lên project CŨ đã từng chạy onFormSubmit trước đây
// thì trigger đã cấu hình sẵn sẽ tự nhận lại hàm này, không cần làm
// lại bước trên.
//
// THEO YÊU CẦU MỚI (mục E ở đầu file): Google Form được nộp THOẢI MÁI,
// KHÔNG còn chặn/xóa dòng khi trùng Đơn vị+Ngày hay nộp lại nhiều
// lần/ngày nữa - chỉ CẢNH BÁO bằng cách ghi vào sheet "Audit" (không
// gửi mail, không xóa dòng). Sau đó LUÔN đồng bộ lại Chitiettonkho cho
// đúng khóa (Đơn vị, Ngày tồn kho) vừa nộp - vì cho phép nộp lại nhiều
// lần, Chitiettonkho sẽ tự lấy đúng bản mới nhất (theo Timestamp) làm
// dữ liệu chính thức (xem syncChitietTonKhoForKey_). KHÔNG gọi
// extendFormulasToNewRow_ ở đây vì Google Sheets đã tự kéo công thức
// cho dòng do Form tạo ra (chỉ Web App mới cần tự kéo, xem mục C).
// ============================================================
function onFormSubmit(e) {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const sh = getResponsesSheet_();
    const headerRow = findHeaderRow_(sh);
    const lastRow = sh.getLastRow();
    if (lastRow <= headerRow) return; // sheet trống bất thường

    const newRow = sh.getRange(lastRow, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const email = utils.normEmail(newRow[COL.EMAIL]);
    const donVi = String(newRow[COL.DON_VI] || "").trim();
    const ngayTonKho = newRow[COL.NGAY_TON_KHO] instanceof Date ? newRow[COL.NGAY_TON_KHO] : new Date(newRow[COL.NGAY_TON_KHO]);
    const now = newRow[COL.TIMESTAMP] instanceof Date ? newRow[COL.TIMESTAMP] : new Date();
    if (!donVi || isNaN(ngayTonKho.getTime())) return;

    // Chỉ cảnh báo (ghi Audit), KHÔNG chặn/xóa - nếu có dữ liệu cũ để so sánh.
    if (lastRow > headerRow + 1) {
      const allData = sh.getRange(headerRow + 1, 1, lastRow - headerRow, CFG.TOTAL_COL_COUNT).getValues();
      const excludeIndex = allData.length - 1; // dòng cuối cùng chính là dòng Form vừa ghi
      const { duplicateUnitDate, emailUsedToday } = checkDuplicates_(allData, email, donVi, ngayTonKho, now, excludeIndex);
      if (duplicateUnitDate) {
        logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Cảnh báo: Ngày tồn kho này đã có cho đơn vị này (đã nộp lại, Chitiettonkho sẽ lấy bản mới nhất)");
      }
      if (emailUsedToday) {
        logAudit_(email, donVi, utils.formatDate(ngayTonKho), "Cảnh báo: Email này đã nộp báo cáo hôm nay rồi (nộp thêm lần nữa)");
      }
    }

    syncChitietTonKhoForKey_(donVi, utils.formatDateISO(ngayTonKho));
  } catch (err) {
    // Không throw lỗi ra ngoài trigger form submit - chỉ ghi log để không
    // chặn luồng nộp Form của người dùng.
    try { logAudit_("system", "", "", "Lỗi onFormSubmit: " + err.toString()); } catch (e2) {}
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ============================================================
// DASHBOARD / TRANG CHỦ (đọc từ Chitiettonkho - dữ liệu đã lọc trùng,
// xem mục E ở đầu file)
// ============================================================
function getDashboardStats() {
  const { data } = readAllChitietData_();
  const email = utils.normEmail(getCurrentUserEmail_());
  const now = new Date();

  const latestByUnit = {};
  CFG.UNITS.forEach(u => { latestByUnit[u] = null; });

  data.forEach(r => {
    const donVi = String(r[COL.DON_VI] || "").trim();
    if (!donVi) return;
    const ngay = r[COL.NGAY_TON_KHO];
    if (!(ngay instanceof Date)) return;
    const cur = latestByUnit[donVi];
    if (!cur || ngay.getTime() > cur.ngay.getTime()) {
      latestByUnit[donVi] = {
        ngay,
        tonCK: utils.parseNum(r[COL.TON_CK]),
        congMT: utils.parseNum(r[COL.CONG_MT]),
        congBDMT: utils.parseNum(r[COL.CONG_BDMT]),
        doAm: utils.parseNum(r[COL.DO_AM]),
        doKho: utils.parseNum(r[COL.DO_KHO]), // dùng để quy đổi nhapGo -> BDMT (mục AF)
        dinhMuc: utils.parseNum(r[COL.DINH_MUC]), // Định mức tiêu hao THỰC TẾ tính được (mục AG)
        nhapGo: utils.parseNum(r[COL.NHAP_GO]), // lượng gỗ keo nhập ngày gần nhất (v2026.8.9)
        // Độ ẩm/Độ khô riêng Kho Tiên Sa/Kho Dung Quất (mục AH,
        // v2026.8.18) - dùng để tính Độ ẩm/Độ khô TRUNG BÌNH của khối
        // "Tồn kho tại Cảng" ở Trang chủ, CÙNG NGUYÊN TẮC mục O/Q (chỉ
        // AVERAGE trên đơn vị THỰC SỰ có tồn ở đúng kho đó).
        doAmTienSa: utils.parseNum(r[COL.DO_AM_TIEN_SA]), doKhoTienSa: utils.parseNum(r[COL.DO_KHO_TIEN_SA]),
        doAmDungQuat: utils.parseNum(r[COL.DO_AM_DUNG_QUAT]), doKhoDungQuat: utils.parseNum(r[COL.DO_KHO_DUNG_QUAT]),
        daBaoCaoHomNay: utils.isSameDay(r[COL.TIMESTAMP], now),
        // --- Kiểm kê vét bãi (bản ghi mới nhất mỗi đơn vị) - THEO YÊU
        // CẦU MỚI (mục W, v2026.8.17): dùng để đổi thẻ KPI "Số ngày đã
        // ghi nhận" thành "Số lượng nhà máy vét bãi" ở Trang chủ + ảnh
        // Telegram (xem soLuongVetBai/vetBaiDetail bên dưới). ---
        kiemKeVetBai: String(r[COL.KIEM_KE_VET_BAI] || "") === "Có",
        thoiDiemVetBai: utils.formatDate(r[COL.THOI_DIEM_VET_BAI]),
        klUocTinhConLai: utils.parseNum(r[COL.KL_UOC_TINH_CON_LAI]),
        chenhLechVetBai: utils.parseNum(r[COL.CHENH_LECH_VET_BAI]),
        // --- Chi tiết KHO NHÀ MÁY / KHO XUẤT HÀNG (bản mới nhất) -
        // THEO YÊU CẦU MỚI (v2026.8.7): Trang chủ trước đây chỉ có Tồn
        // CK/Độ ẩm gộp chung - bổ sung breakdown theo từng kho, cùng
        // cách làm với "Chi tiết Kho Nhà máy/Kho Xuất Hàng" ở Báo Cáo
        // Tổng Hợp (mục ngay phía trên getReportSummary). ---
        hoaNhonMT: utils.parseNum(r[COL.HOA_NHON_MT]), hoaNhonBDMT: utils.parseNum(r[COL.HOA_NHON_BDMT]),
        queSonMT: utils.parseNum(r[COL.QUE_SON_MT]), queSonBDMT: utils.parseNum(r[COL.QUE_SON_BDMT]),
        daiHiepMT: utils.parseNum(r[COL.DAI_HIEP_MT]), daiHiepBDMT: utils.parseNum(r[COL.DAI_HIEP_BDMT]),
        hakqnMT: utils.parseNum(r[COL.HAKQN_MT]), hakqnBDMT: utils.parseNum(r[COL.HAKQN_BDMT]),
        tienSaMT: utils.parseNum(r[COL.TIEN_SA_MT]), tienSaBDMT: utils.parseNum(r[COL.TIEN_SA_BDMT]),
        dungQuatMT: utils.parseNum(r[COL.DUNG_QUAT_MT]), dungQuatBDMT: utils.parseNum(r[COL.DUNG_QUAT_BDMT])
      };
    }
  });

  const ZERO_KHO = {
    hoaNhonMT:0, hoaNhonBDMT:0, queSonMT:0, queSonBDMT:0, daiHiepMT:0, daiHiepBDMT:0,
    hakqnMT:0, hakqnBDMT:0, congMT:0, congBDMT:0, tienSaMT:0, tienSaBDMT:0, dungQuatMT:0, dungQuatBDMT:0,
    doAmTienSa:0, doKhoTienSa:0, doAmDungQuat:0, doKhoDungQuat:0
  };
  const unitsAll = Object.keys(latestByUnit).map(u => {
    const info = latestByUnit[u];
    return Object.assign({
      donVi: u,
      coDuLieu: !!info,
      ngayGanNhat: info ? utils.formatDate(info.ngay) : "",
      // ISO của ngayGanNhat (mục AI, v2026.8.18) - dùng để so khớp ĐÚNG
      // NGÀY với "Ngày cân đối" ở khối "Cân đối xuất hàng" (xem
      // layCanDoiBDMTDungNgayMoiDonVi_).
      ngayGanNhatISO: info ? utils.formatDateISO(info.ngay) : "",
      tonCK: info ? info.tonCK : 0,
      doAm: info ? info.doAm : 0,
      doKho: info ? info.doKho : 0,
      dinhMuc: info ? info.dinhMuc : 0,
      nhapGo: info ? info.nhapGo : 0,
      // Quy đổi BDMT cho "Nhập gỗ keo" (mục AF, v2026.8.18) - THEO XÁC
      // NHẬN của người dùng: dùng "Độ khô TB Kho Nhà máy" CÙNG dòng/CÙNG
      // đơn vị đó (không có cột Độ ẩm/Độ khô riêng cho gỗ nhập).
      nhapGoBDMT: info ? (info.nhapGo * info.doKho) : 0,
      daBaoCaoHomNay: info ? info.daBaoCaoHomNay : false,
      kiemKeVetBai: info ? info.kiemKeVetBai : false,
      thoiDiemVetBai: info ? info.thoiDiemVetBai : "",
      klUocTinhConLai: info ? info.klUocTinhConLai : 0,
      chenhLechVetBai: info ? info.chenhLechVetBai : 0
    }, info ? {
      hoaNhonMT: info.hoaNhonMT, hoaNhonBDMT: info.hoaNhonBDMT,
      queSonMT: info.queSonMT, queSonBDMT: info.queSonBDMT,
      daiHiepMT: info.daiHiepMT, daiHiepBDMT: info.daiHiepBDMT,
      hakqnMT: info.hakqnMT, hakqnBDMT: info.hakqnBDMT,
      congMT: info.congMT, congBDMT: info.congBDMT,
      tienSaMT: info.tienSaMT, tienSaBDMT: info.tienSaBDMT,
      dungQuatMT: info.dungQuatMT, dungQuatBDMT: info.dungQuatBDMT,
      doAmTienSa: info.doAmTienSa, doKhoTienSa: info.doKhoTienSa,
      doAmDungQuat: info.doAmDungQuat, doKhoDungQuat: info.doKhoDungQuat
    } : ZERO_KHO);
  });

  // THEO YÊU CẦU MỚI (mục AB, v2026.8.17): người dùng chỉ được cấp
  // quyền (Nhập/Sửa hoặc Xem) cho 1 vài Đơn vị (không phải Admin) CHỈ
  // được thấy đúng những Đơn vị đó ở Trang chủ - lọc NGAY tại server
  // (không chỉ dựa vào giao diện) trước khi tính mọi số liệu tổng hợp
  // bên dưới, để không lộ số liệu Đơn vị khác qua các thẻ KPI/bảng Kho
  // Nhà máy/Kho Xuất Hàng.
  const allowedUnits = donViChoPhepCuaToi_(email);
  const units = allowedUnits ? unitsAll.filter(u => allowedUnits.includes(u.donVi)) : unitsAll;

  const tongTonCK = units.reduce((s, u) => s + u.tonCK, 0);
  // THEO YÊU CẦU MỚI (mục U, v2026.8.17): Trang chủ (và ảnh báo cáo
  // Telegram, dùng CHUNG getDashboardStats() - xem mục T) cần hiện thêm
  // "Tổng lượng gỗ keo nhập trong ngày (ngày gần nhất)" - CỘNG "Nhập gỗ
  // keo" (nhapGo, đã có sẵn ở mỗi unit) của TẤT CẢ đơn vị, mỗi đơn vị
  // lấy đúng bản ghi GẦN NHẤT của đơn vị đó (không nhất thiết cùng 1
  // ngày lịch giữa các đơn vị - "ngày gần nhất" là gần nhất CỦA TỪNG đơn
  // vị, đúng khái niệm units[].nhapGo đã dùng ở toàn Trang chủ).
  const tongNhapGo = units.reduce((s, u) => s + (Number(u.nhapGo) || 0), 0);
  // BDMT tương ứng của "Tổng lượng gỗ keo nhập" (mục AF, v2026.8.18) -
  // cộng dồn nhapGoBDMT (đã quy đổi theo Độ khô cùng dòng) của từng đơn
  // vị, cùng cách "gần nhất của từng đơn vị" như tongNhapGo ở trên.
  const tongNhapGoBDMT = units.reduce((s, u) => s + (Number(u.nhapGoBDMT) || 0), 0);
  const soDonViChuaBaoCaoHomNay = units.filter(u => !u.daBaoCaoHomNay).length;
  // THEO YÊU CẦU MỚI (mục W, v2026.8.17): thẻ KPI "Số lượng nhà máy vét
  // bãi" - đếm số đơn vị có "Kiểm kê vét bãi" = Có ở bản ghi GẦN NHẤT
  // (đồng nhất với cách tính u.nhapGo/u.tonCK - "gần nhất của từng đơn
  // vị", không nhất thiết cùng 1 ngày lịch) + chi tiết từng đơn vị để
  // hiển thị ngay dưới thẻ KPI trên Trang chủ và trong ảnh Telegram.
  const donViVetBai = units.filter(u => u.kiemKeVetBai);
  const soLuongVetBai = donViVetBai.length;
  const vetBaiDetail = donViVetBai.map(u => ({
    donVi: u.donVi, ngayGanNhat: u.ngayGanNhat, thoiDiemVetBai: u.thoiDiemVetBai,
    klUocTinhConLai: u.klUocTinhConLai, chenhLechVetBai: u.chenhLechVetBai
  }));
  const sumKho = key => units.reduce((s, u) => s + u[key], 0);
  // "Tổng lượng tồn kho" quy đổi BDMT + "Độ ẩm trung bình" (mục AF,
  // v2026.8.18) - tongTonCKBDMT tính CÙNG CÔNG THỨC với tongTonCK (mục
  // H: Cộng MT + Kho Tiên Sa MT + Kho Dung Quất MT) nhưng cộng cột BDMT;
  // doAmTrungBinh tính THEO TRỌNG SỐ khối lượng tồn kho (không phải
  // trung bình cộng đơn giản giữa các đơn vị) = 1 - (tổng BDMT / tổng
  // MT), nhất quán với đúng số BDMT/MT đang hiển thị.
  const tongTonCKBDMT = sumKho('congBDMT') + sumKho('tienSaBDMT') + sumKho('dungQuatBDMT');
  const doAmTrungBinh = tongTonCK > 0 ? Math.max(0, 1 - (tongTonCKBDMT / tongTonCK)) : 0;

  // Độ ẩm/Độ khô của "Tổng lượng gỗ keo nhập hàng ngày" (mục AI,
  // v2026.8.18 - THEO YÊU CẦU MỚI, dùng cho BOT Telegram) - CÙNG CÔNG
  // THỨC doAmTrungBinh ở trên: Độ khô = Tổng BDMT / Tổng MT × 100%, Độ
  // ẩm = 100% - Độ khô (KHÔNG phải trung bình cộng - tính trên TỔNG để
  // nhất quán với 2 số tongNhapGo/tongNhapGoBDMT đang hiển thị).
  const doKhoNhapTB = tongNhapGo > 0 ? Math.min(1, tongNhapGoBDMT / tongNhapGo) : 0;
  const doAmNhapTB = tongNhapGo > 0 ? Math.max(0, 1 - doKhoNhapTB) : 0;

  // Độ ẩm/Độ khô TRUNG BÌNH riêng của khối "Tồn kho tại Cảng" (mục AH,
  // v2026.8.18) - CÙNG NGUYÊN TẮC mục O/Q ở Báo Cáo Tổng Hợp: chỉ
  // AVERAGE (trung bình cộng đơn giản, KHÔNG theo trọng số) trên đơn vị
  // THỰC SỰ có tồn ở đúng kho đó (MT > 0), bỏ qua đơn vị không xuất qua
  // kho này (Độ ẩm/Độ khô ghi là 0/rác, kéo lệch số trung bình).
  const donViCoTonTienSa = units.filter(u => u.tienSaMT > 0);
  const donViCoTonDungQuat = units.filter(u => u.dungQuatMT > 0);
  const doAmTienSaTB = avg_(donViCoTonTienSa.map(u => u.doAmTienSa));
  const doKhoTienSaTB = avg_(donViCoTonTienSa.map(u => u.doKhoTienSa));
  const doAmDungQuatTB = avg_(donViCoTonDungQuat.map(u => u.doAmDungQuat));
  const doKhoDungQuatTB = avg_(donViCoTonDungQuat.map(u => u.doKhoDungQuat));
  // Độ ẩm/Độ khô TỔNG của khối "Tồn kho tại Cảng" gộp cả Tiên Sa + Dung
  // Quất (mục AI, v2026.8.18 - THEO YÊU CẦU MỚI: "BDMT/MT*100%= Độ khô,
  // 100%- Độ khô = Độ ẩm" - CÙNG CÔNG THỨC trên TỔNG, thay cho khoảng
  // trống "–" ở dòng Tổng cộng trước đây).
  const tongCangMT = sumKho('tienSaMT') + sumKho('dungQuatMT');
  const tongCangBDMT = sumKho('tienSaBDMT') + sumKho('dungQuatBDMT');
  const doKhoCangTong = tongCangMT > 0 ? Math.min(1, tongCangBDMT / tongCangMT) : 0;
  const doAmCangTong = tongCangMT > 0 ? Math.max(0, 1 - doKhoCangTong) : 0;

  // Khối "Cân đối xuất hàng" (mục AH/AI, v2026.8.18) - THEO YÊU CẦU MỚI
  // (SỬA LẠI ở mục AI): hiện chi tiết LỆCH MT/BDMT (Điều chỉnh
  // MT/Điều chỉnh BDMT) của cân đối ĐÚNG "ngày báo kho" (= ngày báo cáo
  // tồn kho gần nhất, u.ngayGanNhatISO) mỗi nhà máy - KHÔNG phải lần cân
  // đối gần nhất bất kỳ nữa (xem layCanDoiBDMTDungNgayMoiDonVi_); đơn vị
  // không có cân đối đúng ngày đó -> coCanDoi=false ("Chưa cân đối xuất
  // hàng", KHÔNG bị lọc bỏ khỏi danh sách như bản trước). Chỉ lấy đúng
  // những đơn vị đang được phép xem (units, đã lọc theo Phân quyền).
  const donViNgayBaoKhoMap = {};
  units.forEach(function (u) { donViNgayBaoKhoMap[u.donVi] = u.ngayGanNhatISO || null; });
  const canDoiBDMTMap = layCanDoiBDMTDungNgayMoiDonVi_(donViNgayBaoKhoMap);
  const canDoiBDMTList = units.map(u => canDoiBDMTMap[u.donVi]).filter(Boolean);

  let tongSoDongFormRaw = 0;
  try { tongSoDongFormRaw = readAllData_().data.length; } catch (e) { /* bỏ qua nếu lỗi đọc */ }

  return {
    isAdmin: utils.isAdmin(email),
    units,
    tongTonCK,
    tongTonCKBDMT,
    doAmTrungBinh,
    tongNhapGo,
    tongNhapGoBDMT,
    doAmNhapTB, doKhoNhapTB, // mục AI: Độ ẩm/Độ khô của tổng lượng nhập hàng ngày
    soDonViChuaBaoCaoHomNay,
    soLuongVetBai,
    vetBaiDetail,
    tongSoDongChitiet: data.length,      // số (Đơn vị+Ngày) duy nhất đã có trong Chitiettonkho
    tongSoDongFormRaw,                    // tổng số lượt nộp thô (kể cả nộp lại/trùng) ở Form Responses 1
    // mục AH (v2026.8.18): Độ ẩm/Độ khô TRUNG BÌNH riêng khối "Tồn kho
    // tại Cảng" + chi tiết lệch MT/BDMT lần cân đối xuất hàng gần nhất
    // mỗi nhà máy. mục AI: bổ sung Độ ẩm/Độ khô TỔNG (không phải trung
    // bình cộng) cho dòng Tổng cộng.
    doAmTienSaTB, doKhoTienSaTB, doAmDungQuatTB, doKhoDungQuatTB,
    doAmCangTong, doKhoCangTong, tongCangMT, tongCangBDMT,
    canDoiBDMTList,
    khoTotal: {
      hoaNhonMT: sumKho('hoaNhonMT'), hoaNhonBDMT: sumKho('hoaNhonBDMT'),
      queSonMT: sumKho('queSonMT'), queSonBDMT: sumKho('queSonBDMT'),
      daiHiepMT: sumKho('daiHiepMT'), daiHiepBDMT: sumKho('daiHiepBDMT'),
      hakqnMT: sumKho('hakqnMT'), hakqnBDMT: sumKho('hakqnBDMT'),
      congMT: sumKho('congMT'), congBDMT: sumKho('congBDMT'),
      tienSaMT: sumKho('tienSaMT'), tienSaBDMT: sumKho('tienSaBDMT'),
      dungQuatMT: sumKho('dungQuatMT'), dungQuatBDMT: sumKho('dungQuatBDMT')
    }
  };
}

/** BIẾN THỂ CỦA getDashboardStats() CHO 1 NGÀY LẬP BÁO CÁO CỤ THỂ (mục
 * Y, v2026.8.17) - THEO YÊU CẦU MỚI: nút "Gửi báo cáo Telegram" (ảnh) ở
 * Cài đặt > Công cụ Admin trước đây LUÔN dùng số liệu MỚI NHẤT (giống
 * getDashboardStats gốc) - đôi lúc Admin cần GỬI LẠI báo cáo của 1 NGÀY
 * TRƯỚC ĐÓ (không phải ngày hiện tại). Hàm này CỐ Ý viết RIÊNG (không
 * sửa/dùng chung getDashboardStats gốc) để KHÔNG rủi ro ảnh hưởng luồng
 * mặc định (Trang chủ tương tác + lịch tự động 16h) - đã hoạt động ổn
 * định, không muốn refactor chung rồi lỡ gây lệch hành vi.
 * Với mỗi Đơn vị: lấy bản ghi Chitiettonkho GẦN NHẤT có Ngày tồn kho <=
 * ngayISO (CHỈ xét báo cáo ĐÚNG ngày hoặc TRƯỚC ngày được chọn - bỏ qua
 * báo cáo SAU đó, đúng ngữ cảnh "gửi lại báo cáo của 1 ngày cũ", không
 * lộ số liệu của những ngày mới hơn ngày đang muốn gửi lại). Trường
 * `daBaoCaoHomNay` ở đây đổi nghĩa thành "có báo cáo ĐÚNG ngày được
 * chọn" (không phải nghĩa gốc "nộp trong hôm nay theo lịch thật) - ẢNH
 * + CAPTION (taoAnhBaoCaoTrangChu_/soanCaptionBaoCaoTrangChu_) tự đổi
 * nhãn cho khớp khi thấy có `ngayBaoCaoDisplay` trong kết quả trả về. */
function getDashboardStatsForDate_(ngayISO) {
  const { data } = readAllChitietData_();
  const email = utils.normEmail(getCurrentUserEmail_());

  const latestByUnit = {};
  CFG.UNITS.forEach(u => { latestByUnit[u] = null; });

  data.forEach(r => {
    const donVi = String(r[COL.DON_VI] || "").trim();
    if (!donVi) return;
    const ngay = r[COL.NGAY_TON_KHO];
    if (!(ngay instanceof Date)) return;
    const rISO = utils.formatDateISO(ngay);
    if (!rISO || rISO > ngayISO) return; // bỏ qua báo cáo SAU ngày được chọn gửi lại
    const cur = latestByUnit[donVi];
    if (!cur || ngay.getTime() > cur.ngay.getTime()) {
      latestByUnit[donVi] = {
        ngay,
        tonCK: utils.parseNum(r[COL.TON_CK]),
        congMT: utils.parseNum(r[COL.CONG_MT]),
        congBDMT: utils.parseNum(r[COL.CONG_BDMT]),
        doAm: utils.parseNum(r[COL.DO_AM]),
        doKho: utils.parseNum(r[COL.DO_KHO]), // dùng để quy đổi nhapGo -> BDMT (mục AF)
        nhapGo: utils.parseNum(r[COL.NHAP_GO]),
        doAmTienSa: utils.parseNum(r[COL.DO_AM_TIEN_SA]), doKhoTienSa: utils.parseNum(r[COL.DO_KHO_TIEN_SA]), // mục AH
        doAmDungQuat: utils.parseNum(r[COL.DO_AM_DUNG_QUAT]), doKhoDungQuat: utils.parseNum(r[COL.DO_KHO_DUNG_QUAT]), // mục AH
        daBaoCaoHomNay: rISO === ngayISO, // nghĩa riêng cho hàm này - xem docstring
        kiemKeVetBai: String(r[COL.KIEM_KE_VET_BAI] || "") === "Có",
        thoiDiemVetBai: utils.formatDate(r[COL.THOI_DIEM_VET_BAI]),
        klUocTinhConLai: utils.parseNum(r[COL.KL_UOC_TINH_CON_LAI]),
        chenhLechVetBai: utils.parseNum(r[COL.CHENH_LECH_VET_BAI]),
        hoaNhonMT: utils.parseNum(r[COL.HOA_NHON_MT]), hoaNhonBDMT: utils.parseNum(r[COL.HOA_NHON_BDMT]),
        queSonMT: utils.parseNum(r[COL.QUE_SON_MT]), queSonBDMT: utils.parseNum(r[COL.QUE_SON_BDMT]),
        daiHiepMT: utils.parseNum(r[COL.DAI_HIEP_MT]), daiHiepBDMT: utils.parseNum(r[COL.DAI_HIEP_BDMT]),
        hakqnMT: utils.parseNum(r[COL.HAKQN_MT]), hakqnBDMT: utils.parseNum(r[COL.HAKQN_BDMT]),
        tienSaMT: utils.parseNum(r[COL.TIEN_SA_MT]), tienSaBDMT: utils.parseNum(r[COL.TIEN_SA_BDMT]),
        dungQuatMT: utils.parseNum(r[COL.DUNG_QUAT_MT]), dungQuatBDMT: utils.parseNum(r[COL.DUNG_QUAT_BDMT])
      };
    }
  });

  const ZERO_KHO = {
    hoaNhonMT:0, hoaNhonBDMT:0, queSonMT:0, queSonBDMT:0, daiHiepMT:0, daiHiepBDMT:0,
    hakqnMT:0, hakqnBDMT:0, congMT:0, congBDMT:0, tienSaMT:0, tienSaBDMT:0, dungQuatMT:0, dungQuatBDMT:0,
    doAmTienSa:0, doKhoTienSa:0, doAmDungQuat:0, doKhoDungQuat:0
  };
  const units = Object.keys(latestByUnit).map(u => {
    const info = latestByUnit[u];
    return Object.assign({
      donVi: u,
      coDuLieu: !!info,
      ngayGanNhat: info ? utils.formatDate(info.ngay) : "",
      ngayGanNhatISO: info ? utils.formatDateISO(info.ngay) : "", // mục AI
      tonCK: info ? info.tonCK : 0,
      doAm: info ? info.doAm : 0,
      doKho: info ? info.doKho : 0,
      nhapGo: info ? info.nhapGo : 0,
      nhapGoBDMT: info ? (info.nhapGo * info.doKho) : 0, // mục AF
      daBaoCaoHomNay: info ? info.daBaoCaoHomNay : false,
      kiemKeVetBai: info ? info.kiemKeVetBai : false,
      thoiDiemVetBai: info ? info.thoiDiemVetBai : "",
      klUocTinhConLai: info ? info.klUocTinhConLai : 0,
      chenhLechVetBai: info ? info.chenhLechVetBai : 0
    }, info ? {
      hoaNhonMT: info.hoaNhonMT, hoaNhonBDMT: info.hoaNhonBDMT,
      queSonMT: info.queSonMT, queSonBDMT: info.queSonBDMT,
      daiHiepMT: info.daiHiepMT, daiHiepBDMT: info.daiHiepBDMT,
      hakqnMT: info.hakqnMT, hakqnBDMT: info.hakqnBDMT,
      congMT: info.congMT, congBDMT: info.congBDMT,
      tienSaMT: info.tienSaMT, tienSaBDMT: info.tienSaBDMT,
      dungQuatMT: info.dungQuatMT, dungQuatBDMT: info.dungQuatBDMT,
      doAmTienSa: info.doAmTienSa, doKhoTienSa: info.doKhoTienSa,
      doAmDungQuat: info.doAmDungQuat, doKhoDungQuat: info.doKhoDungQuat
    } : ZERO_KHO);
  });

  const tongTonCK = units.reduce((s, u) => s + u.tonCK, 0);
  const tongNhapGo = units.reduce((s, u) => s + (Number(u.nhapGo) || 0), 0);
  const tongNhapGoBDMT = units.reduce((s, u) => s + (Number(u.nhapGoBDMT) || 0), 0); // mục AF
  const soDonViChuaBaoCaoHomNay = units.filter(u => !u.daBaoCaoHomNay).length;
  const donViVetBai = units.filter(u => u.kiemKeVetBai);
  const soLuongVetBai = donViVetBai.length;
  const vetBaiDetail = donViVetBai.map(u => ({
    donVi: u.donVi, ngayGanNhat: u.ngayGanNhat, thoiDiemVetBai: u.thoiDiemVetBai,
    klUocTinhConLai: u.klUocTinhConLai, chenhLechVetBai: u.chenhLechVetBai
  }));
  const sumKho = key => units.reduce((s, u) => s + u[key], 0);
  // mục AF: Tổng tồn kho BDMT + Độ ẩm trung bình theo trọng số tồn kho.
  const tongTonCKBDMT = sumKho('congBDMT') + sumKho('tienSaBDMT') + sumKho('dungQuatBDMT');
  const doAmTrungBinh = tongTonCK > 0 ? Math.max(0, 1 - (tongTonCKBDMT / tongTonCK)) : 0;
  // mục AI: Độ ẩm/Độ khô của tổng lượng gỗ keo nhập hàng ngày.
  const doKhoNhapTB = tongNhapGo > 0 ? Math.min(1, tongNhapGoBDMT / tongNhapGo) : 0;
  const doAmNhapTB = tongNhapGo > 0 ? Math.max(0, 1 - doKhoNhapTB) : 0;
  // mục AH: Độ ẩm/Độ khô TRUNG BÌNH riêng khối "Tồn kho tại Cảng".
  const donViCoTonTienSa = units.filter(u => u.tienSaMT > 0);
  const donViCoTonDungQuat = units.filter(u => u.dungQuatMT > 0);
  const doAmTienSaTB = avg_(donViCoTonTienSa.map(u => u.doAmTienSa));
  const doKhoTienSaTB = avg_(donViCoTonTienSa.map(u => u.doKhoTienSa));
  const doAmDungQuatTB = avg_(donViCoTonDungQuat.map(u => u.doAmDungQuat));
  const doKhoDungQuatTB = avg_(donViCoTonDungQuat.map(u => u.doKhoDungQuat));
  // mục AI: Độ ẩm/Độ khô TỔNG (không phải trung bình cộng) khối "Tồn
  // kho tại Cảng".
  const tongCangMT = sumKho('tienSaMT') + sumKho('dungQuatMT');
  const tongCangBDMT = sumKho('tienSaBDMT') + sumKho('dungQuatBDMT');
  const doKhoCangTong = tongCangMT > 0 ? Math.min(1, tongCangBDMT / tongCangMT) : 0;
  const doAmCangTong = tongCangMT > 0 ? Math.max(0, 1 - doKhoCangTong) : 0;
  // mục AI: khối "Cân đối xuất hàng" đúng "ngày báo kho" mỗi nhà máy.
  const donViNgayBaoKhoMap = {};
  units.forEach(function (u) { donViNgayBaoKhoMap[u.donVi] = u.ngayGanNhatISO || null; });
  const canDoiBDMTMap = layCanDoiBDMTDungNgayMoiDonVi_(donViNgayBaoKhoMap);
  const canDoiBDMTList = units.map(u => canDoiBDMTMap[u.donVi]).filter(Boolean);

  let tongSoDongFormRaw = 0;
  try { tongSoDongFormRaw = readAllData_().data.length; } catch (e) { /* bỏ qua nếu lỗi đọc */ }

  const p = ngayISO.split("-");
  const ngayBaoCaoDisplay = p.length === 3 ? (p[2] + "/" + p[1] + "/" + p[0]) : ngayISO;

  return {
    isAdmin: utils.isAdmin(email),
    units,
    tongTonCK,
    tongTonCKBDMT,
    doAmTrungBinh,
    tongNhapGo,
    tongNhapGoBDMT,
    doAmNhapTB, doKhoNhapTB,
    soDonViChuaBaoCaoHomNay,
    soLuongVetBai,
    vetBaiDetail,
    tongSoDongChitiet: data.length,
    tongSoDongFormRaw,
    doAmTienSaTB, doKhoTienSaTB, doAmDungQuatTB, doKhoDungQuatTB,
    doAmCangTong, doKhoCangTong, tongCangMT, tongCangBDMT,
    canDoiBDMTList,
    khoTotal: {
      hoaNhonMT: sumKho('hoaNhonMT'), hoaNhonBDMT: sumKho('hoaNhonBDMT'),
      queSonMT: sumKho('queSonMT'), queSonBDMT: sumKho('queSonBDMT'),
      daiHiepMT: sumKho('daiHiepMT'), daiHiepBDMT: sumKho('daiHiepBDMT'),
      hakqnMT: sumKho('hakqnMT'), hakqnBDMT: sumKho('hakqnBDMT'),
      congMT: sumKho('congMT'), congBDMT: sumKho('congBDMT'),
      tienSaMT: sumKho('tienSaMT'), tienSaBDMT: sumKho('tienSaBDMT'),
      dungQuatMT: sumKho('dungQuatMT'), dungQuatBDMT: sumKho('dungQuatBDMT')
    },
    // 2 trường CHỈ CÓ ở biến thể theo ngày này (getDashboardStats gốc
    // KHÔNG có) - taoAnhBaoCaoTrangChu_/soanCaptionBaoCaoTrangChu_ dùng
    // để biết cần đổi nhãn "hôm nay" -> ngày cụ thể.
    ngayBaoCaoISO: ngayISO,
    ngayBaoCaoDisplay
  };
}

function getUnitList() { return CFG.UNITS; }

/** Trả về URL Google Sheet gốc (file dữ liệu thật đứng sau Web App này)
 * - THEO YÊU CẦU MỚI (mục AA, v2026.8.17): thêm nút "Mở file dữ liệu
 * gốc" ở Cài đặt > Công cụ Admin, để Admin mở thẳng file Sheet (xem
 * trực tiếp Form Responses 1/Chitiettonkho/PhanQuyen/DieuKienDuyet/
 * Audit...) khi cần tra soát sâu hơn giao diện Web App cho phép. CHỈ
 * Admin gọi được (dù URL này không phải bí mật tuyệt đối - file Sheet
 * vẫn tự áp dụng đúng quyền chia sẻ Google Drive của người mở link -
 * nhưng vẫn chặn ở đây cho nhất quán với các công cụ Admin khác). */
function getSpreadsheetUrl() {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { allowed: false, url: "" };
  return { allowed: true, url: SpreadsheetApp.getActive().getUrl() };
}

/** Công cụ Admin gửi 1 email THỬ tới địa chỉ tự nhập, KHÔNG dùng
 * guiEmailAnToan_ (cố ý để LỘ RA nguyên văn lỗi thật ngay trên Web App
 * thay vì chỉ ghi Audit) - dùng để rà nhanh vì sao email cảnh báo/duyệt
 * không tới nơi (mục AE, v2026.8.18 - THEO PHẢN HỒI người dùng "đã
 * test và KHÔNG nhận được email"). Nguyên nhân thường gặp nếu lỗi ở
 * đây: hết quota MailApp trong ngày (tài khoản Gmail cá nhân ~100
 * mail/ngày, Google Workspace ~1500 mail/ngày - xem lại ở
 * script.google.com > Executions/Quotas), hoặc "to" không phải email
 * hợp lệ. Nếu hàm này gửi được nhưng người nhận vẫn báo không thấy,
 * khả năng cao email đã rơi vào mục Spam/Quảng cáo - nhờ người nhận
 * kiểm tra lại thư mục đó. */
function guiEmailThuNghiem(toEmail) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới dùng được công cụ này." };
  const to = utils.normEmail(toEmail);
  if (!to) return { success: false, message: "❌ Vui lòng nhập email cần gửi thử." };
  try {
    MailApp.sendEmail({
      to: to,
      subject: "✅ Email thử nghiệm - Web App Quản Lý Tồn Kho Dăm",
      body: "Đây là email THỬ NGHIỆM gửi lúc " + utils.formatDate(new Date()) + " để kiểm tra MailApp có gửi được từ Web App tới địa chỉ này hay không.\n\n" +
        "Nếu bạn nhận được email này, hệ thống gửi mail đang hoạt động bình thường - các email cảnh báo/duyệt khác không tới có thể do rơi vào mục Spam, hoặc do người nộp dùng email khác với email đang kiểm tra ở đây.\n\n(Email tự động từ Web App Quản Lý Tồn Kho Dăm - HAK Group)"
    });
    const soConLai = MailApp.getRemainingDailyQuota();
    return { success: true, message: "✅ Đã gửi email thử tới " + to + ". Số email còn gửi được hôm nay (quota MailApp): " + soConLai + ". Nếu người nhận không thấy, nhờ kiểm tra thư mục Spam/Quảng cáo." };
  } catch (err) {
    return { success: false, message: "❌ GỬI THẤT BẠI - lỗi thật từ Google: " + err.toString() };
  }
}

/**
 * Dùng cho màn "Nhập Tồn Kho": kiểm tra xem (Đơn vị, Ngày tồn kho) đã
 * có dữ liệu trong Chitiettonkho chưa. Có -> trả về dữ liệu hiện có để
 * Web App tự chuyển form sang chế độ SỬA (điền sẵn giá trị cũ, không
 * cho tạo dòng "mới" gây trùng nữa). Không có -> trả null, form giữ
 * nguyên chế độ NHẬP MỚI (mục F ở đầu file).
 */
function getExistingEntryForKey(donVi, ngayISO) {
  donVi = String(donVi || "").trim();
  if (!donVi || !ngayISO) return null;
  const { data } = readAllChitietData_();
  const idx = findChitietIndex_(data, donVi, ngayISO);
  if (idx === -1) return null;
  return rowToHistoryItem_(data[idx], -1, true);
}

/**
 * Dùng cho màn "Nhập Tồn Kho" khi đang ở chế độ NHẬP MỚI (v2026.8.8) -
 * THEO YÊU CẦU MỚI: "Tồn kho đầu ngày (MT)" của Nhà máy tự động lấy
 * đúng bằng "Cộng MT" của bản ghi GẦN NHẤT TRƯỚC ngày đang nhập (cùng
 * Đơn vị) trong Chitiettonkho - đúng logic kế toán liên tục: tồn đầu
 * hôm nay = tồn cuối (Cộng MT) hôm trước. Web App vẫn cho SỬA TAY sau
 * khi tự điền (không khóa cứng) - xem checkExistingForCreate() ở
 * Index.html. Trả về null nếu chưa có dữ liệu ngày nào trước đó cho
 * đơn vị này (VD ngày đầu tiên mở sổ) - lúc đó form giữ nguyên hành vi
 * cũ, để trống cho người dùng tự nhập.
 */
function getPreviousDayCongMT(donVi, ngayISO) {
  donVi = String(donVi || "").trim();
  if (!donVi || !ngayISO) return null;
  const { data } = readAllChitietData_();
  let best = null;
  data.forEach(r => {
    if (String(r[COL.DON_VI] || "").trim() !== donVi) return;
    const rISO = utils.formatDateISO(r[COL.NGAY_TON_KHO]);
    if (!rISO || rISO >= ngayISO) return; // chỉ lấy ngày TRƯỚC ngày đang nhập
    if (!best || rISO > best.ngayISO) best = { ngayISO: rISO, congMT: utils.parseNum(r[COL.CONG_MT]) };
  });
  if (!best) return null;
  const p = best.ngayISO.split("-");
  return {
    ngayISO: best.ngayISO,
    ngayDisplay: p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : best.ngayISO,
    congMT: best.congMT
  };
}

/** Chuyển "Ngày cân đối" đọc từ sheet CanDoiBDMT (được ghi bằng
 * utils.formatDate() - chuỗi "dd/MM/yyyy" - ở logCanDoiBDMT_, có thể bị
 * Sheets tự nhận dạng thành Date hoặc giữ nguyên dạng text tùy locale)
 * về "yyyy-MM-dd" để so sánh nhất quán với ngayISO dùng ở nơi khác. */
function ngayCanDoiToISO_(v) {
  if (v instanceof Date) return utils.formatDateISO(v);
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const dd = m[1], MM = m[2], yyyy = m[3];
  return yyyy + "-" + String(MM).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
}

/** Tổng "Điều chỉnh MT" (sheet CanDoiBDMT, mục K) của 1 Đơn vị - CHỈ
 * TÍNH các dòng có "Ngày cân đối" TRÙNG ĐÚNG ngayISO đang xét (mục AD,
 * v2026.8.18 - THEO YÊU CẦU MỚI, đã xác nhận với người dùng: KHÔNG
 * "mang sang" từ lần cân đối cũ hơn nếu đúng ngày đang xét không có cân
 * đối nào - khi đó coi Điều chỉnh MT = 0). CỘNG DỒN nếu có nhiều dòng
 * cùng ngày (VD cân đối cả Kho Tiên Sa lẫn Kho Dung Quất trong cùng 1
 * lần nộp báo cáo). */
function tongDieuChinhMTCanDoiDungNgay_(donVi, ngayISO) {
  donVi = String(donVi || "").trim();
  if (!donVi || !ngayISO) return 0;
  const sh = getOrCreateCanDoiBDMTSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const data = sh.getRange(2, 1, lastRow - 1, 18).getValues();
  let tong = 0;
  data.forEach(r => {
    if (String(r[15] || "").trim() !== donVi) return; // cột P "Đơn vị nhập"
    if (ngayCanDoiToISO_(r[0]) !== ngayISO) return;    // cột A "Ngày cân đối"
    tong += utils.parseNum(r[13]);                      // cột N "Điều chỉnh MT"
  });
  return tong;
}

/** "Đầu kỳ DỰ KIẾN" của 1 Đơn vị, tính từ bản ghi CHÍNH THỨC
 * (Chitiettonkho - đã tự động loại "Chờ duyệt"/"Từ chối", xem
 * syncChitietTonKhoForKey_) GẦN NHẤT TRƯỚC ngayISO - dùng để phát hiện
 * "báo cáo lệch đầu kỳ" khi nộp mới (mục X, v2026.8.17; SỬA LẠI công
 * thức ở mục AD, v2026.8.18 THEO YÊU CẦU MỚI của người dùng):
 *   Đầu kỳ dự kiến = TON_CK của bản ghi đó (đã sẵn = Cộng MT Kho Nhà
 *     máy + Kho Tiên Sa MT + Kho Dung Quất MT - công thức Sheet có sẵn,
 *     xem ghi chú mục H đầu file) + "Điều chỉnh MT" (Cân đối BDMT xuất
 *     hàng, mục K) NẾU CÓ cân đối ĐÚNG NGÀY của bản ghi đó (không có =
 *     cộng thêm 0, KHÔNG lấy tạm lần cân đối cũ hơn).
 * Trả về null nếu Đơn vị đó CHƯA TỪNG có báo cáo chính thức nào trước
 * ngày này (VD ngày đầu tiên mở sổ) - khi đó không có gì để so sánh,
 * không coi là lệch. */
function timTonCuoiKyTruoc_(donVi, ngayISO) {
  donVi = String(donVi || "").trim();
  if (!donVi || !ngayISO) return null;
  const { data } = readAllChitietData_();
  let best = null, bestISO = null;
  data.forEach(r => {
    if (String(r[COL.DON_VI] || "").trim() !== donVi) return;
    const rISO = utils.formatDateISO(r[COL.NGAY_TON_KHO]);
    if (!rISO || rISO >= ngayISO) return;
    if (!bestISO || rISO > bestISO) { bestISO = rISO; best = utils.parseNum(r[COL.TON_CK]); }
  });
  if (best === null) return null;
  const dieuChinhMT = tongDieuChinhMTCanDoiDungNgay_(donVi, bestISO);
  return {
    ngayISO: bestISO,
    ngayDisplay: utils.formatDate(new Date(bestISO)),
    tonCK: best,
    dieuChinhMT,
    tonCuoiKyDuKien: best + dieuChinhMT
  };
}

// ============================================================
// LỊCH SỬ NHẬP KHO
// ============================================================
function rowToHistoryItem_(r, rowIndex, isLatest) {
  return {
    rowKey: r[COL.TIMESTAMP] instanceof Date ? r[COL.TIMESTAMP].getTime() + "|" + rowIndex : String(rowIndex),
    rowIndex,
    isLatest: !!isLatest,
    timestamp: utils.formatDate(r[COL.TIMESTAMP]),
    email: String(r[COL.EMAIL] || ""),
    trangThaiDuyet: String(r[COL.TRANG_THAI_DUYET] || ""),
    lyDoChoDuyet: String(r[COL.LY_DO_CHO_DUYET] || ""),
    donVi: String(r[COL.DON_VI] || ""),
    ngayTonKho: utils.formatDate(r[COL.NGAY_TON_KHO]),
    ngayTonKhoISO: utils.formatDateISO(r[COL.NGAY_TON_KHO]),
    tonDauNgay: utils.parseNum(r[COL.TON_DAU_NGAY]),
    hoaNhonMT: utils.parseNum(r[COL.HOA_NHON_MT]), hoaNhonBDMT: utils.parseNum(r[COL.HOA_NHON_BDMT]),
    queSonMT: utils.parseNum(r[COL.QUE_SON_MT]), queSonBDMT: utils.parseNum(r[COL.QUE_SON_BDMT]),
    daiHiepMT: utils.parseNum(r[COL.DAI_HIEP_MT]), daiHiepBDMT: utils.parseNum(r[COL.DAI_HIEP_BDMT]),
    hakqnMT: utils.parseNum(r[COL.HAKQN_MT]), hakqnBDMT: utils.parseNum(r[COL.HAKQN_BDMT]),
    dieuChinh: utils.parseNum(r[COL.DIEU_CHINH]),
    muonTra: utils.parseNum(r[COL.MUON_TRA]),
    nhapGo: utils.parseNum(r[COL.NHAP_GO]),
    tienSaMT: utils.parseNum(r[COL.TIEN_SA_MT]), tienSaBDMT: utils.parseNum(r[COL.TIEN_SA_BDMT]),
    dungQuatMT: utils.parseNum(r[COL.DUNG_QUAT_MT]), dungQuatBDMT: utils.parseNum(r[COL.DUNG_QUAT_BDMT]),
    doAmDungQuat: utils.parseNum(r[COL.DO_AM_DUNG_QUAT]), doKhoDungQuat: utils.parseNum(r[COL.DO_KHO_DUNG_QUAT]),
    kiemKeVetBai: String(r[COL.KIEM_KE_VET_BAI] || ""),
    thoiDiemVetBaiISO: utils.formatDateISO(r[COL.THOI_DIEM_VET_BAI]),
    klUocTinhConLai: utils.parseNum(r[COL.KL_UOC_TINH_CON_LAI]),
    chenhLechVetBai: utils.parseNum(r[COL.CHENH_LECH_VET_BAI]),
    congMT: utils.parseNum(r[COL.CONG_MT]),
    congBDMT: utils.parseNum(r[COL.CONG_BDMT]),
    doAm: utils.parseNum(r[COL.DO_AM]),
    tonCK: utils.parseNum(r[COL.TON_CK])
  };
}

/** Đếm nhanh số dòng "Chờ duyệt" (đã lọc theo đúng phạm vi Đơn vị được
 * phép xem của người gọi - giống getHistoryList) - dùng cho số badge ở
 * menu "Lịch Sử" trên Index.html (mục AD, v2026.8.18). Nhẹ hơn
 * getHistoryList vì không cần dựng object đầy đủ cho từng dòng, và
 * không cần so khớp Chitiettonkho (không quan tâm "Đang áp dụng"/"Đã bị
 * thay thế" ở đây). */
function getSoLuongChoDuyet() {
  const { data } = readAllData_();
  const allowedUnits = donViChoPhepCuaToi_(utils.normEmail(getCurrentUserEmail_()));
  let count = 0;
  data.forEach(r => {
    if (utils.isBlank(r[COL.DON_VI])) return;
    if (String(r[COL.TRANG_THAI_DUYET] || "") !== "Chờ duyệt") return;
    if (allowedUnits && allowedUnits.indexOf(String(r[COL.DON_VI]).trim()) === -1) return;
    count++;
  });
  return count;
}

function getHistoryList(filters) {
  filters = filters || {};
  const { data, headerRow } = readAllData_();
  let items = data.map((r, i) => ({ r, rowIndex: i })).filter(x => !utils.isBlank(x.r[COL.DON_VI]));

  // THEO YÊU CẦU MỚI (mục AB, v2026.8.17): CHẶN Ở SERVER cho người
  // không phải Admin - chỉ thấy đúng những Đơn vị mình được cấp quyền
  // (Nhập/Sửa hoặc Xem), kể cả khi bộ lọc Đơn vị để trống ("Tất cả").
  const allowedUnits = donViChoPhepCuaToi_(utils.normEmail(getCurrentUserEmail_()));
  if (allowedUnits) items = items.filter(x => allowedUnits.includes(String(x.r[COL.DON_VI]).trim()));

  if (filters.donVi) items = items.filter(x => String(x.r[COL.DON_VI]).trim() === filters.donVi);
  // THEO YÊU CẦU MỚI (mục X, v2026.8.17; MỞ RỘNG cho MỌI người dùng -
  // không riêng Admin - ở mục AD, v2026.8.18): nút "Chỉ hiện Chờ duyệt"
  // ở Lịch Sử, MẶC ĐỊNH BẬT - BỎ QUA bộ lọc ngày khi bật, để không lỡ
  // ẩn mất báo cáo chờ duyệt nằm ngoài khoảng ngày mặc định (mặc định
  // Lịch Sử chỉ lọc trong "hôm nay"). An toàn cho người dùng thường vì
  // đã lọc allowedUnits ở trên - không lộ thêm Đơn vị nào ngoài phạm vi
  // được phép.
  if (filters.chiChoDuyet) {
    items = items.filter(x => String(x.r[COL.TRANG_THAI_DUYET] || "") === "Chờ duyệt");
  } else {
    if (filters.fromDate) {
      const f = filters.fromDate;
      items = items.filter(x => x.r[COL.NGAY_TON_KHO] instanceof Date && utils.formatDateISO(x.r[COL.NGAY_TON_KHO]) >= f);
    }
    if (filters.toDate) {
      const t = filters.toDate;
      items = items.filter(x => x.r[COL.NGAY_TON_KHO] instanceof Date && utils.formatDateISO(x.r[COL.NGAY_TON_KHO]) <= t);
    }
  }

  // So khớp với Chitiettonkho để biết dòng nào trong Lịch Sử ĐANG là
  // bản chính thức (mới nhất) cho khóa (Đơn vị+Ngày) của nó, và dòng
  // nào đã bị 1 lần nộp sau đó thay thế (vẫn hiển thị để tra soát,
  // nhưng gắn nhãn "Đã bị thay thế").
  const chMap = new Map(); // key "donVi|ngayISO" -> timestamp (ms) đang là bản chính thức
  try {
    readAllChitietData_().data.forEach(r => {
      const key = String(r[COL.DON_VI] || "").trim() + "|" + utils.formatDateISO(r[COL.NGAY_TON_KHO]);
      const ts = r[COL.TIMESTAMP] instanceof Date ? r[COL.TIMESTAMP].getTime() : 0;
      chMap.set(key, ts);
    });
  } catch (e) { /* Chitiettonkho chưa có dữ liệu - bỏ qua, coi như không có bản nào "mới nhất" */ }

  // rowIndex ở đây là index trong mảng data (0-based, không tính header) -
  // cần cộng lại header+1 để ra đúng dòng thật trên sheet khi cần Sửa/Xóa.
  return items
    .map(x => {
      const key = String(x.r[COL.DON_VI] || "").trim() + "|" + utils.formatDateISO(x.r[COL.NGAY_TON_KHO]);
      const rowTs = x.r[COL.TIMESTAMP] instanceof Date ? x.r[COL.TIMESTAMP].getTime() : 0;
      const isLatest = chMap.has(key) && chMap.get(key) === rowTs;
      return rowToHistoryItem_(x.r, x.rowIndex + headerRow + 1, isLatest);
    })
    .sort((a, b) => b.ngayTonKhoISO.localeCompare(a.ngayTonKhoISO));
}

function getEntryDetail(rowIndex) {
  const sh = getResponsesSheet_();
  const r = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
  if (utils.isBlank(r[COL.DON_VI])) return null;
  return rowToHistoryItem_(r, rowIndex);
}

// ============================================================
// SỬA / XÓA (CHỈ ADMIN)
// ============================================================
function updateEntry(rowIndex, updates) {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được sửa dữ liệu." };

    updates = updates || {};
    const sh = getResponsesSheet_();
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };

    // Lấy khóa (Đơn vị, Ngày tồn kho) TRƯỚC khi sửa - cần để đồng bộ lại
    // đúng dòng Chitiettonkho cũ, phòng khi update đổi Đơn vị/Ngày.
    const beforeRow = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const oldDonVi = String(beforeRow[COL.DON_VI] || "").trim();
    const oldNgayISO = utils.formatDateISO(beforeRow[COL.NGAY_TON_KHO]);

    const fieldToCol = {
      donVi: COL.DON_VI, ngayTonKho: COL.NGAY_TON_KHO, tonDauNgay: COL.TON_DAU_NGAY,
      hoaNhonMT: COL.HOA_NHON_MT, hoaNhonBDMT: COL.HOA_NHON_BDMT,
      queSonMT: COL.QUE_SON_MT, queSonBDMT: COL.QUE_SON_BDMT,
      daiHiepMT: COL.DAI_HIEP_MT, daiHiepBDMT: COL.DAI_HIEP_BDMT,
      hakqnMT: COL.HAKQN_MT, hakqnBDMT: COL.HAKQN_BDMT,
      dieuChinh: COL.DIEU_CHINH, muonTra: COL.MUON_TRA, nhapGo: COL.NHAP_GO,
      tienSaMT: COL.TIEN_SA_MT, tienSaBDMT: COL.TIEN_SA_BDMT,
      dungQuatMT: COL.DUNG_QUAT_MT, dungQuatBDMT: COL.DUNG_QUAT_BDMT
    };
    const numericFields = new Set(["tonDauNgay","hoaNhonMT","hoaNhonBDMT","queSonMT","queSonBDMT",
      "daiHiepMT","daiHiepBDMT","hakqnMT","hakqnBDMT","dieuChinh","muonTra","nhapGo","tienSaMT","tienSaBDMT",
      "dungQuatMT","dungQuatBDMT"]);

    Object.keys(updates).forEach(field => {
      const colIdx = fieldToCol[field];
      if (colIdx === undefined) return;
      let val = updates[field];
      if (field === "ngayTonKho") {
        val = new Date(val);
        if (isNaN(val.getTime())) return;
      } else if (numericFields.has(field)) {
        val = utils.parseNum(val);
      }
      sh.getRange(rowIndex, colIdx + 1).setValue(val);
    });

    SpreadsheetApp.flush();
    logAudit_(getCurrentUserEmail_(), updates.donVi || "", updates.ngayTonKho || "", "Sửa dữ liệu bởi admin qua Web App (dòng " + rowIndex + ")");

    // Đồng bộ lại Chitiettonkho: khóa CŨ (phòng khi Đơn vị/Ngày bị đổi,
    // dòng Chitiettonkho cũ cần được xóa/tính lại) và khóa MỚI sau sửa.
    const afterRow = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const newDonVi = String(afterRow[COL.DON_VI] || "").trim();
    const newNgayISO = utils.formatDateISO(afterRow[COL.NGAY_TON_KHO]);
    syncChitietTonKhoForKey_(oldDonVi, oldNgayISO);
    if (newDonVi !== oldDonVi || newNgayISO !== oldNgayISO) syncChitietTonKhoForKey_(newDonVi, newNgayISO);

    return { success: true, message: "✅ Đã lưu thay đổi." };
  } catch (err) {
    return { success: false, message: "❌ Lỗi: " + err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function deleteEntry(rowIndex) {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được xóa dữ liệu." };

    const sh = getResponsesSheet_();
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };

    const r = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const donVi = String(r[COL.DON_VI] || "");
    const ngayTonKho = utils.formatDate(r[COL.NGAY_TON_KHO]);

    const ngayISO = utils.formatDateISO(r[COL.NGAY_TON_KHO]);
    sh.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    logAudit_(email, donVi, ngayTonKho, "Xóa dữ liệu bởi admin qua Web App");
    syncChitietTonKhoForKey_(donVi, ngayISO);
    return { success: true, message: `✅ Đã xóa báo cáo "${donVi}" ngày ${ngayTonKho}.` };
  } catch (err) {
    return { success: false, message: "❌ Lỗi: " + err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ============================================================
// PHÊ DUYỆT "BÁO CÁO LỆCH ĐẦU KỲ" TẠI LỊCH SỬ (mục X, v2026.8.17) -
// CHỈ ADMIN. rowIndex lấy trực tiếp từ dòng đang xem ở bảng Lịch Sử
// (giống cơ chế Sửa/Xóa sẵn có) - KHÔNG tự tìm lại theo (Đơn vị,Ngày)
// để tránh duyệt nhầm dòng khác nếu có nhiều lần nộp trùng khóa.
// ============================================================
function duyetBaoCao(rowIndex, chapNhan) {
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được duyệt báo cáo." };

    const sh = getResponsesSheet_();
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, message: "❌ Dòng không hợp lệ." };
    const r = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const trangThai = String(r[COL.TRANG_THAI_DUYET] || "");
    if (trangThai !== "Chờ duyệt") return { success: false, message: "❌ Báo cáo này không ở trạng thái Chờ duyệt (hiện tại: " + (trangThai || "bình thường") + ")." };

    const donVi = String(r[COL.DON_VI] || "").trim();
    const ngayISO = utils.formatDateISO(r[COL.NGAY_TON_KHO]);
    const ngayDisplay = utils.formatDate(r[COL.NGAY_TON_KHO]);
    // Mục AD (v2026.8.18): đọc lại lý do đã ghi lúc nộp (COL.LY_DO_CHO_DUYET)
    // thay vì hardcode "lệch đầu kỳ" như trước - vì 1 dòng có thể bị Chờ
    // duyệt do lệch đầu kỳ, lệch định mức, hoặc cả 2.
    const lyDoChoDuyet = String(r[COL.LY_DO_CHO_DUYET] || "").trim();
    const newStatus = chapNhan ? "Đã duyệt" : "Từ chối";
    sh.getRange(rowIndex, COL.TRANG_THAI_DUYET + 1).setValue(newStatus);
    SpreadsheetApp.flush();
    logAudit_(email, donVi, ngayDisplay, (chapNhan ? "Duyệt" : "Từ chối") + " báo cáo Chờ duyệt (dòng " + rowIndex + ")" + (lyDoChoDuyet ? " - " + lyDoChoDuyet : ""));
    // Đồng bộ lại Chitiettonkho cho khóa này - nếu Duyệt, dòng vừa duyệt
    // (nếu vẫn là lần nộp mới nhất khớp khóa) sẽ trở thành chính thức;
    // nếu Từ chối, dòng này vẫn bị loại như "Chờ duyệt" (xem
    // syncChitietTonKhoForKey_), khóa quay lại bản chính thức gần nhất
    // trước đó (hoặc trống nếu chưa từng có).
    syncChitietTonKhoForKey_(donVi, ngayISO);

    const r2 = sh.getRange(rowIndex, 1, 1, CFG.TOTAL_COL_COUNT).getValues()[0];
    const submitterEmail = String(r2[COL.EMAIL] || "");
    if (submitterEmail) {
      guiEmailAnToan_({
        to: submitterEmail,
        subject: (chapNhan ? "✅ Báo cáo đã được DUYỆT" : "❌ Báo cáo bị TỪ CHỐI") + " - " + donVi + " ngày " + ngayDisplay,
        body: "Báo cáo tồn kho đơn vị \"" + donVi + "\" ngày " + ngayDisplay + " bạn nộp (đang \"Chờ duyệt\"" + (lyDoChoDuyet ? " vì: " + lyDoChoDuyet : "") + ") đã được Admin " +
          (chapNhan ? "DUYỆT - đã cập nhật vào Chitiettonkho/Dashboard/Báo cáo." : "TỪ CHỐI - vui lòng kiểm tra lại số liệu và nộp lại.") +
          "\n\n(Email tự động từ Web App Quản Lý Tồn Kho Dăm - HAK Group)"
      }, (chapNhan ? "duyệt" : "từ chối") + " - " + donVi);
    }

    return {
      success: true,
      message: chapNhan
        ? "✅ Đã duyệt báo cáo \"" + donVi + "\" ngày " + ngayDisplay + " - đã cập nhật vào Chitiettonkho."
        : "✅ Đã từ chối báo cáo \"" + donVi + "\" ngày " + ngayDisplay + " - KHÔNG đưa vào Chitiettonkho (người nộp cần nộp lại)."
    };
  } catch (err) {
    return { success: false, message: "❌ Lỗi: " + err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** CHẠY 1 LẦN (Apps Script Editor > chọn hàm này ở thanh công cụ >
 * Run) SAU KHI cập nhật code có thêm cột "Trạng thái duyệt" (mục X,
 * v2026.8.17, cột thứ 42 = AP, nối cuối cùng phương án với Kho Dung
 * Quất ở mục H) - thêm nhãn tiêu đề cho cột mới vào CẢ 2 sheet "Form
 * Responses 1" và "Chitiettonkho" nếu chưa có (KHÔNG ảnh hưởng dữ liệu
 * ở các cột khác). Chạy lại nhiều lần không sao (chỉ ghi đè đúng 1 ô
 * tiêu đề bằng cùng 1 giá trị). CŨNG tạo sẵn 2 sheet mới "PhanQuyen" +
 * "DieuKienDuyet" (nếu chưa có) để Admin vào thẳng Cài đặt cấu hình
 * ngay, không cần đợi lần đọc/ghi đầu tiên tự tạo. */
function DAM_BAO_COT_TRANG_THAI_DUYET() {
  const ss = SpreadsheetApp.getActive();
  [CFG.SHEET_RESPONSES, CFG.SHEET_CHITIET].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const headerRow = name === CFG.SHEET_RESPONSES ? findHeaderRow_(sh) : 1;
    sh.getRange(headerRow, COL.TRANG_THAI_DUYET + 1).setValue("Trạng thái duyệt").setFontWeight("bold");
    // v2026.8.18 (mục AD): +1 cột "Lý do chờ duyệt" - hàm này ĐÃ được
    // thiết kế để chạy lại an toàn nhiều lần nên tiện thể thêm luôn ở
    // đây thay vì tạo 1 hàm setup mới riêng.
    sh.getRange(headerRow, COL.LY_DO_CHO_DUYET + 1).setValue("Lý do chờ duyệt").setFontWeight("bold");
  });
  getOrCreatePhanQuyenSheet_();
  getOrCreateDieuKienDuyetSheet_();
  SpreadsheetApp.flush();
  return "✅ Đã thêm cột 'Trạng thái duyệt' + 'Lý do chờ duyệt' (nếu chưa có) vào Form Responses 1 + Chitiettonkho, và tạo sẵn 2 sheet PhanQuyen/DieuKienDuyet.";
}

/** CHẠY 1 LẦN NẾU CẦN (Apps Script Editor > chọn hàm này > Run) - NÂNG
 * CẤP sheet "DieuKienDuyet" từ cấu trúc BẢN ĐẦU (mục X, 5 cột: Đơn vị |
 * Định mức tối thiểu | Định mức tối đa | Cập nhật lúc | Cập nhật bởi,
 * KHÔNG có khoảng ngày áp dụng) sang cấu trúc MỚI (mục Z, THÊM 2 cột
 * "Từ ngày"/"Đến ngày" ngay sau "Đơn vị") - CHỈ CẦN chạy nếu sheet
 * "DieuKienDuyet" đã được tạo TỪ TRƯỚC khi có mục Z (đã lỡ nhập vài
 * dòng cấu hình theo cấu trúc cũ). Nếu sheet chưa từng tồn tại hoặc đã
 * đúng cấu trúc mới rồi thì hàm này KHÔNG làm gì (an toàn khi chạy
 * nhầm/chạy lại nhiều lần). Các dòng cấu hình cũ sau khi nâng cấp sẽ có
 * "Từ ngày"/"Đến ngày" TRỐNG = hiểu là "không giới hạn ngày" (áp dụng
 * mọi lúc, giữ nguyên hành vi như trước khi nâng cấp) cho tới khi Admin
 * tự sửa lại khoảng ngày cụ thể ở Cài đặt > Điều kiện kiểm tra duyệt. */
function NANG_CAP_DIEUKIENDUYET_THEM_KHOANG_NGAY() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.SHEET_DIEUKIENDUYET);
  if (!sh) { getOrCreateDieuKienDuyetSheet_(); return "✅ Sheet DieuKienDuyet chưa tồn tại - đã tạo mới đúng cấu trúc mới (7 cột, có khoảng ngày áp dụng)."; }
  const headerB = String(sh.getRange(1, 2).getValue() || "");
  if (headerB.indexOf("Từ ngày") === 0) return "✅ Sheet DieuKienDuyet đã đúng cấu trúc mới (có cột Từ ngày/Đến ngày) - không cần nâng cấp.";
  sh.insertColumnsAfter(1, 2); // chèn 2 cột trống ngay sau cột A (Đơn vị), dời "Định mức..." cũ về cột D/E
  sh.getRange(1, 2).setValue("Từ ngày (để trống = không giới hạn)");
  sh.getRange(1, 3).setValue("Đến ngày (để trống = không giới hạn)");
  sh.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
  SpreadsheetApp.flush();
  return "✅ Đã nâng cấp sheet DieuKienDuyet lên cấu trúc mới - các dòng cấu hình cũ giữ nguyên Định mức, coi như 'không giới hạn ngày' cho tới khi Admin sửa lại khoảng ngày cụ thể.";
}

// ============================================================
// NHẬT KÝ (AUDIT) - CHỈ ADMIN
// ============================================================
function getAuditLog(filters) {
  const email = getCurrentUserEmail_();
  if (!utils.isAdmin(email)) return { allowed: false, rows: [] };

  filters = filters || {};
  const sh = getOrCreateAuditSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { allowed: true, rows: [] };
  const data = sh.getRange(2, 1, lastRow - 1, 5).getValues();

  let rows = data.map(r => ({
    thoiGian: utils.formatDate(r[0]) + " " + (r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+7", "HH:mm:ss") : ""),
    email: String(r[1] || ""),
    donVi: String(r[2] || ""),
    ngayTonKho: r[3] instanceof Date ? utils.formatDate(r[3]) : String(r[3] || ""),
    lyDo: String(r[4] || "")
  }));

  if (filters.donVi) rows = rows.filter(x => x.donVi === filters.donVi);
  return { allowed: true, rows: rows.reverse() };
}

// ============================================================
// BÁO CÁO / TỔNG HỢP - đọc từ Chitiettonkho (đã lọc trùng, mỗi
// Đơn vị+Ngày chỉ 1 dòng chính thức), không phụ thuộc cấu trúc thủ
// công của sheet Tonkho_Damgo (mục D) và không bị lệch bởi các lần
// nộp lại/trùng ở Form Responses 1 (mục E ở đầu file).
// ============================================================
function getReportSummary(fDate, tDate, donViFilter) {
  const { data } = readAllChitietData_();

  let items = data.filter(r => !utils.isBlank(r[COL.DON_VI]) && r[COL.NGAY_TON_KHO] instanceof Date);
  // THEO YÊU CẦU MỚI (mục AB, v2026.8.17): CHẶN Ở SERVER - xem ghi chú
  // donViChoPhepCuaToi_ (áp dụng đồng bộ với getHistoryList/getDashboardStats).
  const allowedUnits = donViChoPhepCuaToi_(utils.normEmail(getCurrentUserEmail_()));
  if (allowedUnits) items = items.filter(r => allowedUnits.includes(String(r[COL.DON_VI]).trim()));
  if (donViFilter) items = items.filter(r => String(r[COL.DON_VI]).trim() === donViFilter);
  if (fDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) >= fDate);
  if (tDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) <= tDate);

  // Nhóm theo Đơn vị, mỗi đơn vị lấy record đầu kỳ (ngày nhỏ nhất) và
  // cuối kỳ (ngày lớn nhất) trong khoảng lọc để tính tồn đầu kỳ/cuối kỳ.
  const byUnit = {};
  items.forEach(r => {
    const u = String(r[COL.DON_VI]).trim();
    if (!byUnit[u]) byUnit[u] = [];
    byUnit[u].push(r);
  });

  const rows = Object.keys(byUnit).map(u => {
    const list = byUnit[u].slice().sort((a, b) => a[COL.NGAY_TON_KHO] - b[COL.NGAY_TON_KHO]);
    const first = list[0], last = list[list.length - 1];
    const tongNhapGo = list.reduce((s, r) => s + utils.parseNum(r[COL.NHAP_GO]), 0);
    const tongMuonTra = list.reduce((s, r) => s + utils.parseNum(r[COL.MUON_TRA]), 0);
    const tongDieuChinh = list.reduce((s, r) => s + utils.parseNum(r[COL.DIEU_CHINH]), 0);
    return {
      donVi: u,
      soLanBaoCao: list.length,
      tuNgay: utils.formatDate(first[COL.NGAY_TON_KHO]),
      denNgay: utils.formatDate(last[COL.NGAY_TON_KHO]),
      tonDauKy: utils.parseNum(first[COL.TON_DAU_NGAY]),
      tonCuoiKy: utils.parseNum(last[COL.TON_CK]),
      congMTCuoiKy: utils.parseNum(last[COL.CONG_MT]),
      congBDMTCuoiKy: utils.parseNum(last[COL.CONG_BDMT]),
      doAmCuoiKy: utils.parseNum(last[COL.DO_AM]),
      tongNhapGoTrongKy: tongNhapGo,
      tongMuonTraTrongKy: tongMuonTra,
      tongDieuChinhTrongKy: tongDieuChinh,
      // --- Chi tiết KHO NHÀ MÁY (cuối kỳ, theo từng nguồn MT/BDMT) -
      // THEO YÊU CẦU MỚI (v2026.8.6): "Báo Cáo Tổng Hợp" trước đây chỉ
      // có số tổng chung chung (Tồn đầu/cuối kỳ, Cộng MT/BDMT gộp) -
      // thêm breakdown theo từng kho để không còn "nhìn chỉ thấy
      // chung". ---
      hoaNhonMTCuoiKy: utils.parseNum(last[COL.HOA_NHON_MT]), hoaNhonBDMTCuoiKy: utils.parseNum(last[COL.HOA_NHON_BDMT]),
      queSonMTCuoiKy: utils.parseNum(last[COL.QUE_SON_MT]), queSonBDMTCuoiKy: utils.parseNum(last[COL.QUE_SON_BDMT]),
      daiHiepMTCuoiKy: utils.parseNum(last[COL.DAI_HIEP_MT]), daiHiepBDMTCuoiKy: utils.parseNum(last[COL.DAI_HIEP_BDMT]),
      hakqnMTCuoiKy: utils.parseNum(last[COL.HAKQN_MT]), hakqnBDMTCuoiKy: utils.parseNum(last[COL.HAKQN_BDMT]),
      // --- Chi tiết KHO XUẤT HÀNG (cuối kỳ) - Tiên Sa + Dung Quất ---
      tienSaMTCuoiKy: utils.parseNum(last[COL.TIEN_SA_MT]), tienSaBDMTCuoiKy: utils.parseNum(last[COL.TIEN_SA_BDMT]),
      dungQuatMTCuoiKy: utils.parseNum(last[COL.DUNG_QUAT_MT]), dungQuatBDMTCuoiKy: utils.parseNum(last[COL.DUNG_QUAT_BDMT])
    };
  });

  rows.sort((a, b) => a.donVi.localeCompare(b.donVi));

  const sumField = key => rows.reduce((s, r) => s + r[key], 0);

  return {
    rows,
    tongTonCuoiKy: sumField('tonCuoiKy'),
    tongNhapGoTrongKy: sumField('tongNhapGoTrongKy'),
    // Tổng cộng (Grand Total, dòng cuối bảng) cho các cột chi tiết kho -
    // cùng quy ước SUM như báo cáo theo mẫu Tonkho_Damgo (mục G).
    total: {
      congMTCuoiKy: sumField('congMTCuoiKy'), congBDMTCuoiKy: sumField('congBDMTCuoiKy'),
      hoaNhonMTCuoiKy: sumField('hoaNhonMTCuoiKy'), hoaNhonBDMTCuoiKy: sumField('hoaNhonBDMTCuoiKy'),
      queSonMTCuoiKy: sumField('queSonMTCuoiKy'), queSonBDMTCuoiKy: sumField('queSonBDMTCuoiKy'),
      daiHiepMTCuoiKy: sumField('daiHiepMTCuoiKy'), daiHiepBDMTCuoiKy: sumField('daiHiepBDMTCuoiKy'),
      hakqnMTCuoiKy: sumField('hakqnMTCuoiKy'), hakqnBDMTCuoiKy: sumField('hakqnBDMTCuoiKy'),
      tienSaMTCuoiKy: sumField('tienSaMTCuoiKy'), tienSaBDMTCuoiKy: sumField('tienSaBDMTCuoiKy'),
      dungQuatMTCuoiKy: sumField('dungQuatMTCuoiKy'), dungQuatBDMTCuoiKy: sumField('dungQuatBDMTCuoiKy')
    }
  };
}

// Bản đồ 4 NHÀ MÁY (nguồn nhập gỗ vào từng kho, KHÁC với 4 "Đơn vị" pháp
// nhân ở CFG.UNITS - xem giải thích ở mục V bên dưới) sang cột MT/BDMT
// tương ứng trong Chitiettonkho.
const NHA_MAY_MAP = {
  hoaNhon: { label: "Hòa Nhơn", mt: COL.HOA_NHON_MT, bdmt: COL.HOA_NHON_BDMT },
  queSon: { label: "Quế Sơn", mt: COL.QUE_SON_MT, bdmt: COL.QUE_SON_BDMT },
  daiHiep: { label: "Đại Hiệp", mt: COL.DAI_HIEP_MT, bdmt: COL.DAI_HIEP_BDMT },
  hakqn: { label: "HAKQN", mt: COL.HAKQN_MT, bdmt: COL.HAKQN_BDMT }
};

/** Báo cáo CHI TIẾT THEO TỪNG NGÀY (không gộp về đầu/cuối kỳ như
 * getReportSummary), lọc được theo NHÀ MÁY (nguồn nhập) - THEO YÊU CẦU
 * MỚI (mục V, v2026.8.17): "Báo Cáo Tổng Hợp" trước đây chỉ lọc được
 * theo Đơn vị (4 pháp nhân) và chỉ có số liệu cuối kỳ (1 dòng/đơn vị) -
 * không có cách xem diễn biến từng ngày của riêng 1 nhà máy (Hòa Nhơn /
 * Quế Sơn / Đại Hiệp / HAKQN). Hàm này trả về 1 DÒNG/NGÀY/ĐƠN VỊ trong
 * khoảng lọc, kèm cột MT/BDMT của (các) nhà máy được chọn.
 * nhaMay: '' hoặc bỏ trống = hiển thị cả 4 nhà máy cạnh nhau; hoặc 1
 * trong các khóa của NHA_MAY_MAP ('hoaNhon'|'queSon'|'daiHiep'|'hakqn')
 * = chỉ hiển thị đúng nhà máy đó. */
function getNhaMayDetailReport(fDate, tDate, donViFilter, nhaMay) {
  const { data } = readAllChitietData_();
  let items = data.filter(r => !utils.isBlank(r[COL.DON_VI]) && r[COL.NGAY_TON_KHO] instanceof Date);
  // THEO YÊU CẦU MỚI (mục AB, v2026.8.17): CHẶN Ở SERVER - xem ghi chú
  // donViChoPhepCuaToi_ (áp dụng đồng bộ với getHistoryList/getReportSummary).
  const allowedUnits = donViChoPhepCuaToi_(utils.normEmail(getCurrentUserEmail_()));
  if (allowedUnits) items = items.filter(r => allowedUnits.includes(String(r[COL.DON_VI]).trim()));
  if (donViFilter) items = items.filter(r => String(r[COL.DON_VI]).trim() === donViFilter);
  if (fDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) >= fDate);
  if (tDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) <= tDate);

  items.sort((a, b) => {
    const du = String(a[COL.DON_VI]).trim().localeCompare(String(b[COL.DON_VI]).trim());
    if (du !== 0) return du;
    return a[COL.NGAY_TON_KHO] - b[COL.NGAY_TON_KHO];
  });

  const factoryKeys = (nhaMay && NHA_MAY_MAP[nhaMay]) ? [nhaMay] : Object.keys(NHA_MAY_MAP);

  const rows = items.map(r => {
    const row = {
      donVi: String(r[COL.DON_VI]).trim(),
      ngay: utils.formatDate(r[COL.NGAY_TON_KHO]),
      ngayISO: utils.formatDateISO(r[COL.NGAY_TON_KHO]),
      tonCK: utils.parseNum(r[COL.TON_CK]),
      doAm: utils.parseNum(r[COL.DO_AM])
    };
    let congMT = 0, congBDMT = 0;
    factoryKeys.forEach(k => {
      const mt = utils.parseNum(r[NHA_MAY_MAP[k].mt]);
      const bdmt = utils.parseNum(r[NHA_MAY_MAP[k].bdmt]);
      row[k + "MT"] = mt; row[k + "BDMT"] = bdmt;
      congMT += mt; congBDMT += bdmt;
    });
    row.congMT = congMT; row.congBDMT = congBDMT;
    return row;
  });

  const total = { congMT: sum_(rows.map(r => r.congMT)), congBDMT: sum_(rows.map(r => r.congBDMT)) };
  factoryKeys.forEach(k => {
    total[k + "MT"] = sum_(rows.map(r => r[k + "MT"]));
    total[k + "BDMT"] = sum_(rows.map(r => r[k + "BDMT"]));
  });

  return {
    rows,
    total,
    factories: factoryKeys.map(k => ({ key: k, label: NHA_MAY_MAP[k].label })),
    soDong: rows.length
  };
}

/** Bảng chi tiết theo NGÀY cho 1 đơn vị (để vẽ biểu đồ / xem diễn biến) -
 * đọc từ Chitiettonkho để mỗi ngày chỉ có đúng 1 điểm dữ liệu. */
function getUnitTimeline(donVi, fDate, tDate) {
  // THEO YÊU CẦU MỚI (mục AB, v2026.8.17): CHẶN Ở SERVER - không phải
  // Admin thì chỉ xem được đúng Đơn vị mình được cấp quyền.
  const allowedUnits = donViChoPhepCuaToi_(utils.normEmail(getCurrentUserEmail_()));
  if (allowedUnits && allowedUnits.indexOf(donVi) === -1) return [];
  const { data } = readAllChitietData_();
  let items = data.filter(r => String(r[COL.DON_VI] || "").trim() === donVi && r[COL.NGAY_TON_KHO] instanceof Date);
  if (fDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) >= fDate);
  if (tDate) items = items.filter(r => utils.formatDateISO(r[COL.NGAY_TON_KHO]) <= tDate);
  items.sort((a, b) => a[COL.NGAY_TON_KHO] - b[COL.NGAY_TON_KHO]);
  return items.map(r => ({
    ngay: utils.formatDate(r[COL.NGAY_TON_KHO]),
    ngayISO: utils.formatDateISO(r[COL.NGAY_TON_KHO]),
    tonDauNgay: utils.parseNum(r[COL.TON_DAU_NGAY]),
    tonCK: utils.parseNum(r[COL.TON_CK]),
    nhapGo: utils.parseNum(r[COL.NHAP_GO]),
    doAm: utils.parseNum(r[COL.DO_AM])
  }));
}

// ============================================================
// BÁO CÁO KHO THEO ĐÚNG MẪU "Tonkho_Damgo" (mục G ở đầu file) - dựng
// lại từ Chitiettonkho (đã lọc trùng) cho 1 NGÀY TỒN KHO cụ thể, theo
// đúng cấu trúc 3 mục (NHÀ MÁY / KHO XUẤT HÀNG / ĐỊNH MỨC SX) đã xác
// nhận từ bản mẫu thật do người dùng cung cấp.
// ============================================================

// Thứ tự đơn vị hiển thị trong báo cáo này khớp đúng mẫu gốc (khác thứ
// tự CFG.UNITS dùng cho các màn khác) - KHÔNG tự ý đổi trừ khi mẫu gốc
// đổi thứ tự.
const REPORT_UNIT_ORDER = ["CNHAK (QS)", "Đại Hiệp (Đại Lộc)", "HAK (Bà Nà)", "HAKQN (QS Trung)"];

function sum_(arr) { return arr.reduce((s, v) => s + (Number(v) || 0), 0); }
function avg_(arr) { return arr.length ? sum_(arr) / arr.length : 0; }

/** Tìm bản ghi Chitiettonkho GẦN NHẤT TRƯỚC ngayISO (không tính đúng
 * ngayISO) cho 1 đơn vị - dùng cho chế độ "Đầy đủ số liệu" của báo cáo
 * Tonkho_Damgo (mục L): đơn vị nào chưa báo cáo đúng ngày được chọn thì
 * lấy tạm số liệu của ngày gần nhất trước đó để không hiển thị 0 gây
 * hiểu nhầm là tồn kho về 0. Trả về null nếu đơn vị đó CHƯA TỪNG có bản
 * ghi nào trước ngày đó (khi đó vẫn phải hiển thị 0, không có gì để lấy). */
function findLatestChitietBeforeDate_(data, donVi, ngayISO) {
  let best = null, bestTime = -Infinity;
  data.forEach(r => {
    if (String(r[COL.DON_VI] || "").trim() !== donVi) return;
    const d = r[COL.NGAY_TON_KHO];
    if (!(d instanceof Date)) return;
    if (utils.formatDateISO(d) >= ngayISO) return; // chỉ lấy ngày TRƯỚC, không lấy đúng ngày hay sau
    const t = d.getTime();
    if (t > bestTime) { bestTime = t; best = r; }
  });
  return best;
}

/** mode: "actual" (mặc định, THEO THỰC TẾ - đơn vị chưa báo cáo hiển thị
 * 0) hoặc "full" (ĐẦY ĐỦ SỐ LIỆU - đơn vị chưa báo cáo đúng ngày được
 * chọn thì tự động lấy tạm số liệu ngày gần nhất TRƯỚC đó, có ghi chú rõ
 * đang hiển thị số liệu của ngày nào) - THEO YÊU CẦU MỚI (mục L). */
function getTonkhoDamgoReport(ngayISO, mode) {
  if (!ngayISO) return { success: false, message: "❌ Vui lòng chọn ngày báo cáo." };
  mode = (mode === "full") ? "full" : "actual";
  const { data } = readAllChitietData_();

  const recByUnit = {};      // bản ghi ĐÚNG ngày được chọn (null nếu chưa báo cáo)
  const effectiveByUnit = {}; // bản ghi thực sự dùng để hiển thị (= recByUnit, hoặc bản ghi thay thế nếu mode="full")
  const fallbackDateByUnit = {}; // ngày của bản ghi thay thế (chỉ có khi mode="full" và tìm được)
  REPORT_UNIT_ORDER.forEach(u => { recByUnit[u] = null; effectiveByUnit[u] = null; fallbackDateByUnit[u] = null; });
  data.forEach(r => {
    const donVi = String(r[COL.DON_VI] || "").trim();
    if (!(donVi in recByUnit)) return;
    if (utils.formatDateISO(r[COL.NGAY_TON_KHO]) === ngayISO) recByUnit[donVi] = r;
  });
  REPORT_UNIT_ORDER.forEach(u => {
    if (recByUnit[u]) { effectiveByUnit[u] = recByUnit[u]; return; }
    if (mode === "full") {
      const fallback = findLatestChitietBeforeDate_(data, u, ngayISO);
      if (fallback) { effectiveByUnit[u] = fallback; fallbackDateByUnit[u] = utils.formatDate(fallback[COL.NGAY_TON_KHO]); }
    }
  });
  const get = (u, col) => { const r = effectiveByUnit[u]; return r ? utils.parseNum(r[col]) : 0; };

  // --- Mục NHÀ MÁY - bảng 1: MT/BDMT theo nguồn nhập, Grand Total = SUM ---
  const table1 = REPORT_UNIT_ORDER.map(u => ({
    donVi: u,
    hoaNhonMT: get(u, COL.HOA_NHON_MT), queSonMT: get(u, COL.QUE_SON_MT),
    daiHiepMT: get(u, COL.DAI_HIEP_MT), hakqnMT: get(u, COL.HAKQN_MT),
    congMT: get(u, COL.CONG_MT),
    hoaNhonBDMT: get(u, COL.HOA_NHON_BDMT), queSonBDMT: get(u, COL.QUE_SON_BDMT),
    daiHiepBDMT: get(u, COL.DAI_HIEP_BDMT), hakqnBDMT: get(u, COL.HAKQN_BDMT),
    congBDMT: get(u, COL.CONG_BDMT)
  }));
  const table1Total = {
    donVi: "Grand Total",
    hoaNhonMT: sum_(table1.map(r => r.hoaNhonMT)), queSonMT: sum_(table1.map(r => r.queSonMT)),
    daiHiepMT: sum_(table1.map(r => r.daiHiepMT)), hakqnMT: sum_(table1.map(r => r.hakqnMT)),
    congMT: sum_(table1.map(r => r.congMT)),
    hoaNhonBDMT: sum_(table1.map(r => r.hoaNhonBDMT)), queSonBDMT: sum_(table1.map(r => r.queSonBDMT)),
    daiHiepBDMT: sum_(table1.map(r => r.daiHiepBDMT)), hakqnBDMT: sum_(table1.map(r => r.hakqnBDMT)),
    congBDMT: sum_(table1.map(r => r.congBDMT))
  };

  // --- Mục NHÀ MÁY - bảng 2: Độ ẩm theo kho (SUM) + Độ ẩm/Độ khô TB
  // (AVERAGE) - CHỈ tính trung bình trên đơn vị THỰC SỰ có sản lượng
  // (Cộng MT > 0, xem table1) trong ngày - SỬA LỖI (mục Q, v2026.8.17,
  // CÙNG LỖI với mục O ở Kho xuất hàng): bản cũ lấy AVERAGE độ ẩm/độ khô
  // TB trên CẢ 4 đơn vị kể cả đơn vị không có sản lượng ngày đó (Cộng
  // MT=0), kéo lệch số trung bình.
  const table2 = REPORT_UNIT_ORDER.map(u => ({
    donVi: u,
    doAmHN: get(u, COL.DO_AM_HN), doAmQS: get(u, COL.DO_AM_QS),
    doAmDH: get(u, COL.DO_AM_DH), doAmQC: get(u, COL.DO_AM_QC),
    doAm: get(u, COL.DO_AM), doKho: get(u, COL.DO_KHO)
  }));
  const donViCoSanLuongNhaMay = table1.filter(r => r.congMT > 0).map(r => r.donVi);
  const table2CoTon = table2.filter(r => donViCoSanLuongNhaMay.indexOf(r.donVi) !== -1);
  const table2Total = {
    donVi: "Grand Total",
    doAmHN: sum_(table2.map(r => r.doAmHN)), doAmQS: sum_(table2.map(r => r.doAmQS)),
    doAmDH: sum_(table2.map(r => r.doAmDH)), doAmQC: sum_(table2.map(r => r.doAmQC)),
    doAm: avg_(table2CoTon.map(r => r.doAm)), doKho: avg_(table2CoTon.map(r => r.doKho))
  };

  // --- Mục KHO XUẤT HÀNG: MT/BDMT = SUM, % (Độ ẩm/Độ khô Tiên Sa) =
  // AVERAGE - CHỈ tính trung bình trên các ĐƠN VỊ THỰC SỰ CÓ TỒN tại
  // kho này trong ngày (tienSaMT > 0) - SỬA LỖI (mục O, v2026.8.17): bản
  // cũ lấy AVERAGE cả những đơn vị không hề có hàng ở Kho Tiên Sa hôm đó
  // (MT=0, do đơn vị đó không xuất qua kho này) - độ ẩm/độ khô của các
  // dòng "không tồn" đó thường là 0 hoặc rác, kéo lệch số trung bình.
  const table3 = REPORT_UNIT_ORDER.map(u => ({
    donVi: u,
    tienSaMT: get(u, COL.TIEN_SA_MT), tienSaBDMT: get(u, COL.TIEN_SA_BDMT),
    doAmTienSa: get(u, COL.DO_AM_TIEN_SA), doKhoTienSa: get(u, COL.DO_KHO_TIEN_SA)
  }));
  const table3CoTon = table3.filter(r => r.tienSaMT > 0);
  const table3Total = {
    donVi: "Grand Total",
    tienSaMT: sum_(table3.map(r => r.tienSaMT)), tienSaBDMT: sum_(table3.map(r => r.tienSaBDMT)),
    doAmTienSa: avg_(table3CoTon.map(r => r.doAmTienSa)), doKhoTienSa: avg_(table3CoTon.map(r => r.doKhoTienSa))
  };

  // --- Mục KHO XUẤT HÀNG - "Kho Dung Quất" (v2026.8.4, mục H): CHỨC
  // NĂNG VÀ CÁCH TÍNH GIỐNG HỆT "Kho Tiên Sa" ở trên (MT/BDMT = SUM, % =
  // AVERAGE chỉ trên đơn vị có tồn, xem mục O) - chỉ khác nguồn cột dữ liệu.
  const table3b = REPORT_UNIT_ORDER.map(u => ({
    donVi: u,
    dungQuatMT: get(u, COL.DUNG_QUAT_MT), dungQuatBDMT: get(u, COL.DUNG_QUAT_BDMT),
    doAmDungQuat: get(u, COL.DO_AM_DUNG_QUAT), doKhoDungQuat: get(u, COL.DO_KHO_DUNG_QUAT)
  }));
  const table3bCoTon = table3b.filter(r => r.dungQuatMT > 0);
  const table3bTotal = {
    donVi: "Grand Total",
    dungQuatMT: sum_(table3b.map(r => r.dungQuatMT)), dungQuatBDMT: sum_(table3b.map(r => r.dungQuatBDMT)),
    doAmDungQuat: avg_(table3bCoTon.map(r => r.doAmDungQuat)), doKhoDungQuat: avg_(table3bCoTon.map(r => r.doKhoDungQuat))
  };

  // --- Mục ĐỊNH MỨC SX: số lượng = SUM, Định mức (%) = AVERAGE ---
  const table4 = REPORT_UNIT_ORDER.map(u => ({
    donVi: u,
    tonDauKy: get(u, COL.TON_DAU_NGAY), tonCK: get(u, COL.TON_CK),
    muonTra: get(u, COL.MUON_TRA), clDoAm: get(u, COL.DIEU_CHINH),
    nhapTrongKy: get(u, COL.NHAP_TRONG_KY), dinhMuc: get(u, COL.DINH_MUC)
  }));
  const table4Total = {
    donVi: "Grand Total",
    tonDauKy: sum_(table4.map(r => r.tonDauKy)), tonCK: sum_(table4.map(r => r.tonCK)),
    muonTra: sum_(table4.map(r => r.muonTra)), clDoAm: sum_(table4.map(r => r.clDoAm)),
    nhapTrongKy: sum_(table4.map(r => r.nhapTrongKy)), dinhMuc: avg_(table4.map(r => r.dinhMuc))
  };

  const missingUnits = REPORT_UNIT_ORDER.filter(u => !recByUnit[u]);
  // Chi tiết từng đơn vị thiếu báo cáo đúng ngày (mục L) - dùng cho cả 2
  // chế độ hiển thị: usedDate có giá trị khi mode="full" VÀ tìm được
  // bản ghi thay thế gần nhất trước đó; null nếu chưa từng có dữ liệu
  // nào trước đó (kể cả ở mode="full" vẫn phải hiển thị 0 vì không có
  // gì để lấy).
  const missingUnitsDetail = missingUnits.map(u => ({ donVi: u, usedDate: fallbackDateByUnit[u] || null }));
  const p = ngayISO.split("-");

  return {
    success: true,
    ngayISO,
    ngayDisplay: p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ngayISO,
    mode,
    table1, table1Total, table2, table2Total, table3, table3Total, table3b, table3bTotal,
    table4, table4Total,
    missingUnits, missingUnitsDetail
  };
}

// ============================================================
// BOT TELEGRAM - BÁO CÁO TỒN KHO ĐỊNH KỲ (mục M, cập nhật mục S,
// v2026.8.17) - GỬI 1 ẢNH DUY NHẤT "Y NHƯ TRANG CHỦ"
// ------------------------------------------------------------
// Gửi báo cáo tồn kho vào 1 chat/nhóm Telegram, TỰ ĐỘNG chạy 16h chiều
// hàng ngày TRỪ Chủ nhật. Mỗi lần gửi (tự động hay đột xuất) CHỈ gửi
// ĐÚNG 1 file ẢNH (PNG) tóm tắt, nội dung/số liệu giống hệt trang "Trang
// chủ" (Dashboard) trên Web App - tái sử dụng NGUYÊN hàm
// getDashboardStats() (không tính lại số liệu riêng, đảm bảo khớp tuyệt
// đối với Trang chủ). Đây là bot CHỈ GỬI (không nhận lệnh/hỏi-đáp) nên
// KHÔNG cần polling nhận tin nhắn - chỉ cần 1 trigger giờ cố định gọi
// UrlFetchApp để gửi ra.
//
// CÁCH THIẾT LẬP (làm 1 LẦN DUY NHẤT sau khi deploy code này):
//  1. Tạo bot: mở Telegram, chat với @BotFather > gõ /newbot > làm
//     theo hướng dẫn > BotFather trả về 1 TOKEN dạng
//     "123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" - copy lại.
//  2. Thêm bot vừa tạo vào nhóm Telegram cần nhận báo cáo (hoặc chat
//     riêng với bot nếu chỉ 1 người nhận), gửi thử NGAY 1 tin bất kỳ
//     vào đó (bắt buộc - để bước 4 lấy được Chat ID).
//  3. Mở Apps Script Editor > chọn hàm LUU_TELEGRAM_BOT_TOKEN ở thanh
//     công cụ trên cùng > bấm Run 1 lần SAU KHI sửa tạm dòng cuối cùng
//     của hàm đó để truyền đúng token vừa lấy (hoặc đơn giản hơn: vào
//     Project Settings (biểu tượng bánh răng) > Script Properties >
//     Add script property > tên "TELEGRAM_BOT_TOKEN", giá trị = token).
//  4. Chạy hàm TU_DONG_LAY_CHAT_ID_TELEGRAM() (chọn hàm này ở thanh
//     công cụ > Run) > mở "Execution log" (Ctrl+Enter hoặc View >
//     Logs) để xem kết quả - copy đúng "chatId" của nhóm/chat vừa nhắn
//     thử ở bước 2.
//  5. Lưu Chat ID: thêm Script property tên "TELEGRAM_CHAT_ID" = chatId
//     vừa lấy được (cùng chỗ Project Settings > Script Properties).
//  6. Chạy hàm GUI_BAO_CAO_TON_KHO_TELEGRAM_NGAY() để gửi thử NGAY 1
//     bản báo cáo (ảnh) - kiểm tra nội dung/định dạng hiện đúng trong
//     nhóm Telegram trước khi tin vào lịch tự động.
//  7. Chạy hàm BAT_LICH_BAO_CAO_TON_KHO_TELEGRAM() ĐÚNG 1 LẦN để bật
//     lịch gửi tự động - không cần chạy lại trừ khi muốn đổi giờ (nếu
//     chạy lại nhiều lần cũng KHÔNG bị tạo trùng trigger, hàm tự xóa
//     trigger cũ trước khi tạo mới). NẾU bạn ĐANG NÂNG CẤP từ bản trước
//     (lịch cũ 15h) thì BẮT BUỘC chạy lại hàm này 1 lần để đổi sang 16h.
//  8. QUAN TRỌNG: giờ chạy của trigger tính theo múi giờ đã cấu hình
//     cho PROJECT Apps Script (Project Settings > Time zone), KHÔNG
//     phải theo code - vào đó kiểm tra đang để múi giờ Việt Nam
//     "(GMT+07:00) Vietnam Time - Asia/Ho_Chi_Minh" thì trigger mới
//     chạy đúng 16h giờ Việt Nam. Ngoài ra Apps Script chỉ đảm bảo
//     trigger hàng ngày chạy TRONG vòng khoảng ~15 phút quanh giờ đã
//     đặt (không chính xác tuyệt đối tới từng giây/phút - giới hạn của
//     nền tảng, không phải lỗi cấu hình).
// ============================================================

function LUU_TELEGRAM_BOT_TOKEN(token) {
  PropertiesService.getScriptProperties().setProperty("TELEGRAM_BOT_TOKEN", String(token || "").trim());
}
function LUU_TELEGRAM_CHAT_ID(chatId) {
  PropertiesService.getScriptProperties().setProperty("TELEGRAM_CHAT_ID", String(chatId || "").trim());
}

/** Liệt kê Chat ID gần đây bot nhận được tin (xem Execution log sau khi
 * Run) - chỉ thấy được chat NÀO đã nhắn thử ít nhất 1 tin cho bot (và
 * CHƯA từng được lấy qua getUpdates lần nào trước đó) - xem bước 2+4 ở
 * hướng dẫn phía trên. */
function TU_DONG_LAY_CHAT_ID_TELEGRAM() {
  const token = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");
  if (!token) { Logger.log('Chưa lưu TELEGRAM_BOT_TOKEN - xem bước 3 ở hướng dẫn mục M.'); return; }
  const json = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getUpdates", { muteHttpExceptions: true }).getContentText());
  const daThay = {};
  (json.result || []).forEach(function (u) {
    const chat = u.message && u.message.chat;
    if (chat) daThay[chat.id] = { chatId: chat.id.toString(), ten: chat.title || chat.first_name || "(?)", loai: chat.type };
  });
  const list = Object.values(daThay);
  Logger.log(JSON.stringify(list, null, 2));
  return list;
}

/** Gửi 1 tin nhắn Telegram dạng chữ (HTML) - KHÔNG dùng cho báo cáo
 * định kỳ nữa (mục S đổi sang gửi ảnh, xem guiAnhTelegram_), giữ lại
 * hàm này để dùng cho các tin cảnh báo/thông báo ngắn khác nếu cần sau
 * này. */
function guiTinTelegram_(text, chatIdRieng) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = chatIdRieng || p.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error('Chưa cấu hình đủ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID - xem hướng dẫn thiết lập ở mục M đầu file.');
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const res = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) throw new Error("Gửi Telegram lỗi: " + (json.description || res.getContentText()));
}

/** Gửi 1 ảnh (Blob PNG...) qua Telegram (sendPhoto) - khác sendDocument
 * ở chỗ ảnh hiện PREVIEW ngay trong khung chat thay vì phải bấm mở như
 * file đính kèm thường (mục S). `blob` truyền trực tiếp vào payload -
 * UrlFetchApp tự đóng gói thành multipart/form-data khi payload có chứa
 * Blob (không cần tự dựng boundary thủ công). */
function guiAnhTelegram_(blob, caption, chatIdRieng) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = chatIdRieng || p.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error('Chưa cấu hình đủ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID - xem hướng dẫn thiết lập ở mục M đầu file.');
  const url = "https://api.telegram.org/bot" + token + "/sendPhoto";
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    payload: { chat_id: chatId, photo: blob, caption: (caption || "").slice(0, 1024) },
    muteHttpExceptions: true
  });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) throw new Error("Gửi ảnh Telegram lỗi: " + (json.description || res.getContentText()));
}

function fmtNumVN_(n) { return (Number(n) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 }); }
function fmtPctVN_(n) { return ((Number(n) || 0) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%"; }
function escHtml_(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ============================================================
// BÁO CÁO TELEGRAM "THEO MẪU TONKHO_DAMGO" (mục U, v2026.8.17) - KHÔI
// PHỤC LẠI mẫu gửi CŨ (1 tin nhắn tóm tắt dạng chữ + 2 file PDF: Theo
// thực tế + Đầy đủ số liệu) CHỈ CHO nút "📨 Gửi báo cáo Telegram" ở
// trang Báo Cáo Tổng Hợp > Theo mẫu Tonkho_Damgo - THEO YÊU CẦU MỚI:
// "TRONG BÁO CÁO TỒN KHO DĂM VẪN GIỮ NGUYÊN MẪU GỞI NHƯ CŨ". Đây LÀ
// CÁC HÀM đã từng bị gỡ bỏ ở mục S (khi đổi báo cáo Telegram TỰ ĐỘNG
// sang gửi ảnh) - nay khôi phục lại NGUYÊN VẸN, dùng RIÊNG cho ngữ cảnh
// "Theo mẫu Tonkho_Damgo" (theo ngày + chế độ đang chọn trên màn hình),
// TÁCH BIỆT hoàn toàn với báo cáo ảnh Trang chủ (mục S/T) - 2 luồng gửi
// KHÔNG dùng chung hàm nào để tránh lẫn lộn. Ảnh Trang chủ CHỈ gửi qua
// lịch tự động 16h (BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_) + nút riêng ở
// Trang chủ > Công cụ Admin (guiBaoCaoTelegramTuWebApp, không tham số) -
// KHÔNG liên quan gì tới các hàm bên dưới đây.
// ============================================================

/** Dựng nội dung tin nhắn báo cáo tồn kho (HTML Telegram) từ kết quả
 * getTonkhoDamgoReport() - CHỈ định dạng lại thành văn bản gọn cho di
 * động, KHÔNG tính lại bất kỳ số liệu nào (tránh lệch với trang Báo
 * Cáo trên Web App). */
function soanNoiDungBaoCaoTonKhoTelegram_(res) {
  if (!res || !res.success) return "⚠️ Không dựng được báo cáo tồn kho: " + escHtml_((res && res.message) || "Lỗi không xác định.");

  const lines = [];
  lines.push("📦 <b>BÁO CÁO TỒN KHO DĂM - HAK GROUP</b>");
  lines.push("🗓 Ngày tồn kho: <b>" + escHtml_(res.ngayDisplay) + "</b>" + (res.mode === "full" ? " (chế độ: Đầy đủ số liệu)" : " (chế độ: Theo thực tế)"));

  if (res.missingUnits && res.missingUnits.length) {
    if (res.mode === "full") {
      const detail = res.missingUnitsDetail || [];
      const withFallback = detail.filter(function (d) { return d.usedDate; });
      const noFallback = detail.filter(function (d) { return !d.usedDate; });
      if (withFallback.length) lines.push("⚠️ Lấy tạm số liệu ngày gần nhất: " + withFallback.map(function (d) { return escHtml_(d.donVi) + " (" + escHtml_(d.usedDate) + ")"; }).join(", "));
      if (noFallback.length) lines.push("⚠️ Chưa từng có dữ liệu: " + noFallback.map(function (d) { return escHtml_(d.donVi); }).join(", "));
    } else {
      lines.push("⚠️ Chưa báo cáo (đang hiển thị 0): " + res.missingUnits.map(escHtml_).join(", "));
    }
  }

  lines.push("");
  lines.push("🏭 <b>NHÀ MÁY</b> (Cộng MT / Cộng BDMT)");
  res.table1.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": " + fmtNumVN_(r.congMT) + " / " + fmtNumVN_(r.congBDMT)); });
  lines.push("➡️ Tổng: " + fmtNumVN_(res.table1Total.congMT) + " MT / " + fmtNumVN_(res.table1Total.congBDMT) + " BDMT");
  lines.push("   Độ ẩm TB: " + fmtPctVN_(res.table2Total.doAm) + " · Độ khô TB: " + fmtPctVN_(res.table2Total.doKho));

  lines.push("");
  lines.push("📦 <b>KHO XUẤT HÀNG</b>");
  lines.push("<u>Kho Tiên Sa</u>");
  const tienSaCoTon = res.table3.filter(function (r) { return r.tienSaMT > 0; });
  if (tienSaCoTon.length) {
    tienSaCoTon.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": " + fmtNumVN_(r.tienSaMT) + " MT / " + fmtNumVN_(r.tienSaBDMT) + " BDMT (ẩm " + fmtPctVN_(r.doAmTienSa) + ")"); });
  } else {
    lines.push("(chưa có đơn vị nào có hàng ở kho này ngày hôm nay)");
  }
  lines.push("➡️ Tổng: " + fmtNumVN_(res.table3Total.tienSaMT) + " MT / " + fmtNumVN_(res.table3Total.tienSaBDMT) + " BDMT (ẩm TB " + fmtPctVN_(res.table3Total.doAmTienSa) + ")");

  lines.push("<u>Kho Dung Quất</u>");
  const dungQuatCoTon = res.table3b.filter(function (r) { return r.dungQuatMT > 0; });
  if (dungQuatCoTon.length) {
    dungQuatCoTon.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": " + fmtNumVN_(r.dungQuatMT) + " MT / " + fmtNumVN_(r.dungQuatBDMT) + " BDMT (ẩm " + fmtPctVN_(r.doAmDungQuat) + ")"); });
  } else {
    lines.push("(chưa có đơn vị nào có hàng ở kho này ngày hôm nay)");
  }
  lines.push("➡️ Tổng: " + fmtNumVN_(res.table3bTotal.dungQuatMT) + " MT / " + fmtNumVN_(res.table3bTotal.dungQuatBDMT) + " BDMT (ẩm TB " + fmtPctVN_(res.table3bTotal.doAmDungQuat) + ")");

  lines.push("");
  lines.push("📊 <b>TỒN KHO / ĐỊNH MỨC</b>");
  res.table4.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": Đầu kỳ " + fmtNumVN_(r.tonDauKy) + " → Cuối kỳ " + fmtNumVN_(r.tonCK) + " MT (định mức " + fmtPctVN_(r.dinhMuc) + ")"); });
  lines.push("➡️ Tổng tồn cuối kỳ: <b>" + fmtNumVN_(res.table4Total.tonCK) + " MT</b>");

  lines.push("");
  lines.push("📥 <b>SẢN LƯỢNG GỖ NHẬP TRONG NGÀY</b> (Nhập trong kỳ, MT)");
  res.table4.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": " + fmtNumVN_(r.nhapTrongKy) + " MT"); });
  lines.push("➡️ Tổng: <b>" + fmtNumVN_(res.table4Total.nhapTrongKy) + " MT</b>");

  lines.push("");
  lines.push("🪵 <b>SẢN LƯỢNG DĂM GỖ (MT) NHẬP TRONG NGÀY</b> (Cộng MT các nguồn Nhà máy)");
  res.table1.forEach(function (r) { lines.push("• " + escHtml_(r.donVi) + ": " + fmtNumVN_(r.congMT) + " MT"); });
  lines.push("➡️ Tổng: <b>" + fmtNumVN_(res.table1Total.congMT) + " MT</b>");

  return lines.join("\n");
}

/** Gửi 1 file (PDF...) qua Telegram (sendDocument) - dùng chung với
 * guiTinTelegram_ (gửi text) để mỗi lần báo cáo gửi kèm file đính kèm.
 * `blob` truyền trực tiếp vào payload - UrlFetchApp tự đóng gói thành
 * multipart/form-data khi payload có chứa Blob (không cần tự dựng
 * boundary thủ công). */
function guiTaiLieuTelegram_(blob, chatIdRieng, caption) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = chatIdRieng || p.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error('Chưa cấu hình đủ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID - xem hướng dẫn thiết lập ở mục M đầu file.');
  const url = "https://api.telegram.org/bot" + token + "/sendDocument";
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    payload: { chat_id: chatId, document: blob, caption: (caption || "").slice(0, 1000) },
    muteHttpExceptions: true
  });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) throw new Error("Gửi file Telegram lỗi: " + (json.description || res.getContentText()));
}

/** Dựng trang HTML đơn giản (đủ để convert PDF đẹp mắt) cho báo cáo
 * "Theo mẫu Tonkho_Damgo" từ kết quả getTonkhoDamgoReport() - cùng cấu
 * trúc bảng với trang Báo Cáo trên Web App (NHÀ MÁY/KHO XUẤT HÀNG/ĐỊNH
 * MỨC SX), thêm 2 bảng "nổi bật" Sản lượng gỗ nhập + Sản lượng dăm gỗ
 * MT nhập ở đầu trang. KHÔNG tính lại số liệu - chỉ định dạng. */
function xayHtmlBaoCaoTonKhoDamgo_(res) {
  const e = escHtml_;
  const cell = function (v, pct) { return pct ? fmtPctVN_(v) : fmtNumVN_(v); };
  const mkTable = function (cols, rows, total) {
    let h = "<table><tr><th>Đơn vị</th>" + cols.map(function (c) { return "<th>" + e(c[1]) + "</th>"; }).join("") + "</tr>";
    rows.forEach(function (r) {
      h += "<tr><td>" + e(r.donVi) + "</td>" + cols.map(function (c) { return "<td>" + cell(r[c[0]], c[2]) + "</td>"; }).join("") + "</tr>";
    });
    h += "<tr class=\"tot\"><td>Grand Total</td>" + cols.map(function (c) { return "<td>" + cell(total[c[0]], c[2]) + "</td>"; }).join("") + "</tr>";
    return h + "</table>";
  };

  const t1cols = [["hoaNhonMT","Hòa Nhơn_MT"],["queSonMT","Quế Sơn_MT"],["daiHiepMT","Đại Hiệp_MT"],["hakqnMT","HAKQN_MT"],["congMT","Cộng MT"],
    ["hoaNhonBDMT","Hòa Nhơn_BDMT"],["queSonBDMT","Quế Sơn_BDMT"],["daiHiepBDMT","Đại Hiệp_BDMT"],["hakqnBDMT","HAKQN_BDMT"],["congBDMT","Cộng BDMT"]];
  const t2cols = [["doAmHN","Độ ẩm HN",1],["doAmQS","Độ ẩm QS",1],["doAmDH","Độ ẩm ĐH",1],["doAmQC","Độ ẩm QC",1],["doAm","Độ ẩm TB",1],["doKho","Độ khô TB",1]];
  const t3cols = [["tienSaMT","MT"],["tienSaBDMT","BDMT"],["doAmTienSa","Độ ẩm",1],["doKhoTienSa","Độ khô",1]];
  const t3bcols = [["dungQuatMT","MT"],["dungQuatBDMT","BDMT"],["doAmDungQuat","Độ ẩm",1],["doKhoDungQuat","Độ khô",1]];
  const t4cols = [["tonDauKy","Tồn đầu kỳ"],["tonCK","Tồn CK"],["muonTra","Mượn/trả"],["clDoAm","CL độ ẩm"],["nhapTrongKy","Nhập trong kỳ MT"],["dinhMuc","Định mức",1]];
  const nhapGoCols = [["nhapTrongKy","Nhập trong kỳ MT"]];
  const congMTCols = [["congMT","Cộng MT"]];

  let missingHtml = "";
  if (res.missingUnits && res.missingUnits.length) {
    if (res.mode === "full") {
      const wd = (res.missingUnitsDetail || []).filter(function (d) { return d.usedDate; });
      const nd = (res.missingUnitsDetail || []).filter(function (d) { return !d.usedDate; });
      if (wd.length) missingHtml += '<p class="warn">Lấy tạm số liệu ngày gần nhất: ' + wd.map(function (d) { return e(d.donVi) + " (" + e(d.usedDate) + ")"; }).join(", ") + "</p>";
      if (nd.length) missingHtml += '<p class="warn">Chưa từng có dữ liệu: ' + nd.map(function (d) { return e(d.donVi); }).join(", ") + "</p>";
    } else {
      missingHtml = '<p class="warn">Chưa có dữ liệu, đang hiển thị 0: ' + res.missingUnits.map(e).join(", ") + "</p>";
    }
  }

  return "<html><head><meta charset=\"UTF-8\"><style>" +
    // KHỔ NGANG (landscape) mặc định cho PDF xuất qua Telegram (mục V,
    // v2026.8.17) - bảng "Nhà máy" có tới 10 cột nên khổ dọc hay bị
    // tràn/cắt cột; dịch vụ convert HTML->PDF của Apps Script
    // (Blob.getAs("application/pdf")) đọc @page size giống trình duyệt.
    "@page{size:A4 landscape;margin:10mm}" +
    "body{font-family:Arial,sans-serif;font-size:11px;color:#222} h1{font-size:16px;margin-bottom:4px} h2{font-size:13px;color:#b03a2e;text-transform:uppercase;margin-top:18px}" +
    "table{border-collapse:collapse;width:100%;margin-bottom:6px} th,td{border:1px solid #ccc;padding:4px 6px;text-align:right} th:first-child,td:first-child{text-align:left}" +
    "th{background:#eee} .tot{font-weight:bold;background:#f6f6e8} .warn{background:#fdf1dc;color:#8c511f;padding:6px 8px;border-radius:4px;margin:4px 0}" +
    "</style></head><body>" +
    "<h1>BÁO CÁO TỒN KHO DĂM - HAK GROUP</h1>" +
    "<p>Ngày tồn kho: <b>" + e(res.ngayDisplay) + "</b> - Chế độ: <b>" + (res.mode === "full" ? "Đầy đủ số liệu" : "Theo thực tế") + "</b></p>" +
    missingHtml +
    "<h2>Sản lượng gỗ nhập trong ngày (Nhập trong kỳ, MT)</h2>" + mkTable(nhapGoCols, res.table4, res.table4Total) +
    "<h2>Sản lượng dăm gỗ (MT) nhập trong ngày (Cộng MT)</h2>" + mkTable(congMTCols, res.table1, res.table1Total) +
    "<h2>Nhà máy</h2>" + mkTable(t1cols, res.table1, res.table1Total) +
    mkTable(t2cols, res.table2, res.table2Total) +
    "<h2>Kho xuất hàng - Kho Tiên Sa</h2>" + mkTable(t3cols, res.table3, res.table3Total) +
    "<h2>Kho xuất hàng - Kho Dung Quất</h2>" + mkTable(t3bcols, res.table3b, res.table3bTotal) +
    "<h2>Định mức SX</h2>" + mkTable(t4cols, res.table4, res.table4Total) +
    "</body></html>";
}

/** Convert kết quả getTonkhoDamgoReport() thành 1 file PDF (Blob) -
 * dùng kỹ thuật tạo Blob HTML rồi gọi getAs("application/pdf") (dịch vụ
 * convert có sẵn của Google, không cần thư viện PDF riêng, không cần
 * tạo Google Doc/Sheet tạm rồi export). */
function taoPdfBaoCaoTonKhoDamgo_(res, tenCheDo) {
  const html = xayHtmlBaoCaoTonKhoDamgo_(res);
  const tenFile = "BaoCao_TonkhoDamgo_" + res.ngayISO + "_" + tenCheDo;
  const htmlBlob = Utilities.newBlob(html, "text/html", tenFile + ".html");
  const pdfBlob = htmlBlob.getAs("application/pdf");
  pdfBlob.setName(tenFile + ".pdf");
  return pdfBlob;
}

/** Hàm dùng CHUNG để dựng + gửi báo cáo tồn kho (1 tin nhắn tóm tắt +
 * 2 file PDF đính kèm - "Theo thực tế" VÀ "Đầy đủ số liệu", LUÔN gửi CẢ
 * 2 để người nhận có đủ cả 2 góc nhìn dữ liệu bất kể đang xem chế độ
 * nào) vào Telegram cho ĐÚNG 1 ngày cụ thể - dùng chung cho gửi đột xuất
 * từ nút "Gửi báo cáo Telegram" ở trang Báo Cáo > Theo mẫu Tonkho_Damgo
 * (guiBaoCaoTonkhoDamgoTelegramTuWebApp, mục U). `textMode` chỉ quyết
 * định chế độ của phần TÓM TẮT dạng chữ. */
function guiBaoCaoTonKhoTelegramChoNgay_(ngayISO, textMode) {
  textMode = (textMode === "full") ? "full" : "actual";
  const resText = getTonkhoDamgoReport(ngayISO, textMode);
  guiTinTelegram_(soanNoiDungBaoCaoTonKhoTelegram_(resText));

  const resActual = (textMode === "actual") ? resText : getTonkhoDamgoReport(ngayISO, "actual");
  const resFull = (textMode === "full") ? resText : getTonkhoDamgoReport(ngayISO, "full");
  guiTaiLieuTelegram_(taoPdfBaoCaoTonKhoDamgo_(resActual, "ThucTe"), null, "📄 Báo cáo Tonkho_Damgo - Theo thực tế - " + resActual.ngayDisplay);
  guiTaiLieuTelegram_(taoPdfBaoCaoTonKhoDamgo_(resFull, "DayDuSoLieu"), null, "📄 Báo cáo Tonkho_Damgo - Đầy đủ số liệu - " + resFull.ngayDisplay);
}

/** Gửi ĐỘT XUẤT báo cáo "Theo mẫu Tonkho_Damgo" (mẫu CŨ: 1 tin tóm tắt +
 * 2 PDF) từ nút "📨 Gửi báo cáo Telegram" ở trang Báo Cáo Tổng Hợp >
 * Theo mẫu Tonkho_Damgo (mục U - khôi phục lại theo yêu cầu người dùng,
 * TÁCH BIỆT với guiBaoCaoTelegramTuWebApp() dùng cho ảnh Trang chủ) -
 * cho ĐÚNG ngày + chế độ đang xem trên màn hình. Chỉ Admin được gửi (nút
 * đã ẩn với người dùng thường ở Index.html, nhưng vẫn kiểm tra lại quyền
 * ở đây - không tin riêng vào việc ẩn nút trên giao diện, cùng nguyên
 * tắc với rebuildAllChitietTonKho). */
function guiBaoCaoTonkhoDamgoTelegramTuWebApp(ngayISO, mode) {
  try {
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được gửi báo cáo Telegram." };
    if (!ngayISO) return { success: false, message: "❌ Vui lòng chọn ngày báo cáo trước khi gửi." };
    const textMode = (mode === "full") ? "full" : "actual";
    guiBaoCaoTonKhoTelegramChoNgay_(ngayISO, textMode);
    return { success: true, message: "✅ Đã gửi báo cáo tồn kho ngày " + utils.formatDate(new Date(ngayISO)) + " vào Telegram (1 tin tóm tắt + 2 file PDF: Theo thực tế + Đầy đủ số liệu)." };
  } catch (err) {
    return { success: false, message: "❌ Lỗi gửi Telegram: " + err.toString() };
  }
}

/** Dựng 1 ẢNH PNG (Blob) tóm tắt Trang chủ - THEO YÊU CẦU MỚI (mục T,
 * v2026.8.17): người dùng gửi ảnh chụp Trang chủ thật, yêu cầu ảnh gửi
 * Telegram phải giống layout thật (thẻ KPI bo góc, thẻ từng đơn vị, bảng
 * có dòng Tổng cộng tô màu) - cách làm cũ (mục S, Charts.newTableChart)
 * chỉ dựng được 1 bảng phẳng, không có "thẻ" nhiều màu như giao diện
 * thật. ĐỔI SANG: dựng 1 SLIDE Google Slides TẠM với layout/màu sắc
 * phỏng theo Trang chủ (xem addRect_/addText_/addPill_/addDataTable_ ở
 * dưới), sau đó dùng Slides API (dịch vụ NÂNG CAO - xem hướng dẫn bật ở
 * đầu mục M) lấy ảnh thumbnail PNG của slide đó qua
 * Slides.Presentations.Pages.getThumbnail() - đây là cách CHÍNH THỨC
 * duy nhất để "chụp ảnh" 1 layout tự dựng trong Apps Script (nền tảng
 * không có sẵn dịch vụ html-to-image). File Slides tạm bị XÓA (chuyển
 * vào thùng rác Drive) ngay sau khi lấy xong ảnh trong khối `finally` -
 * không để lại rác trong Drive dù thành công hay lỗi giữa chừng. Nội
 * dung/số liệu vẫn lấy TRỰC TIẾP từ getDashboardStats() (tham số
 * `stats`) - CHỈ định dạng lại, KHÔNG tính lại bất kỳ số liệu nào. */
function taoAnhBaoCaoTrangChu_(stats) {
  const CF = {
    W: 1008, H: 936, M: 40,
    BG: "#FAF6EE", CARD: "#FFFFFF", BORDER: "#E4DFD3",
    ACCENT: "#7A8B5A", ACCENT_DARK: "#55613E", DANGER: "#C0533E",
    TEXT: "#2A2A22", SUB: "#8A8578", ROSE: "#B03A2E",
    HEAD_BG: "#EFEAE0", TOTAL_BG: "#E7EEDD"
  };

  // GHI CHÚ (sửa lỗi thực tế - đã thử 2 CÁCH KHÔNG THÀNH CÔNG trước khi
  // ra cách này, xem lịch sử đầy đủ ở mục T đầu file):
  //  1. Presentation.setPageSize() KHÔNG tồn tại trong SlidesApp.
  //  2. Slides.Presentations.create({pageSize:...}) - CẢ qua dịch vụ
  //     nâng cao LẪN gọi thẳng REST endpoint - đều bị ÂM THẦM BỎ QUA
  //     trường pageSize (xác nhận qua log gỡ lỗi 2 lần liên tiếp, luôn
  //     ra đúng khổ mặc định/16:9 dù request đúng định dạng) - đây là
  //     giới hạn THẬT SỰ của Slides API khi tạo mới (không phải lỗi
  //     code), nhiều nơi đã ghi nhận. Kích thước trang KHÔNG đổi được
  //     sau khi tạo (batchUpdate không hỗ trợ) nên bắt buộc phải có sẵn
  //     ĐÚNG kích thước NGAY LÚC TẠO.
  //  3. CÁCH DUY NHẤT ĐÁNG TIN CẬY: COPY từ 1 file Slides MẪU đã đặt sẵn
  //     đúng kích thước qua GIAO DIỆN Slides thật (không qua API) - copy
  //     file (DriveApp...makeCopy()) giữ NGUYÊN kích thước trang gốc.
  //     Cần người dùng tạo 1 file mẫu 1 LẦN DUY NHẤT (xem hướng dẫn ở
  //     đầu mục M/mục T) và lưu ID vào Script property "TEMPLATE_SLIDE_ID"
  //     qua hàm LUU_TEMPLATE_SLIDE_ID(). Nội dung slide mẫu KHÔNG quan
  //     trọng (hàm này tự xóa hết mọi shape có sẵn trước khi vẽ lại) -
  //     CHỈ kích thước trang là quan trọng.
  const templateId = PropertiesService.getScriptProperties().getProperty("TEMPLATE_SLIDE_ID");
  if (!templateId) throw new Error('Chưa cấu hình TEMPLATE_SLIDE_ID - xem hướng dẫn tạo file Slides mẫu ở đầu mục M/mục T trong Code.gs, rồi chạy LUU_TEMPLATE_SLIDE_ID().');
  const copy = DriveApp.getFileById(templateId).makeCopy("TMP_BaoCaoTrangChu_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss"));
  const pres = SlidesApp.openById(copy.getId());
  Logger.log("[DEBUG mục T] Kích thước trang sau khi copy template: " + pres.getPageWidth() + " x " + pres.getPageHeight() + " (mong muốn: " + CF.W + " x " + CF.H + ")");
  try {
    let slide = pres.getSlides()[0];
    if (!slide) slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    const slideId = slide.getObjectId();
    slide.getShapes().forEach(function (sh) { try { sh.remove(); } catch (e) { /* bỏ qua placeholder không xóa được */ } });

    addRect_(slide, 0, 0, CF.W, CF.H, CF.BG, null);

    // THEO YÊU CẦU MỚI (mục Y, v2026.8.17): khi gửi lại báo cáo cho 1
    // ngày cũ (stats.ngayBaoCaoDisplay có giá trị - xem
    // getDashboardStatsForDate_), đổi dòng phụ đề + nhãn KPI liên quan
    // cho khớp ngữ cảnh "ngày lập báo cáo", thay vì luôn ghi "hôm nay".
    const laNgayTuyChon = !!stats.ngayBaoCaoDisplay;
    const dongPhuDe = laNgayTuyChon
      ? "Báo cáo cho ngày " + stats.ngayBaoCaoDisplay + " · gửi lúc " + Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy")
      : "Trang chủ · " + Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy");
    const nhanChuaBaoCao = laNgayTuyChon ? "ĐƠN VỊ CHƯA BÁO CÁO ĐÚNG NGÀY NÀY" : "ĐƠN VỊ CHƯA BÁO CÁO HÔM NAY";

    addText_(slide, CF.M, 22, CF.W - 2 * CF.M, 34, "📦 BÁO CÁO TỒN KHO DĂM - HAK GROUP", { size: 22, bold: true, color: CF.TEXT });
    addText_(slide, CF.M, 56, CF.W - 2 * CF.M, 20, dongPhuDe, { size: 11, color: CF.SUB });

    // mục AR (v2026.8.18) - THEO YÊU CẦU MỚI: tính TRƯỚC tổng "Cân đối
    // kho xuất hàng" (cộng theo Kho, CÙNG LOGIC dash-candoi-wrap/mục AM)
    // để dùng cho thẻ KPI thay thế "TỔNG LƯỢT NỘP FORM" ngay dưới đây.
    const cdByKhoKpi = { "Kho Tiên Sa": { mt: 0, bdmt: 0 }, "Kho Dung Quất": { mt: 0, bdmt: 0 } };
    (stats.canDoiBDMTList || []).forEach(function (c) {
      if (c.coCanDoi && cdByKhoKpi[c.kho]) {
        cdByKhoKpi[c.kho].mt += Number(c.dieuChinhMT) || 0;
        cdByKhoKpi[c.kho].bdmt += Number(c.dieuChinhBDMT) || 0;
      }
    });
    const tongDieuChinhMT = cdByKhoKpi["Kho Tiên Sa"].mt + cdByKhoKpi["Kho Dung Quất"].mt;
    const tongDieuChinhBDMT = cdByKhoKpi["Kho Tiên Sa"].bdmt + cdByKhoKpi["Kho Dung Quất"].bdmt;

    // Hàng thẻ KPI (giống các thẻ trên cùng của Trang chủ - THÊM thẻ
    // "Tổng lượng gỗ keo nhập trong ngày" theo yêu cầu mới, mục U). Thẻ 1
    // và 2 THÊM dòng "sub" là số BDMT tương ứng (mục AF, v2026.8.18 -
    // BDMT quy đổi theo Độ khô TB Kho Nhà máy cùng ngày/đơn vị). mục AR
    // (v2026.8.18) - THEO YÊU CẦU MỚI: thẻ "TỔNG LƯỢT NỘP FORM" ĐỔI
    // THÀNH "CÂN ĐỐI KHO XUẤT HÀNG" (value=Tổng Điều chỉnh MT, sub=Tổng
    // Điều chỉnh BDMT, NGẮN GỌN - không kèm diễn giải chữ/danh sách chưa
    // cân đối như bản thẻ card cũ ở mục AQ, đã BỎ).
    const kpis = [
      { label: "TỔNG TỒN KHO CUỐI (4 ĐƠN VỊ)", value: fmtNumVN_(stats.tongTonCK) + " MT", sub: fmtNumVN_(stats.tongTonCKBDMT) + " BDMT", color: CF.ACCENT_DARK },
      { label: "TỔNG GỖ KEO NHẬP (NGÀY GẦN NHẤT)", value: fmtNumVN_(stats.tongNhapGo) + " MT", sub: fmtNumVN_(stats.tongNhapGoBDMT) + " BDMT", color: CF.ACCENT_DARK },
      { label: nhanChuaBaoCao, value: stats.soDonViChuaBaoCaoHomNay + " / " + stats.units.length, color: stats.soDonViChuaBaoCaoHomNay > 0 ? CF.DANGER : CF.ACCENT_DARK },
      // THEO YÊU CẦU MỚI (mục W, v2026.8.17): đổi thẻ "Số ngày đã ghi
      // nhận" thành "Số lượng nhà máy vét bãi" (đếm đơn vị có Kiểm kê
      // vét bãi = Có ở bản ghi gần nhất - xem soLuongVetBai).
      { label: "SỐ LƯỢNG NHÀ MÁY VÉT BÃI", value: String(stats.soLuongVetBai) + " / " + stats.units.length, color: stats.soLuongVetBai > 0 ? CF.ROSE : CF.ACCENT_DARK },
      { label: "CÂN ĐỐI KHO XUẤT HÀNG", value: "MT " + fmtNumVN_(tongDieuChinhMT), sub: "BDMT " + fmtNumVN_(tongDieuChinhBDMT), color: CF.ACCENT_DARK }
    ];
    const kpiY = 92, kpiH = 108, kpiGap = 14, kpiW = (CF.W - 2 * CF.M - (kpis.length - 1) * kpiGap) / kpis.length;
    kpis.forEach(function (k, i) {
      const x = CF.M + i * (kpiW + kpiGap);
      addRect_(slide, x, kpiY, kpiW, kpiH, CF.CARD, CF.BORDER);
      addText_(slide, x + 10, kpiY + 10, kpiW - 20, 34, k.label, { size: 8, bold: true, color: CF.SUB });
      addText_(slide, x + 10, kpiY + 46, kpiW - 20, 24, k.value, { size: 15, bold: true, color: k.color });
      if (k.sub) addText_(slide, x + 10, kpiY + 72, kpiW - 20, 24, k.sub, { size: 9.5, bold: false, color: CF.SUB });
    });

    // Dòng "Độ ẩm trung bình" (mục AF, v2026.8.18) - tính theo TRỌNG SỐ
    // khối lượng tồn kho toàn công ty, đặt ngay dưới hàng thẻ KPI. Mục
    // AI (v2026.8.18): THÊM dòng Độ ẩm/Độ khô của tổng lượng gỗ keo
    // nhập hàng ngày (CÙNG CÔNG THỨC BDMT/MT×100%).
    let y = kpiY + kpiH + 8;
    addText_(slide, CF.M, y, CF.W - 2 * CF.M, 18,
      "💧 Độ ẩm trung bình toàn công ty (theo khối lượng tồn kho): " + fmtPctVN_(stats.doAmTrungBinh),
      { size: 10, bold: true, color: CF.ACCENT_DARK });
    y += 18;
    addText_(slide, CF.M, y, CF.W - 2 * CF.M, 18,
      "🪵 Độ ẩm/Độ khô tổng lượng gỗ keo nhập hàng ngày: Độ ẩm " + fmtPctVN_(stats.doAmNhapTB) + " / Độ khô " + fmtPctVN_(stats.doKhoNhapTB),
      { size: 10, bold: true, color: CF.ACCENT_DARK });
    y += 24;

    // Thẻ "Tình trạng theo đơn vị" (giống 4 thẻ đơn vị của Trang chủ).
    // mục AR (v2026.8.18) - THEO YÊU CẦU MỚI: BỎ thẻ riêng "ĐỊNH MỨC
    // TIÊU HAO" (mục AQ) - THÊM 1 dòng "Định mức" vào MỖI thẻ đơn vị ở
    // đây (thay vì 1 khối riêng) - cardH tăng 150->162 + dòng cách nhau
    // 18 (thay vì 20) để vừa 5 dòng trong thẻ mà KHÔNG tăng quá nhiều
    // chiều cao (đã tính lại ngân sách y cho các khối bên dưới).
    addText_(slide, CF.M, y, 400, 20, "TÌNH TRẠNG THEO ĐƠN VỊ", { size: 12, bold: true, color: CF.ROSE });
    y += 26;
    const cardH = 162, cardGap = 16, cardW = (CF.W - 2 * CF.M - 3 * cardGap) / 4;
    stats.units.forEach(function (u, i) {
      const x = CF.M + i * (cardW + cardGap);
      addRect_(slide, x, y, cardW, cardH, CF.CARD, CF.BORDER);
      addText_(slide, x + 12, y + 10, cardW - 24, 20, u.donVi, { size: 12, bold: true, color: CF.TEXT });
      addPill_(slide, x + 12, y + 34, u.daBaoCaoHomNay ? CF.ACCENT : "#E9A24B", u.daBaoCaoHomNay ? "Đã báo cáo hôm nay" : "Chưa báo cáo hôm nay");
      const rows = [
        ["Ngày gần nhất", u.ngayGanNhat || "-"],
        ["Tồn kho cuối", fmtNumVN_(u.tonCK) + " MT"],
        ["Nhập gỗ keo", fmtNumVN_(u.nhapGo) + " MT"],
        ["Độ ẩm", fmtPctVN_(u.doAm)],
        ["Định mức", fmtPctVN_(u.dinhMuc)]
      ];
      let ry = y + 64;
      rows.forEach(function (r) {
        addText_(slide, x + 12, ry, (cardW - 24) / 2, 16, r[0], { size: 8.5, color: CF.SUB });
        addText_(slide, x + 12 + (cardW - 24) / 2, ry, (cardW - 24) / 2, 16, r[1], { size: 9.5, bold: true, color: CF.TEXT, align: "RIGHT" });
        ry += 18;
      });
    });

    // Bảng "Kho Nhà máy"
    y += cardH + 24;
    addText_(slide, CF.M, y, 400, 20, "KHO NHÀ MÁY", { size: 12, bold: true, color: CF.ROSE });
    y += 26;
    const nmCols = [
      ["Đơn vị", "donVi"], ["Hòa Nhơn MT", "hoaNhonMT"], ["Hòa Nhơn BDMT", "hoaNhonBDMT"],
      ["Quế Sơn MT", "queSonMT"], ["Quế Sơn BDMT", "queSonBDMT"],
      ["Đại Hiệp MT", "daiHiepMT"], ["Đại Hiệp BDMT", "daiHiepBDMT"],
      ["HAKQN MT", "hakqnMT"], ["HAKQN BDMT", "hakqnBDMT"],
      ["Cộng MT", "congMT"], ["Cộng BDMT", "congBDMT"]
    ];
    y = addDataTable_(slide, CF, CF.M, y, CF.W - 2 * CF.M, nmCols, stats.units, stats.khoTotal);

    // mục AR (v2026.8.18) - THEO YÊU CẦU MỚI: BỎ khối "Kho xuất hàng"
    // dạng thẻ tóm tắt (mục AQ) - QUAY LẠI bảng CHI TIẾT THEO ĐƠN VỊ
    // (addDataTable_, CÙNG CÁCH "KHO NHÀ MÁY" phía trên) - giống bảng
    // "Kho Xuất Hàng" cũ ở Trang chủ (Index.html, mục dash-xuathang-wrap)
    // mà người dùng gửi ảnh chụp làm mẫu - "Định mức tiêu hao" và "Cân
    // đối kho xuất hàng" KHÔNG còn là khối riêng nữa (đã gộp vào thẻ
    // "Tình trạng theo đơn vị" và thẻ KPI "Cân đối kho xuất hàng" ở
    // trên).
    y += 24;
    addText_(slide, CF.M, y, 400, 20, "KHO XUẤT HÀNG", { size: 12, bold: true, color: CF.ROSE });
    y += 22;
    const xhCols = [
      ["Đơn vị", "donVi"],
      ["Kho Tiên Sa MT", "tienSaMT"], ["Kho Tiên Sa BDMT", "tienSaBDMT"],
      ["Kho Dung Quất MT", "dungQuatMT"], ["Kho Dung Quất BDMT", "dungQuatBDMT"]
    ];
    y = addDataTable_(slide, CF, CF.M, y, CF.W - 2 * CF.M, xhCols, stats.units, stats.khoTotal);

    pres.saveAndClose();

    const thumb = Slides.Presentations.Pages.getThumbnail(pres.getId(), slideId, { "thumbnailProperties.thumbnailSize": "LARGE" });
    Logger.log("[DEBUG mục T] thumb (thumbnail API trả về): " + JSON.stringify(thumb));
    const blob = UrlFetchApp.fetch(thumb.contentUrl).getBlob();
    blob.setName("BaoCao_TrangChu_" + Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd_HHmm") + ".png");
    return blob;
  } finally {
    try { DriveApp.getFileById(pres.getId()).setTrashed(true); } catch (e) { /* bỏ qua nếu không xóa được - không chặn việc gửi ảnh */ }
  }
}

/** Lưu ID file Google Slides MẪU dùng làm khuôn kích thước trang cho
 * taoAnhBaoCaoTrangChu_ (mục T) - xem hướng dẫn tạo file mẫu ở đầu mục
 * M/mục T. `fileId` lấy từ URL file Slides mẫu, đoạn giữa "/d/" và
 * "/edit": https://docs.google.com/presentation/d/ĐOẠN_NÀY/edit */
function LUU_TEMPLATE_SLIDE_ID(fileId) {
  PropertiesService.getScriptProperties().setProperty("TEMPLATE_SLIDE_ID", String(fileId || "").trim());
}

/** Vẽ 1 hình chữ nhật bo góc (dùng làm nền/thẻ/pill) lên slide - helper
 * dùng chung cho taoAnhBaoCaoTrangChu_ (mục T). `borderHex` = null thì
 * bỏ viền (dùng cho nền toàn trang). */
function addRect_(slide, x, y, w, h, fillHex, borderHex) {
  const sh = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, w, h);
  sh.getFill().setSolidFill(fillHex);
  if (borderHex) { sh.getBorder().getLineFill().setSolidFill(borderHex); sh.getBorder().setWeight(1); }
  else { sh.getBorder().setTransparent(); }
  return sh;
}

/** Vẽ 1 khối chữ (không nền/viền) lên slide - helper dùng chung cho
 * taoAnhBaoCaoTrangChu_ (mục T). */
function addText_(slide, x, y, w, h, text, opt) {
  opt = opt || {};
  const sh = slide.insertTextBox(String(text == null ? "" : text), x, y, w, h);
  const tr = sh.getText();
  tr.getTextStyle().setFontFamily("Arial").setFontSize(opt.size || 10).setBold(!!opt.bold).setForegroundColor(opt.color || "#2A2A22");
  if (opt.align === "RIGHT") tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  return sh;
}

/** Vẽ 1 "pill" (nhãn trạng thái bo tròn, nền màu, chữ trắng) - dùng cho
 * trạng thái "Đã báo cáo/Chưa báo cáo" ở từng thẻ đơn vị (mục T). */
function addPill_(slide, x, y, colorHex, text) {
  const w = Math.max(90, 8 + text.length * 5.6), h = 18;
  const sh = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, w, h);
  sh.getFill().setSolidFill(colorHex);
  sh.getBorder().setTransparent();
  const tr = sh.getText();
  tr.setText(text);
  tr.getTextStyle().setFontFamily("Arial").setFontSize(7.5).setBold(true).setForegroundColor("#FFFFFF");
  tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  return sh;
}

/** Dựng 1 bảng dữ liệu (Slides Table) từ danh sách cột [nhãn, tên
 * trường] + units + total - dùng CHUNG cho cả 2 bảng "Kho Nhà máy"/"Kho
 * Xuất Hàng" ở taoAnhBaoCaoTrangChu_ (mục T). Trả về tọa độ Y ngay dưới
 * bảng vừa chèn (để hàm gọi biết chỗ đặt phần tiếp theo). */
function addDataTable_(slide, CF, x, y, w, cols, units, total) {
  const rows = 2 + units.length; // header + N đơn vị + Tổng cộng
  const rowH = 32;
  const table = slide.insertTable(rows, cols.length, x, y, w, rowH * rows);
  try { table.getColumn(0).setWidth(150); } catch (e) { /* bỏ qua nếu không chỉnh được độ rộng */ }

  cols.forEach(function (c, ci) {
    const tr = table.getCell(0, ci).getText();
    table.getCell(0, ci).getFill().setSolidFill(CF.HEAD_BG);
    tr.setText(c[0]);
    tr.getTextStyle().setFontFamily("Arial").setFontSize(9).setBold(true).setForegroundColor(CF.TEXT);
  });

  units.forEach(function (u, ri) {
    cols.forEach(function (c, ci) {
      const cell = table.getCell(ri + 1, ci);
      cell.getFill().setSolidFill(CF.CARD);
      const tr = cell.getText();
      tr.setText(c[1] === "donVi" ? u.donVi : fmtNumVN_(u[c[1]]));
      tr.getTextStyle().setFontFamily("Arial").setFontSize(9).setForegroundColor(CF.TEXT);
      if (c[1] !== "donVi") tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
    });
  });

  const tRow = units.length + 1;
  cols.forEach(function (c, ci) {
    const cell = table.getCell(tRow, ci);
    cell.getFill().setSolidFill(CF.TOTAL_BG);
    const tr = cell.getText();
    tr.setText(c[1] === "donVi" ? "TỔNG CỘNG" : fmtNumVN_(total[c[1]]));
    tr.getTextStyle().setFontFamily("Arial").setFontSize(9).setBold(true).setForegroundColor(CF.TEXT);
    if (c[1] !== "donVi") tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  });

  return y + rowH * rows;
}

/** Xem thử ảnh báo cáo Trang chủ MÀ KHÔNG gửi qua Telegram - dùng để
 * kiểm tra/gỡ lỗi layout (mục T) mà không cần cấu hình Telegram xong,
 * cũng không "làm phiền" nhóm Telegram bằng các lần gửi thử liên tục.
 * Chạy hàm này (chọn ở thanh công cụ Apps Script Editor > Run) rồi mở
 * "Execution log" (Ctrl+Enter) - lưu ảnh vào Google Drive (thư mục gốc
 * "My Drive") và in ra đường link để bấm mở xem trực tiếp. NHỚ tự xóa
 * file ảnh xem thử này trong Drive sau khi kiểm tra xong (hàm chỉ tự
 * xóa file Slides TẠM dùng để dựng ảnh, không tự xóa ảnh xem thử này). */
function XEM_THU_ANH_BAO_CAO_TRANG_CHU() {
  const stats = getDashboardStats();
  const blob = taoAnhBaoCaoTrangChu_(stats);
  const file = DriveApp.createFile(blob);
  Logger.log("Đã lưu ảnh xem thử vào Drive - mở link để xem: " + file.getUrl());
  return file.getUrl();
}

/** Soạn phần chú thích (caption) đi kèm ảnh - gồm các KPI tổng quan
 * giống hàng "thẻ" trên cùng của Trang chủ (Tổng tồn kho cuối, Đơn vị
 * chưa báo cáo hôm nay...) vì bảng ảnh (Charts service) không dựng được
 * kiểu thẻ nhiều màu như giao diện thật (mục S). */
function soanCaptionBaoCaoTrangChu_(stats) {
  // THEO YÊU CẦU MỚI (mục Y, v2026.8.17): xem ghi chú tương ứng ở
  // taoAnhBaoCaoTrangChu_ - gửi lại báo cáo cho 1 ngày cũ thì đổi dòng
  // thời gian + nhãn "chưa báo cáo hôm nay" cho khớp ngữ cảnh.
  const laNgayTuyChon = !!stats.ngayBaoCaoDisplay;
  const lines = [];
  lines.push("📦 BÁO CÁO TỒN KHO DĂM - HAK GROUP (Trang chủ)");
  lines.push(laNgayTuyChon
    ? "🗓 Báo cáo cho ngày " + stats.ngayBaoCaoDisplay + " · gửi lúc " + Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy")
    : "🗓 " + Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy"));
  lines.push("");
  lines.push("📊 Tổng tồn kho cuối (4 đơn vị): " + fmtNumVN_(stats.tongTonCK) + " MT / " + fmtNumVN_(stats.tongTonCKBDMT) + " BDMT");
  lines.push("💧 Độ ẩm trung bình toàn công ty (theo khối lượng tồn kho): " + fmtPctVN_(stats.doAmTrungBinh));
  lines.push("🪵 Tổng gỗ keo nhập (ngày gần nhất mỗi đơn vị): " + fmtNumVN_(stats.tongNhapGo) + " MT / " + fmtNumVN_(stats.tongNhapGoBDMT) + " BDMT (quy đổi theo Độ khô TB Kho Nhà máy cùng ngày)");
  // mục AI (v2026.8.18): THEO YÊU CẦU MỚI - bổ sung Độ ẩm/Độ khô của
  // tổng lượng gỗ keo nhập hàng ngày.
  lines.push("   Độ ẩm " + fmtPctVN_(stats.doAmNhapTB) + " / Độ khô " + fmtPctVN_(stats.doKhoNhapTB));
  // mục AN/AO (v2026.8.18) - THEO YÊU CẦU MỚI: BỎ khối "Định mức tiêu
  // hao" và "Cân đối kho xuất hàng" khỏi CAPTION Telegram (thêm ở mục AM
  // nhưng người dùng thấy caption quá dài, dễ bị Telegram cắt bớt - giới
  // hạn 1024 ký tự ở guiAnhTelegram_) - CHỈ giữ lại "Kho xuất hàng".
  // LÀM RÕ ở mục AO: người dùng CHỈ muốn bỏ 2 khối này khỏi CAPTION (chữ
  // đi kèm ảnh) - ẢNH (taoAnhBaoCaoTrangChu_, KHÔNG bị giới hạn ký tự
  // như caption) đã KHÔI PHỤC LẠI đủ 2 khối này ở mục AO. Trang chủ
  // (Index.html, mục AM) vẫn giữ nguyên đủ 3 khối như từ đầu, không đổi.
  lines.push("🚢 Kho xuất hàng:");
  lines.push("   Kho Tiên Sa: " + fmtNumVN_(stats.khoTotal.tienSaMT) + " MT / " + fmtNumVN_(stats.khoTotal.tienSaBDMT) + " BDMT — " + fmtPctVN_(stats.doKhoTienSaTB));
  lines.push("   Kho Dung Quất: " + fmtNumVN_(stats.khoTotal.dungQuatMT) + " MT / " + fmtNumVN_(stats.khoTotal.dungQuatBDMT) + " BDMT — " + fmtPctVN_(stats.doKhoDungQuatTB));
  // THEO YÊU CẦU MỚI (mục W, v2026.8.17): thay dòng "Số ngày đã ghi
  // nhận" bằng "Số lượng nhà máy vét bãi" + chi tiết từng đơn vị.
  lines.push("🔍 Số lượng nhà máy vét bãi (bản ghi gần nhất): " + stats.soLuongVetBai + "/" + stats.units.length);
  (stats.vetBaiDetail || []).forEach(function (d) {
    lines.push("   • " + d.donVi + " (ngày " + d.ngayGanNhat + "): thời điểm vét bãi " + (d.thoiDiemVetBai || "?") +
      ", KL ước tính còn lại " + fmtNumVN_(d.klUocTinhConLai) + " MT, chênh lệch sau vét bãi " + fmtNumVN_(d.chenhLechVetBai) + " MT");
  });
  lines.push((laNgayTuyChon ? "⚠️ Đơn vị chưa báo cáo đúng ngày này: " : "⚠️ Đơn vị chưa báo cáo hôm nay: ") + stats.soDonViChuaBaoCaoHomNay + "/" + stats.units.length);
  const chua = stats.units.filter(function (u) { return !u.daBaoCaoHomNay; });
  if (chua.length) lines.push("   (" + chua.map(function (u) { return u.donVi; }).join(", ") + ")");
  return lines.join("\n");
}

/** Hàm dùng CHUNG để dựng + gửi báo cáo Trang chủ (1 ẢNH DUY NHẤT) vào
 * Telegram - dùng chung cho cả gửi tự động theo lịch
 * (BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_), gửi thử thủ công
 * (GUI_BAO_CAO_TON_KHO_TELEGRAM_NGAY) lẫn gửi đột xuất từ nút "Gửi báo
 * cáo Telegram" trên Web App (guiBaoCaoTelegramTuWebApp, mục S).
 * `ngayISO` (mục Y, v2026.8.17, THÊM MỚI, TÙY CHỌN): nếu có giá trị,
 * dựng báo cáo cho ĐÚNG ngày đó (dùng getDashboardStatsForDate_) thay
 * vì số liệu mới nhất mặc định - dùng khi Admin cần GỬI LẠI báo cáo của
 * 1 ngày trước đó. Bỏ trống/không truyền = giữ nguyên hành vi gốc (số
 * liệu mới nhất) - lịch tự động 16h và gửi thử KHÔNG truyền tham số này
 * nên KHÔNG bị ảnh hưởng. */
function guiBaoCaoTrangChuTelegram_(chatIdRieng, ngayISO) {
  const stats = ngayISO ? getDashboardStatsForDate_(ngayISO) : getDashboardStats();
  const anh = taoAnhBaoCaoTrangChu_(stats);
  const caption = soanCaptionBaoCaoTrangChu_(stats);
  guiAnhTelegram_(anh, caption, chatIdRieng);
}

/** Hàm CHÍNH được trigger gọi lúc 16h hàng ngày (xem
 * BAT_LICH_BAO_CAO_TON_KHO_TELEGRAM) - tự bỏ qua Chủ nhật ngay từ đầu
 * hàm, vì Apps Script không có sẵn tùy chọn lịch kiểu "hàng ngày trừ 1
 * thứ" - đây là cách đơn giản/chắc chắn nhất để loại trừ đúng 1 ngày
 * trong tuần mà không cần quản lý nhiều trigger riêng lẻ. */
function BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_() {
  const homNay = new Date();
  if (homNay.getDay() === 0) return; // getDay(): 0 = Chủ nhật - KHÔNG gửi
  guiBaoCaoTrangChuTelegram_();
}

/** Gửi thử NGAY (không chờ tới 16h, KHÔNG bị chặn bởi luật "trừ Chủ
 * nhật" vì đây là gửi thử thủ công) - dùng để kiểm tra cấu hình/định
 * dạng ảnh báo cáo trước khi tin vào lịch tự động (bước 6 ở hướng dẫn). */
function GUI_BAO_CAO_TON_KHO_TELEGRAM_NGAY() {
  guiBaoCaoTrangChuTelegram_();
}

/** Gửi ĐỘT XUẤT (ngoài lịch 16h tự động) từ nút "Gửi báo cáo Telegram"
 * trên Web App (Cài đặt > Công cụ Admin, mục S/Y). Chỉ Admin được gửi
 * (nút đã ẩn với người dùng thường ở Index.html, nhưng vẫn kiểm tra lại
 * quyền ở đây - không tin riêng vào việc ẩn nút trên giao diện, cùng
 * nguyên tắc với rebuildAllChitietTonKho).
 * `ngayISO` (mục Y, v2026.8.17, THÊM MỚI, TÙY CHỌN): cho phép Admin
 * CHỌN NGÀY LẬP BÁO CÁO thay vì luôn gửi số liệu mới nhất - ĐÚNG YÊU
 * CẦU MỚI "đôi lúc gửi báo cáo ngày trước đó, không phải ngày hiện
 * tại". Bỏ trống = giữ hành vi gốc (số liệu mới nhất). */
function guiBaoCaoTelegramTuWebApp(ngayISO) {
  try {
    const email = getCurrentUserEmail_();
    if (!utils.isAdmin(email)) return { success: false, message: "❌ Chỉ Admin mới được gửi báo cáo Telegram." };
    guiBaoCaoTrangChuTelegram_(null, ngayISO || null);
    return {
      success: true,
      message: ngayISO ? "✅ Đã gửi ảnh báo cáo cho ngày " + ngayISO + " vào Telegram." : "✅ Đã gửi ảnh báo cáo Trang chủ (số liệu mới nhất) vào Telegram."
    };
  } catch (err) {
    return { success: false, message: "❌ Lỗi gửi Telegram: " + err.toString() };
  }
}

/** Bật lịch gửi báo cáo tự động - CHẠY HÀM NÀY ĐÚNG 1 LẦN (chọn hàm
 * này ở thanh công cụ Apps Script Editor > Run). Tự xóa trigger cũ
 * cùng tên (nếu có) trước khi tạo mới, nên chạy lại nhiều lần KHÔNG bị
 * gửi trùng 2 lần/ngày - CŨNG DÙNG hàm này để chuyển lịch cũ (15h) sang
 * giờ mới (16h, mục S). */
function BAT_LICH_BAO_CAO_TON_KHO_TELEGRAM() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_")
    .timeBased()
    .everyDays(1)
    .atHour(16)
    .nearMinute(0)
    .create();
}

/** Tắt lịch gửi báo cáo tự động (nếu cần tạm dừng, không cần xóa code). */
function TAT_LICH_BAO_CAO_TON_KHO_TELEGRAM() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "BAO_CAO_TON_KHO_TELEGRAM_HANG_NGAY_") ScriptApp.deleteTrigger(t);
  });
}
