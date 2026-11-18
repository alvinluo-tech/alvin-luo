# travel-upload

旅行照片手机直传的 Cloudflare Worker。站点侧页面在 `app/upload`。

## 端点

| 方法 | 路径 | 鉴权 | 说明 |
|:--|:--|:--|:--|
| GET | `/health` | 无 | 部署自检 |
| GET | `/manifest` | 无 | 聚合 `travel/_meta/*.json`，构建时同步用 |
| POST | `/upload` | Bearer | multipart：`file` `trip` `takenAt` `w` `h` `cover` `caption` |
| POST | `/publish` | Bearer | 触发 GitHub Actions `workflow_dispatch` |
| GET | `/status` | Bearer | 最近一次构建状态 |

上传成功会写两个对象：

```
travel/08-20261118-ab12.webp         照片本体（一年 immutable 缓存）
travel/_meta/08-20261118-ab12.json   元数据 sidecar（key/trip/takenAt/cover…）
```

GPS 只在手机端用于归站，Worker 不接收、不存储。

## 首次部署

```bash
cd workers/travel-upload
npm install                 # 只装 wrangler
npx wrangler login          # 浏览器授权（只能你本人点）
npx wrangler deploy
```

部署后设置两个密钥：

```bash
npx wrangler secret put UPLOAD_TOKEN   # 手机上传页用，建议 openssl rand -hex 32
npx wrangler secret put GITHUB_TOKEN   # fine-grained PAT，仅 actions:write
```

`GITHUB_TOKEN` 可选：不配也能上传，只是「发布」按钮会返回 501。

## 本地调试

```bash
cp .dev.vars.example .dev.vars
npx wrangler dev            # 默认 http://127.0.0.1:8787
```

`.dev.vars` 已在 gitignore 里，不要提交。

## 自检

```bash
curl https://upload.alvin-luo.me/health
curl https://upload.alvin-luo.me/manifest
curl -X POST https://upload.alvin-luo.me/publish \
  -H "Authorization: Bearer $UPLOAD_TOKEN"
```

## 构建怎么拿到 manifest

`.github/workflows/deploy.yml` 里在 Build 之前跑：

```bash
node scripts/gen-trip-photos.mjs --remote "$PHOTO_MANIFEST_URL"
```

仓库变量 `PHOTO_MANIFEST_URL` 填 `https://upload.alvin-luo.me/manifest`。
拉取失败时脚本会保留上一次生成的文件并 exit 0，不会打断构建。
