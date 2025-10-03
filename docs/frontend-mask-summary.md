# IOPaint 前端 Mask 处理机制 - 快速总结

## 核心概念

### 数据结构
```
Point (点) → Line (线条) → LineGroup (线条组) → EditorState (状态)
  ↓            ↓              ↓                    ↓
{x, y}    {size, pts[]}   Line[]           curLineGroup, lineGroups...
```

### 关键文件
- **状态管理**: `web_app/src/lib/states.ts` - Zustand store
- **编辑器组件**: `web_app/src/components/Editor.tsx` - 主编辑器
- **工具函数**: `web_app/src/lib/utils.ts` - drawLines, generateMask
- **API 调用**: `web_app/src/lib/api.ts` - inpaint 函数

## 工作流程（5步）

### 1. 用户绘制
```
鼠标按下 → 创建新 Line → 添加到 curLineGroup
鼠标移动 → 添加 Point 到 Line.pts[]
鼠标释放 → 触发处理（自动/手动模式）
```

### 2. 实时显示
```typescript
// Editor.tsx useEffect
context.clearRect(...)
extraMasks.forEach(mask => context.drawImage(mask, ...))
drawLines(context, curLineGroup)  // 实时绘制用户涂抹
```

### 3. 生成 Mask
```typescript
// utils.ts generateMask
const maskCanvas = document.createElement("canvas")
maskCanvas.width = imageWidth
maskCanvas.height = imageHeight

// 1. 绘制额外的 mask（插件生成）
maskImages.forEach(img => ctx.drawImage(img, ...))

// 2. 绘制用户涂抹的线条
lineGroups.forEach(lineGroup => drawLines(ctx, lineGroup, "white"))

return maskCanvas
```

### 4. 转换格式
```
Canvas → toDataURL() → Base64 → Blob → API
```

### 5. 发送后端
```typescript
// api.ts inpaint
const maskBase64 = await convertToBase64(mask)
fetch('/api/v1/inpaint', {
  method: 'POST',
  body: JSON.stringify({
    image: imageBase64,
    mask: maskBase64,
    // ... 其他参数
  })
})
```

## 状态管理

### 核心状态
```typescript
EditorState {
  curLineGroup: LineGroup        // 当前正在画的
  lineGroups: LineGroup[]        // 历史记录
  lastLineGroup: LineGroup       // 上一次的（用于重复）
  extraMasks: HTMLImageElement[] // 插件生成的 mask
  renders: HTMLImageElement[]    // 渲染结果历史
}
```

### 状态转换
```
用户涂抹 → curLineGroup (当前)
    ↓
执行 inpainting
    ↓
curLineGroup → lastLineGroup (保存)
curLineGroup → [] (清空)
extraMasks → prevExtraMasks (保存)
extraMasks → [] (清空)
新结果 → renders (追加)
```

## 两种工作模式

### 自动模式 (Auto)
- 鼠标释放后立即执行 inpainting
- 适合快速修复

### 手动模式 (Manual)
- 可以绘制多条线
- 点击 "Run" 按钮执行
- 支持 Undo/Redo 单条线

## Canvas 绘制技术

### drawLines 实现
```typescript
ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"  // 半透明白色
ctx.lineCap = "round"      // 圆形端点
ctx.lineJoin = "round"     // 圆形连接

lines.forEach(line => {
  ctx.lineWidth = line.size
  ctx.beginPath()
  ctx.moveTo(line.pts[0].x, line.pts[0].y)
  line.pts.forEach(pt => ctx.lineTo(pt.x, pt.y))
  ctx.stroke()
})
```

### 为什么使用白色？
- Mask 是二值图像：白色 = 需要修复的区域，黑色 = 保留的区域
- 后端会将白色区域识别为需要 inpainting 的部分

## Undo/Redo 机制

### Undo 逻辑
```
手动模式 + curLineGroup 有内容:
  → 撤销最后一条线 (curLineGroup.pop())

其他情况:
  → 撤销整个渲染结果 (renders.pop())
  → 同时撤销对应的 lineGroup
```

### Redo 逻辑
```
从 redoCurLines 或 redoRenders 恢复
```

## 额外的 Mask 来源

### extraMasks
来自插件生成的 mask，例如：
- **InteractiveSeg**: 交互式分割（SAM）
- **RemoveBG**: 背景移除
- **AnimeSeg**: 动漫分割

### 合并策略
```
最终 Mask = extraMasks (插件) + curLineGroup (用户涂抹)
```

## 性能优化

### 1. 增量绘制
- 只在状态变化时重绘 Canvas
- 使用 React useEffect 依赖追踪

### 2. 状态不可变性
- 使用 Immer 进行不可变更新
- Zustand + Immer 中间件

### 3. 懒加载
- 图像按需加载
- 使用 URL.createObjectURL

## 关键 API

### 前端 → 后端
```
POST /api/v1/inpaint
Content-Type: application/json

{
  "image": "data:image/png;base64,...",
  "mask": "data:image/png;base64,...",
  "prompt": "...",
  "sd_steps": 20,
  // ... 其他参数
}
```

### 后端 → 前端
```
Response:
  Body: 处理后的图像 (Blob)
  Headers:
    X-Seed: 随机种子值
```

## 调试技巧

### 1. 查看 Mask
```typescript
// 在浏览器控制台
const maskCanvas = generateMask(...)
document.body.appendChild(maskCanvas)
```

### 2. 查看状态
```typescript
// Zustand DevTools
window.__ZUSTAND_STATE__
```

### 3. 查看网络请求
```
浏览器 DevTools → Network → 查看 /inpaint 请求
→ Preview 可以看到 Base64 图像
```

## 常见问题

### Q: 为什么 mask 是白色的？
A: 白色表示需要修复的区域，这是图像修复的标准约定。

### Q: 如何支持橡皮擦？
A: 可以用黑色绘制来"擦除"白色 mask，但当前实现使用 Undo 代替。

### Q: 多个 mask 如何合并？
A: 在 Canvas 上依次绘制，后绘制的会覆盖先绘制的（使用默认的 source-over 混合模式）。

### Q: 如何提高绘制性能？
A: 
- 减少点的数量（鼠标移动时采样）
- 使用 requestAnimationFrame
- 考虑使用 OffscreenCanvas

## 扩展点

### 1. 添加新的画笔形状
修改 `drawLines` 函数，使用不同的 `lineCap` 和 `lineJoin`。

### 2. 添加画笔预设
在状态中添加 `brushPresets` 数组，包含不同的 size 和 opacity。

### 3. 支持图层
扩展 `EditorState`，添加 `layers` 数组，每层有独立的 `lineGroups`。

### 4. 添加滤镜
在 `generateMask` 后应用 Canvas 滤镜（如模糊、膨胀、腐蚀）。

## 总结

IOPaint 的 mask 处理机制：
- ✅ 基于 Canvas API 的高效绘制
- ✅ 使用 Zustand 的响应式状态管理
- ✅ 支持 Undo/Redo 和历史记录
- ✅ 灵活的插件系统（extraMasks）
- ✅ 自动/手动两种工作模式
- ✅ Base64 编码的简单 API 交互

核心思想：**将用户的涂抹操作转换为白色 mask 图像，发送给后端进行 AI 修复。**

