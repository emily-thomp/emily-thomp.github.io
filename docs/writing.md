# 写作指南

## 添加文章

在 `docs/` 目录中新建 Markdown 文件，例如 `docs/notes/first-note.md`：

```markdown
# 第一篇笔记

记录今天的学习与思考。
```

然后将文章加入 `mkdocs.yml` 的 `nav`：

```yaml
nav:
  - 首页: index.md
  - 笔记:
      - 第一篇笔记: notes/first-note.md
  - 写作指南: writing.md
```

文章内使用相对路径链接到其他 Markdown 文件。图片可以存放在 `docs/assets/`。

## 常用格式

!!! tip "提示"
    可以使用提示框补充背景信息或突出重点。

支持代码高亮、表格、折叠块与内容标签页。

## 本地预览与发布

```shell
python -m pip install -r requirements.txt
python -m mkdocs serve
```

浏览器访问终端显示的地址即可预览。提交并推送到 `main` 后，GitHub Actions 自动构建并发布到 GitHub Pages。
