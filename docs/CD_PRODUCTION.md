# Hướng dẫn thiết lập CD có phê duyệt – BVĐK khu vực Thới Lai

**Phiên bản chuẩn bị:** 2026-11-04. **Môi trường:** Ubuntu 24.04 / aaPanel / Docker Compose / Next.js + Payload CMS / PostgreSQL 18.

## Cơ chế

`push main` → **BVDK quality gate** (kiểm thử và phát hành image GHCR theo SHA) → workflow **BVDK production deployment** → `production` yêu cầu **Required reviewers** → GitHub SSH qua tài khoản hạn chế `bvdkdeploy` → VPS xác nhận `main`, kiểm tra migration, sao lưu PostgreSQL + Media → chỉ thay app → Health OK / rollback app khi lỗi.

**Không bao giờ dùng:** `docker compose down -v`, `docker volume prune`, `docker compose up` không có service, hoặc thay đổi Postgres 18 sang Postgres 16.

## A. Chuẩn bị tài khoản GitHub – làm trước khi push workflow

1. Mở `https://github.com/LeeAn1707/bvdkthoilai/settings/environments`. Chọn **New environment** và đặt tên **chính xác** `production`.
2. Trong **Deployment protection rules**, bật **Required reviewers**, chọn tài khoản được phép phê duyệt. Nếu bạn là người duy nhất vận hành repository, *không bật* `Prevent self-review`; nếu quy định đơn vị yêu cầu hai người thì bật và chọn người duyệt độc lập. Nếu không có Required reviewers thì không push workflow trước khi xử lý, vì job có thể chạy ngay khi CI xong.
3. Trong **Deployment branches and tags**, chỉ cho phép branch `main` (nếu giao diện hỗ trợ).
4. Trong production **Environment variables**: tạo `VPS_HOST` = **IPv4 công khai thực tế của VPS Vietnix** (không dùng tên miền đi qua Cloudflare) và `VPS_SSH_PORT` = `22` (hoặc cổng SSH thực tế).
5. **Environment secrets** `VPS_SSH_PRIVATE_KEY` và `VPS_SSH_KNOWN_HOSTS` sẽ điền sau Bước B/C.

Tài liệu chính thức: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

## B. Cài phần an toàn trên VPS – CHƯA thay container

**Tải bộ ZIP từ cuộc trò chuyện** và dùng aaPanel File Manager upload nguyên tệp ZIP vào `/root/bvdkthoilai-cd-kit.zip` trên VPS.

Trong aaPanel Terminal (root), thực hiện từng khối:

```bash
cd /opt/bvdkthoilai
unzip -l /root/bvdkthoilai-cd-kit.zip
```

Xác nhận ZIP chỉ gồm `.github/workflows/deploy-production.yml`, `ops/...`, `docs/...` trước khi giải nén:

```bash
cd /opt/bvdkthoilai
unzip -n /root/bvdkthoilai-cd-kit.zip
bash -n ops/*.sh
```

`unzip -n` không ghi đè các file đã có. **Chạy bước cài đặt một lần**, sau khi kiểm tra tên đường dẫn:

```bash
cd /opt/bvdkthoilai
bash ops/setup-cd-vps.sh
```

Kết quả phải có `SETUP_CD_READY`, `Production state: 2fa0e4680cb083bab94835bfed62d92fbc9e584a`. Script này **không khởi động lại Docker**, không sửa PostgreSQL, Media, aaPanel hay Nginx; nó kiểm tra image hiện tại, tạo user `bvdkdeploy` và SSH key riêng, cài forced-command gate và script deploy.

Nếu image VPS đã thay đổi so với `sha256:8d75a9...`, script cố ý dừng để tránh ghi sai mốc rollback. Cần đối chiếu lại trước khi cài.

Kiểm tra nhanh:

```bash
sudo -n -u bvdkdeploy /usr/local/sbin/bvdk-deploy-gate.sh 2>&1 || true
cat /var/lib/bvdk-deploy/current-sha
curl -sS --max-time 15 -o /dev/null -w '%{http_code}\n' https://bvdkthoilai.vn/api/health
```

Dòng đầu phải bị từ chối (DENIED vì không có SSH_ORIGINAL_COMMAND), kiểm tra user chỉ được phép dùng gate.

## C. Tạo 2 environment secrets an toàn

### C1. Secret `VPS_SSH_PRIVATE_KEY`

Trên VPS, có thể xem private key **chỉ để sao chép trực tiếp vào trang GitHub Secret**:

```bash
cat /root/.ssh/bvdk-gha-production-ed25519
```

Trên GitHub → `production` → Environment secrets → **Add secret** → tên `VPS_SSH_PRIVATE_KEY` → dán **toàn bộ** từ `-----BEGIN OPENSSH PRIVATE KEY-----` tới `-----END OPENSSH PRIVATE KEY-----`.

**Tuyệt đối không gửi private key hoặc ảnh chứa key vào ChatGPT, email hay repository.** Không dùng SSH key hiện tại của `root`.

### C2. Secret `VPS_SSH_KNOWN_HOSTS`

Xem public host key *trực tiếp trên VPS*:

