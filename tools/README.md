# 构建与可选处理工具

- `build.py`：用根目录 src 重建单文件 index.html；只使用 Python 标准库。
- `syntax.js`：调用 build.py 后用 Node vm 编译游戏脚本；不执行游戏代码。
- `clean_green_video.py`：原项目最终怪物绿幕清理脚本，接受输入/输出视频路径；依赖见根目录 requirements-assets.txt。

历史补丁、临时探针、带接口凭证的生成脚本以及依赖旧本机绝对路径的实验脚本没有收录。
