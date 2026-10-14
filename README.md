# Emily's Notes

使用 MkDocs Material 构建的个人笔记站点。

站点地址：https://emily-thomp.github.io/

## 本地使用

```shell
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS / Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m mkdocs serve
```

编辑 `docs/` 中的 Markdown 文件，并在 `mkdocs.yml` 中维护导航。严格构建检查：

```shell
python -m mkdocs build --strict
```

## GitHub Pages

在仓库 **Settings → Pages** 中将发布来源设为 **GitHub Actions**。

推送到 `main` 后，GitHub Actions 使用仓库自带的临时 `GITHUB_TOKEN` 构建和发布网站。权限仅包括读取源码与发布 Pages，不需要上传 Deploy Key 私钥或个人访问令牌。
