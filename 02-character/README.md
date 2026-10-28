# 主角

- `concept/`：精选的角色多视图设定和骑扫帚构思稿；它们是造型探索资料，与最终菜单立绘画风有差异。
- `illustrations/`：当前工程使用的标题/失败透明立绘。
- `source-images/`：上述立绘保留的原图，便于重新抠图。
- `animations/`：从当前内嵌资源直接导出的 6 张 PNG 图集；manifest 保存实际帧矩形和身体锚点。坐标为每帧局部像素坐标，角色朝右。

`flight` 为巡航，`move` 为移动，`attack` 是射击动作源表，`long` 是长施法动作源表，`boostStart` / `boostLoop` 为加速起手/循环。实际状态的片段范围见 manifest 的 clips。GIF 按整张图集演示；巡航/移动使用往返展示，其余整段重复。攻击与长施法演示不等同于游戏的状态切换。

播放片段的结束帧按图集最后一帧取最小值，与源工程 heroFrameIndex 一致；manifest 同时保留原始 to 和计算后的 effective_to，方便复用。
