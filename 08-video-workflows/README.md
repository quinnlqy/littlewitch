# MiniMax H3 视频生成工作流

这里是本项目实际保存的本地 ComfyUI H3 工作流。它们不是 MiniMax 在线视频 API 的请求配置，也不需要游戏玩家安装。

本包精选 **18 条工作流**，每条保留可拖入 ComfyUI 的完整 UI JSON，以及供 ComfyUI `/prompt` 使用的 `*_api.json`；另提取当前 JSON 内的英文提示词。API JSON 不是单独发给 MiniMax 服务的请求体。

| 目录 | 收录内容 |
| --- | --- |
| `witch_flight_green_v1` | 02 短施法、03 长施法；原 01 持续飞行已有修正版，因此未收录 |
| `witch_flight_green_v2` | 01A 平稳飞行、01B 加速飞行；全程不施法 |
| `witch_monsters_v2_threequarter` | 14 条怪物 V2：朝左 3/4、无脚 Boss、常驻/预兆/攻击动作 |
| `inputs` | 8 张工作流实际引用的角色/怪物参考图，文件名与 LoadImage 节点一致 |

具体文件、采样帧数、尺寸和参考图见 [workflow-index.json](workflow-index.json)。模型与节点清单见 [dependencies.json](dependencies.json) 和 [依赖说明](../DEPENDENCIES.md)。模型权重、整套 ComfyUI 与显卡运行时没有放进本资料包。

复用步骤：

1. 准备支持这些节点与模型的 ComfyUI 环境；原项目记录版本为 0.38.0，Turbo 自定义节点为 1.2.3。具体提交号见 dependencies.json。
2. 将 `inputs` 内文件原名复制到自己的 ComfyUI 输入目录。
3. 将对应模型放入 ComfyUI 的模型目录，在界面中确认加载器能够识别。
4. 拖入中文长文件名的 UI JSON，确认参考图、模型、保存前缀及参数，再手动运行一条。

共同规格为 768×768、24 fps、纯绿背景、固定镜头、静音、Turbo6。主角工作流用 Ref2VA；怪物用 FL2VA，原 PNG 经标准图像节点合成绿底后提供首尾/引导帧。主角 5 秒采样 124 帧、输出裁成 120 帧；长施法 10 秒采样 243 帧、输出 240 帧；怪物为 192 帧的 8 秒片段，以实际 JSON 为准。

工作流保存前缀是相对路径，输出到自己的 ComfyUI 输出目录。输入图、生成视频、当前游戏图集是三个不同环节：游戏直接使用已整理的图集，不会启动 ComfyUI。相同配置也不能保证跨显卡/环境逐像素相同。

14 条怪物视频的原始交付记录存在；这次只整理工作流并做结构检查，没有重新生成或重新验收视频。怪物 `09` 的夜雾横推片段没有单独对应一个游戏图集，游戏中部分效果由程序绘制。
