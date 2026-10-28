# 依赖与环境

| 用途 | 依赖 | 是否已随包保存 |
| --- | --- | --- |
| 离线游玩 | 支持 Canvas/WebAudio 的浏览器 | 游戏逻辑与素材已内嵌 index.html；浏览器自行准备 |
| 修改后重新构建游戏 | Python 3 标准库 | src、素材和 tools/build.py 均已保存；无需 pip/npm 安装 |
| JavaScript 语法检查 | Node.js 标准模块及可执行的 python | tools/syntax.js 已保存；没有 npm 第三方依赖 |
| 可选绿幕视频清理 | NumPy、SciPy、imageio、imageio-ffmpeg | 清理脚本与 requirements-assets.txt 已保存，软件包未打包 |
| 本地 H3 视频生成 | ComfyUI、H3 模型、Turbo 节点、PyTorch/CUDA 等 | 工作流、参考图、模型/节点/版本清单已保存；大模型与运行时未打包 |

游戏构建与视频生成是独立流程。仅试玩或修改游戏不需要 GPU、ComfyUI 或 H3 模型。

## 游戏源码

`src/shell.html` 是页面结构与样式，`src/game.src.js` 是游戏逻辑，`src/assets.json` 保存内嵌动画/静态资源，`src/art` 与 `src/audio` 保存构建实际引用的图片和音乐。游戏运行时没有额外的前端框架或第三方 JavaScript 包。

在本目录打开终端：

```powershell
python tools/build.py --check
node tools/syntax.js
python tools/build.py
```

最后一步重新写出根目录 index.html。构建脚本和源码保持原工程逻辑；`--check` 会打印一致/不同，请查看结果。图片/音乐在分类目录中用于浏览，在 src 中重复保存一份是为了让原构建脚本按原路径工作。

## 可选视频清理

```powershell
python -m pip install -r requirements-assets.txt
python tools/clean_green_video.py input.mp4 output.mp4
```

原脚本用于绿幕归一化和清除孤立小碎点。两个可选参数为 `--key-warm-effects`、`--retain-body-and-right-puffs`，只应在对应素材上使用。它还会在输出视频旁写出 cleanup.json。不会自动重新生成或注入游戏图集。此脚本保留原算法；本次只做语法检查，未重跑完整视频处理。

## H3 的原环境记录

工作流记录为 ComfyUI **0.38.0**，提交号 `6b747c0428c343e1417219641db93a4fb7cb69ae`；[ComfyUI-MiniMax-H3-Turbo](https://github.com/Larryvrh/ComfyUI-MiniMax-H3-Turbo) **1.2.3**，提交号 `4274783a23afcfdbea3b4876cb79effd6c510785`。注意力选项为 `comfy kitchen attention`，原 ComfyUI requirements 记录 `comfy-kitchen==0.2.36`。这些是原项目本机版本，不是整套环境锁文件，也不保证其他环境可直接运行。

| 模型文件名 | 放置位置 | 用途 |
| --- | --- | --- |
| minimax_h3_ref2va_pruned_int8_convrot.safetensors | ComfyUI/models/diffusion_models | 主角参考图视频 |
| minimax_h3_fl2va_pruned_int8_convrot.safetensors | ComfyUI/models/diffusion_models | 怪物首尾帧视频 |
| qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors | ComfyUI/models/text_encoders | 文本编码 |
| minimax_h3_video_vae_fp16.safetensors | ComfyUI/models/vae | 视频 VAE |
| minimax_h3_turbo_v4_step600_ema.safetensors | ComfyUI/models/loras | Turbo LoRA |

`MiniMaxH3ImageToVideo`、`MiniMaxH3ReferenceToVideo`、`MiniMaxH3AddGuide` 和 `ModelAttentionBackend` 来自原 ComfyUI 内置节点；`MiniMaxH3TurboSampler`、`MiniMaxH3TurboLoRA`、`MiniMaxH3SigmaShift` 来自 Turbo 自定义节点。完整节点类型与工作流原来记录的部分模型链接保存在 [dependencies.json](08-video-workflows/dependencies.json)。

Turbo 节点自身还引用插件目录内的 `h3_silu_temb_grid.safetensors` 辅助文件，安装插件时应保留其完整内容。未将节点插件源码或模型文件复制进本包，原仓库的许可证与安装说明仍适用于它们。PyTorch、CUDA、NVFP4/AWQ 支持需按生成机器环境配置，游戏依赖文件不用于安装 H3 环境。