```bash
awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

Kết quả có dạng `ssh-ed25519 AAAAC3N...`. Tạo một dòng `known_hosts` **gồm địa chỉ VPS và giá trị này**, ví dụ cổng SSH 22:

```
<IP_VPS> ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...
```

Với cổng SSH khác 22, dùng dạng `[<IP_VPS>]:<PORT> ssh-ed25519 ...`.

Dán dòng này vào **Environment secret** `VPS_SSH_KNOWN_HOSTS` (public host key không phải secret nhưng được lưu ở đây để workflow đồng bộ). **Không dùng `ssh-keyscan` trên GitHub runner như một phép xác thực duy nhất**, vì có nguy cơ MITM.

### C3. Kiểm tra 4 cấu hình GitHub

- Required reviewers: **đã bật** cho `production`.
- Environment variables: `VPS_HOST`, `VPS_SSH_PORT`.
- Environment secrets: `VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`.
- `VPS_HOST` đúng **IP máy chủ SSH**, không phải IP Cloudflare proxy của tên miền.

Nếu aaPanel/SSH có giới hạn IP nguồn, GitHub-hosted runner có IP thay đổi. Không mở thêm cổng hoặc sửa UFW bừa bãi; hãy báo rõ nếu gặp timeout.

## D. Đưa workflow + scripts lên GitHub

Chỉ sau khi hoàn thành A–C và chắc chắn GitHub đã bật Required reviewers:

```bash
cd /opt/bvdkthoilai
git status --short
git add .github/workflows/deploy-production.yml \
  ops/bvdk-deploy-gate.sh ops/bvdk-deploy-ghcr.sh ops/setup-cd-vps.sh \
  docs/CD_PRODUCTION.md
git commit -m "ci: add approved production CD with guarded GHCR deployment"
git -c credential.helper= push origin main
```

Khi hỏi `Username`, nhập `LeeAn1707`; ở `Password`, **dán fine-grained PAT** còn hiệu lực, không phải mật khẩu GitHub. Không dán token vào chat.

Workflow build **BVDK quality gate** chạy trước. Chỉ khi cả TypeScript/regression và Docker build/push GHCR **thành công**, workflow CD mới được kích hoạt. Nếu environment đã có reviewers, job `Deploy approved GHCR image to Vietnix VPS` sẽ ở trạng thái **Waiting**.

## E. Phê duyệt và giám sát

Vào `https://github.com/LeeAn1707/bvdkthoilai/actions` → **BVDK production deployment** → run mới nhất → **Review deployments** → chọn `production` → **Approve and deploy**.

Trên log job tìm `BACKUP_SUCCESS confirmed`, `DEPLOY_SUCCESS` và mã image. Tại VPS kiểm tra:

```bash
cd /opt/bvdkthoilai
docker compose ps
cat /var/lib/bvdk-deploy/current-sha
docker inspect -f '{{.Image}}' bvdkthoilai-app-1
curl -sS --max-time 20 -o /dev/null -w 'HEALTH HTTP %{http_code}\n' https://bvdkthoilai.vn/api/health
```

Sau đó kiểm tra thủ công **trang chủ / Carousel, Chuyên khoa / lưu dữ liệu và upload Media**. Health `200` không đủ để kết luận toàn bộ chức năng thành công.

Nếu job báo `MANUAL_REVIEW_REQUIRED`, đừng ép chạy: thay đổi liên quan migration, mã `prestart` (`scripts/db-migrate.mjs`), collections/globals Payload, package, hoặc Docker cần kế hoạch bảo trì/migration riêng. Nếu mất Health, script **cố gắng rollback chỉ container app**, không tự khôi phục database; nếu migration đã thay đổi schema, rollback app có thể không đủ.

## An toàn, giới hạn và vận hành lâu dài

- Cấu hình hiện thời vẫn dùng Compose tại `/opt/bvdkthoilai`, app image alias `bvdkthoilai-app:latest`; CD chỉ tag image đã kiểm thử rồi chạy `docker compose up -d --no-deps --no-build --force-recreate app`.
- GitHub CD chỉ lấy SHA của **CI thành công trên `main`**. VPS kiểm tra SHA đó còn là `origin/main`, ngăn phê duyệt bản cũ sau một lần push mới.
- VPS yêu cầu backup script trả `BACKUP_SUCCESS`, giữ tag rollback cũ; không tự động prune image/volume.
- Backup tại chỗ không thay thế kiểm tra khôi phục và bản sao ngoại vi. Token Cloudflare R2 đã từng bị lộ cần được xoay vòng và token cũ phải bị thu hồi trước khi tự động hóa upload ngoại vi.
- Mỗi lần triển khai sẽ có downtime ngắn khi Compose thay `app`. Nên phê duyệt ngoài giờ cao điểm và giám sát kết quả.
- Nếu cần **phê duyệt độc lập** theo quy trình bệnh viện, bật Prevent self-review và chọn người duyệt khác.
- GitHub Free/Pro/Team dùng Required reviewers cho **public repository**; điều kiện tài khoản đối với private khác nhau theo tài liệu GitHub. Không dùng môi trường thiếu protection rule.
