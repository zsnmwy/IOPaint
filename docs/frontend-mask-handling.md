# IOPaint 前端 Mask 处理机制详解

## 概述

IOPaint 前端使用 Canvas API 来处理用户涂抹的 mask，整个流程包括：用户绘制、mask 生成、发送到后端处理。

## 核心数据结构

### 1. Point（点）
```typescript
export interface Point {
  x: number
  y: number
}
```

### 2. Line（线条）
```typescript
export interface Line {
  size?: number      // 画笔大小
  pts: Point[]       // 点的数组
}
```

### 3. LineGroup（线条组）
```typescript
export type LineGroup = Array<Line>
```

## 状态管理（Zustand Store）

在 `web_app/src/lib/states.ts` 中定义了以下关键状态：

```typescript
interface EditorState {
  // 当前正在绘制的线条组
  curLineGroup: LineGroup
  
  // 已完成的线条组历史
  lineGroups: LineGroup[]
  
  // 上一次的线条组（用于重复执行）
  lastLineGroup: LineGroup
  
  // 额外的 mask 图像（来自交互式分割等插件）
  extraMasks: HTMLImageElement[]
  
  // 上一次的额外 mask
  prevExtraMasks: HTMLImageElement[]
  
  // 临时 mask（用于预览）
  temporaryMasks: HTMLImageElement[]
  
  // 画笔基础大小
  baseBrushSize: number
  
  // 画笔缩放比例
  brushSizeScale: number
  
  // 渲染结果历史
  renders: HTMLImageElement[]
}
```

## 用户交互流程

### 1. 鼠标按下（onMouseDown）

**位置**: `web_app/src/components/Editor.tsx:456-485`

```typescript
const onMouseDown = (ev: SyntheticEvent) => {
  // 各种状态检查...
  
  setIsDraging(true)
  handleCanvasMouseDown(mouseXY(ev))  // 调用状态管理中的方法
}
```

**状态处理**: `web_app/src/lib/states.ts:631-641`

```typescript
handleCanvasMouseDown: (point: Point) => {
  let lineGroup: LineGroup = []
  const state = get()
  
  // 如果是手动模式，保留当前的线条组
  if (state.runMannually()) {
    lineGroup = [...state.editorState.curLineGroup]
  }
  
  // 添加新的线条，初始只有一个点
  lineGroup.push({ 
    size: state.getBrushSize(),  // 当前画笔大小
    pts: [point]                  // 起始点
  })
  
  // 更新状态
  set((state) => {
    state.editorState.curLineGroup = lineGroup
  })
}
```

### 2. 鼠标移动（onMouseDrag）

**位置**: `web_app/src/components/Editor.tsx:360-379`

```typescript
const onMouseDrag = (ev: SyntheticEvent) => {
  // 各种状态检查...
  
  if (!isDraging) return
  if (curLineGroup.length === 0) return
  
  handleCanvasMouseMove(mouseXY(ev))  // 添加新的点
}
```

**状态处理**: `web_app/src/lib/states.ts:643-650`

```typescript
handleCanvasMouseMove: (point: Point) => {
  set((state) => {
    const curLineGroup = state.editorState.curLineGroup
    if (curLineGroup.length) {
      // 将新点添加到当前线条的最后
      curLineGroup[curLineGroup.length - 1].pts.push(point)
    }
  })
}
```

### 3. 鼠标释放（onPointerUp）

**位置**: `web_app/src/components/Editor.tsx:407-440`

```typescript
const onPointerUp = (ev: SyntheticEvent) => {
  // 各种状态检查...
  
  if (runMannually) {
    // 手动模式：只停止拖拽，不执行 inpainting
    setIsDraging(false)
  } else {
    // 自动模式：立即执行 inpainting
    runInpainting()
  }
}
```

## Canvas 绘制

### 实时绘制到 Canvas

**位置**: `web_app/src/components/Editor.tsx:167-208`

```typescript
useEffect(() => {
  if (!context || !isOriginalLoaded) return
  
  // 设置 canvas 尺寸
  context.canvas.width = imageWidth
  context.canvas.height = imageHeight
  
  // 清空 canvas
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  
  // 绘制临时 mask
  temporaryMasks.forEach((maskImage) => {
    context.drawImage(maskImage, 0, 0, imageWidth, imageHeight)
  })
  
  // 绘制额外的 mask（来自插件）
  extraMasks.forEach((maskImage) => {
    context.drawImage(maskImage, 0, 0, imageWidth, imageHeight)
  })
  
  // 绘制当前正在画的线条
  drawLines(context, curLineGroup)
}, [temporaryMasks, extraMasks, curLineGroup, ...])
```

### drawLines 函数

**位置**: `web_app/src/lib/utils.ts:197-216`

```typescript
export function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: LineGroup,
  color = BRUSH_COLOR  // 默认白色 "rgba(255, 255, 255, 0.7)"
) {
  ctx.strokeStyle = color
  ctx.lineCap = "round"      // 圆形端点
  ctx.lineJoin = "round"     // 圆形连接
  
  lines.forEach((line) => {
    if (!line?.pts.length || !line.size) return
    
    ctx.lineWidth = line.size  // 设置线条宽度
    ctx.beginPath()
    ctx.moveTo(line.pts[0].x, line.pts[0].y)  // 移动到起点
    
    // 连接所有点
    line.pts.forEach((pt) => ctx.lineTo(pt.x, pt.y))
    
    ctx.stroke()  // 绘制
  })
}
```

