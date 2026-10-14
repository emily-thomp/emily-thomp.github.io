# Emily's Notes

使用 MkDocs Material 构建的双语笔记站点，收录《氨氧化土法制硝酸》（吴亚义编，1958）8 个章节的中文 OCR 校订稿与英文译文。

站点地址：https://emily-thomp.github.io/

## 本地使用

```shell
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS / Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m mkdocs serve
```

中文首页是 `docs/index.md`，英文首页是 `docs/index.en.md`。章节使用 `docs/book/<chapter>.zh.md` 与 `<chapter>.en.md` 成对维护；导航中的路径省略语言后缀。中文发布到站点根路径，英文发布到 `/en/`，顶部语言菜单保持当前章节。

原扫描页与插图存放在 `docs/assets/`；`source-transcription/` 保留来源哈希、公式和 OCR 校订记录。图内标注保留中文。此版本为校订初稿，尚未逐字终校。

图表提供 SVG 重绘与原书扫描对照。21 张图采用用户提供的 v2 重绘，另含单独提供的氧化炉 SVG；5 张 v2 图有待核图注，已在页面中标明。重绘来源、哈希和待核标注记录在 `source-transcription/figure-redraws.json`。

严格构建检查：

```shell
python -m mkdocs build --strict
```

## GitHub Pages

在仓库 **Settings → Pages** 中将发布来源设为 **GitHub Actions**。

推送到 `main` 后，GitHub Actions 使用仓库自带的临时 `GITHUB_TOKEN` 构建和发布网站。权限仅包括读取源码与发布 Pages，不需要上传 Deploy Key 私钥或个人访问令牌。