## Mask 生成

### generateMask 函数

**位置**: `web_app/src/lib/utils.ts:218-242`

```typescript
export const generateMask = (
  imageWidth: number,
  imageHeight: number,
  lineGroups: LineGroup[],           // 线条组数组
  maskImages: HTMLImageElement[] = [], // 额外的 mask 图像
  lineGroupsColor: string = "white"   // 线条颜色
): HTMLCanvasElement => {
  // 创建新的 canvas 作为 mask
  const maskCanvas = document.createElement("canvas")
  maskCanvas.width = imageWidth
  maskCanvas.height = imageHeight
  
  const ctx = maskCanvas.getContext("2d")
  if (!ctx) {
    throw new Error("could not retrieve mask canvas")
  }
  
  // 1. 先绘制额外的 mask 图像（如交互式分割的结果）
  maskImages.forEach((maskImage) => {
    ctx.drawImage(maskImage, 0, 0, imageWidth, imageHeight)
  })
  
  // 2. 再绘制用户涂抹的线条
  lineGroups.forEach((lineGroup) => {
    drawLines(ctx, lineGroup, lineGroupsColor)
  })
  
  return maskCanvas
}
```

## 发送到后端

### runInpainting 流程

**位置**: `web_app/src/lib/states.ts:440-560`

```typescript
runInpainting: async () => {
  const { curLineGroup, extraMasks, lastLineGroup, prevExtraMasks } = get().editorState
  
  // 决定使用当前 mask 还是上一次的 mask
  const useLastLineGroup = 
    curLineGroup.length === 0 && 
    extraMasks.length === 0 && 
    !settings.showExtender
  
  let maskLineGroup: LineGroup = []
  let maskImages: HTMLImageElement[] = []
  
  if (useLastLineGroup) {
    // 使用上一次的 mask（重复执行）
    maskLineGroup = lastLineGroup
    maskImages = prevExtraMasks
  } else {
    // 使用当前的 mask
    maskLineGroup = curLineGroup
    maskImages = extraMasks
  }
  
  // 生成 mask canvas
  const maskCanvas = generateMask(
    imageWidth,
    imageHeight,
    [maskLineGroup],      // 当前线条组
    maskImages,           // 额外的 mask 图像
    BRUSH_COLOR           // 白色
  )
  
  // 转换为 Blob
  const maskBlob = dataURItoBlob(maskCanvas.toDataURL())
  
  // 调用 API
  const res = await inpaint(
    targetFile,
    settings,
    cropperState,
    extenderState,
    maskBlob,            // mask 作为 Blob 传递
    paintByExampleFile
  )
  
  // 处理结果...
  const newRender = new Image()
  await loadImage(newRender, res.blob)
  
  // 更新状态
  get().updateEditorState({
    renders: [...renders, newRender],
    lineGroups: [...lineGroups, maskLineGroup],
    lastLineGroup: maskLineGroup,
    curLineGroup: [],        // 清空当前线条组
    extraMasks: [],          // 清空额外 mask
    prevExtraMasks: maskImages,
  })
}
```

### API 调用

**位置**: `web_app/src/lib/api.ts:28-103`

```typescript
export default async function inpaint(
  imageFile: File,
  settings: Settings,
  croperRect: Rect,
  extenderState: Rect,
  mask: File | Blob,  // mask 作为 Blob 传入
  paintByExampleImage: File | null = null
) {
  // 转换为 Base64
  const imageBase64 = await convertToBase64(imageFile)
  const maskBase64 = await convertToBase64(mask)
  
  // 发送 POST 请求
  const res = await fetch(`${API_ENDPOINT}/inpaint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: imageBase64,    // 原图的 Base64
      mask: maskBase64,      // mask 的 Base64
      // ... 其他参数
    }),
  })
  
  if (res.ok) {
    const blob = await res.blob()
    return {
      blob: URL.createObjectURL(blob),
      seed: res.headers.get("X-Seed"),
    }
  }
  throw await throwErrors(res)
}
```

## 工作模式

### 1. 自动模式（Auto Mode）
- 用户松开鼠标后立即执行 inpainting
- `runMannually() === false`

### 2. 手动模式（Manual Mode）
- 用户可以绘制多条线
- 需要手动点击"Run"按钮执行 inpainting
- `runMannually() === true`

## Undo/Redo 机制

### Undo
```typescript
undo: () => {
  if (get().runMannually() && get().editorState.curLineGroup.length !== 0) {
    // 手动模式：撤销最后一条线
    const lastLine = editorState.curLineGroup.pop()
    editorState.redoCurLines.push(lastLine)
  } else {
    // 撤销整个渲染结果
    const lastRender = editorState.renders.pop()
    editorState.redoRenders.push(lastRender)
    
    const lastLineGroup = editorState.lineGroups.pop()
    editorState.redoLineGroups.push(lastLineGroup)
    
    editorState.curLineGroup = []
  }
}
```

## 总结

IOPaint 前端的 mask 处理流程：

1. **用户绘制**: 鼠标事件 → 更新 `curLineGroup` → 实时绘制到 Canvas
2. **Mask 生成**: 将 `LineGroup` 和额外的 mask 图像绘制到新的 Canvas
3. **发送后端**: Canvas → Base64 → JSON → POST 请求
4. **结果处理**: 接收新图像 → 更新历史 → 清空当前 mask

整个过程使用 Canvas API 进行高效的图形绘制，使用 Zustand 进行状态管理，支持 Undo/Redo 和多种工作模式。

