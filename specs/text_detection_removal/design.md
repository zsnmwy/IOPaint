# 技术方案设计 - 文字识别与移除功能

## 1. 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ TextDetection│  │ TextRegion   │  │ TextRegion   │      │
│  │   Button     │  │   Component  │  │   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  Zustand Store │                        │
│                    │  (textRegions) │                        │
│                    └───────┬────────┘                        │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │   API Client   │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────┐
│                      后端 (FastAPI)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /detect_text │  │  OCRPlugin   │  │  EasyOCR     │      │
│  │   Endpoint   │──│              │──│   Engine     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐                                           │
│  │  /inpaint    │  (现有接口，用于文字移除)                  │
│  │   Endpoint   │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
用户点击"检测文字" 
    → 前端调用 POST /api/v1/detect_text
    → 后端使用 EasyOCR 识别文字
    → 返回文字区域数据
    → 前端渲染矩形框
    → 用户调整矩形框
    → 用户点击"移除文字"
    → 前端生成 mask
    → 调用现有 POST /api/v1/inpaint
    → 返回处理后的图片
```

## 2. 技术栈

### 2.1 后端技术栈

- **框架**: FastAPI
- **OCR 引擎**: EasyOCR
- **图像处理**: OpenCV, NumPy, PIL
- **依赖管理**: pip (requirements.txt)

### 2.2 前端技术栈

- **框架**: React 18 + TypeScript
- **状态管理**: Zustand + Immer
- **UI 组件**: Radix UI
- **样式**: Tailwind CSS
- **拖动交互**: 自定义实现（参考 Cropper.tsx）

## 3. 后端设计

### 3.1 OCR 插件设计

**文件位置**: `iopaint/plugins/ocr_plugin.py`

```python
class OCRPlugin(BasePlugin):
    name = "OCR"
    support_gen_mask = False  # 不生成 mask，只返回文字区域
    
    def __init__(self, device="cpu", languages=['ch_sim', 'en']):
        super().__init__()
        self.device = device
        self.reader = easyocr.Reader(languages, gpu=(device != "cpu"))
    
    def detect_text(self, rgb_np_img) -> List[TextRegion]:
        """
        检测图片中的文字区域
        返回: [
            {
                "id": "uuid",
                "bbox": {"x": 100, "y": 200, "width": 150, "height": 50},
                "text": "识别到的文字",
                "confidence": 0.95
            }
        ]
        """
        results = self.reader.readtext(rgb_np_img)
        text_regions = []
        for idx, (bbox, text, confidence) in enumerate(results):
            # bbox 是 4 个点的坐标 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            x_coords = [point[0] for point in bbox]
            y_coords = [point[1] for point in bbox]
            x = int(min(x_coords))
            y = int(min(y_coords))
            width = int(max(x_coords) - x)
            height = int(max(y_coords) - y)
            
            text_regions.append({
                "id": str(uuid.uuid4()),
                "bbox": {"x": x, "y": y, "width": width, "height": height},
                "text": text,
                "confidence": float(confidence)
            })
        return text_regions
```

### 3.2 API 接口设计

**文件位置**: `iopaint/api.py`

#### 3.2.1 检测文字接口

```python
# Schema 定义 (iopaint/schema.py)
class DetectTextRequest(BaseModel):
    image: str  # Base64 编码的图片
    languages: List[str] = ['ch_sim', 'en']  # 支持的语言

class TextRegionBBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class TextRegion(BaseModel):
    id: str
    bbox: TextRegionBBox
    text: str
    confidence: float

class DetectTextResponse(BaseModel):
    text_regions: List[TextRegion]

# API 实现
@router.post("/detect_text")
async def api_detect_text(req: DetectTextRequest):
    """
    检测图片中的文字区域
    """
    try:
        # 解码图片
        image, _, _, _ = decode_base64_to_image(req.image)
        
        # 调用 OCR 插件
        if "OCR" not in self.plugins:
            raise HTTPException(400, "OCR plugin not enabled")
        
        ocr_plugin = self.plugins["OCR"]
        text_regions = ocr_plugin.detect_text(image)
        
        return DetectTextResponse(text_regions=text_regions)
    except Exception as e:
        logger.error(f"Text detection error: {e}")
        raise HTTPException(500, str(e))
```

### 3.3 依赖配置

**文件位置**: `requirements.txt`

```
# 添加以下依赖
easyocr>=1.7.0
```

### 3.4 插件初始化

**文件位置**: `iopaint/plugins/__init__.py`

```python
from iopaint.plugins.ocr_plugin import OCRPlugin

def build_plugins(
    enable_ocr: bool = False,
    ocr_device: str = "cpu",
    # ... 其他参数
):
    plugins = {}
    
    if enable_ocr:
        logger.info(f"Initialize OCRPlugin on {ocr_device}")
        plugins[OCRPlugin.name] = OCRPlugin(device=ocr_device)
    
    # ... 其他插件
    
    return plugins
```

## 4. 前端设计

### 4.1 数据结构

**文件位置**: `web_app/src/lib/types.ts`

```typescript
export interface TextRegionBBox {
  x: number
  y: number
  width: number
  height: number
}

export interface TextRegion {
  id: string
  bbox: TextRegionBBox
  text: string
  confidence: number
}

export interface TextDetectionState {
  isDetecting: boolean
  detectedRegions: TextRegion[]
  selectedRegionId: string | null
  isTextDetectionMode: boolean
}
```

### 4.2 状态管理

**文件位置**: `web_app/src/lib/states.ts`

```typescript
interface AppState {
  // ... 现有状态
  
  textDetectionState: TextDetectionState
  
  // Actions
  detectText: () => Promise<void>
  updateTextRegion: (id: string, bbox: Partial<TextRegionBBox>) => void
  deleteTextRegion: (id: string) => void
  addTextRegion: () => void
  clearTextRegions: () => void
  selectTextRegion: (id: string | null) => void
  generateTextMask: () => HTMLCanvasElement
  removeText: () => Promise<void>
}

// 实现
const useStore = create<AppState>()(
  immer((set, get) => ({
    textDetectionState: {
      isDetecting: false,
      detectedRegions: [],
      selectedRegionId: null,
      isTextDetectionMode: false,
    },
    
    detectText: async () => {
      set((state) => {
        state.textDetectionState.isDetecting = true
      })
      
      try {
        const file = await get().getCurrentTargetFile()
        const imageBase64 = await convertToBase64(file)
        
        const res = await fetch(`${API_ENDPOINT}/detect_text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageBase64 }),
        })
        
        const data = await res.json()
        
        set((state) => {
          state.textDetectionState.detectedRegions = data.text_regions
          state.textDetectionState.isTextDetectionMode = true
        })
      } catch (e) {
        toast({ variant: "destructive", description: e.message })
      } finally {
        set((state) => {
          state.textDetectionState.isDetecting = false
        })
      }
    },
    
    updateTextRegion: (id, bbox) => {
      set((state) => {
        const region = state.textDetectionState.detectedRegions.find(r => r.id === id)
        if (region) {
          Object.assign(region.bbox, bbox)
        }
      })
    },
    
    deleteTextRegion: (id) => {
      set((state) => {
        state.textDetectionState.detectedRegions = 
          state.textDetectionState.detectedRegions.filter(r => r.id !== id)
      })
    },
    
    generateTextMask: () => {
      const { imageWidth, imageHeight, textDetectionState } = get()
      const maskCanvas = document.createElement("canvas")
      maskCanvas.width = imageWidth
      maskCanvas.height = imageHeight
      const ctx = maskCanvas.getContext("2d")!
      
      ctx.fillStyle = "white"
      textDetectionState.detectedRegions.forEach(region => {
        const { x, y, width, height } = region.bbox
        ctx.fillRect(x, y, width, height)
      })
      
      return maskCanvas
    },
    
    removeText: async () => {
      const maskCanvas = get().generateTextMask()
      const maskBlob = dataURItoBlob(maskCanvas.toDataURL())
      
      // 调用现有的 inpainting API
      await get().runInpainting()
      
      // 清空文字区域
      get().clearTextRegions()
    },
  }))
)
```

### 4.3 UI 组件设计

#### 4.3.1 TextDetection 按钮组件

**文件位置**: `web_app/src/components/TextDetection.tsx`

```typescript
export const TextDetectionButton = () => {
  const [isDetecting, detectText, isTextDetectionMode] = useStore(state => [
    state.textDetectionState.isDetecting,
    state.detectText,
    state.textDetectionState.isTextDetectionMode,
  ])
  
  return (
    <Button
      onClick={detectText}
      disabled={isDetecting}
      variant={isTextDetectionMode ? "default" : "outline"}
    >
      {isDetecting ? "检测中..." : "检测文字"}
    </Button>
  )
}
```

#### 4.3.2 TextRegion 矩形框组件

**文件位置**: `web_app/src/components/TextRegion.tsx`

```typescript
interface TextRegionProps {
  region: TextRegion
  scale: number
  onUpdate: (bbox: Partial<TextRegionBBox>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export const TextRegionComponent = (props: TextRegionProps) => {
  const { region, scale, onUpdate, onDelete, isSelected, onSelect } = props
  const [isDragging, setIsDragging] = useState(false)
  const [dragHandle, setDragHandle] = useState<string | null>(null)
  
  // 拖动逻辑（参考 Cropper.tsx）
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragHandle(handle)
    onSelect()
    // ... 拖动实现
  }
  
  return (
    <div
      className={cn(
        "absolute border-2 cursor-move",
        isSelected ? "border-blue-500" : "border-yellow-400"
      )}
      style={{
        left: region.bbox.x * scale,
        top: region.bbox.y * scale,
        width: region.bbox.width * scale,
        height: region.bbox.height * scale,
      }}
      onClick={onSelect}
    >
      {/* 四条边的拖动手柄 */}
      <div className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize"
           onMouseDown={(e) => handleMouseDown(e, "top")} />
      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
           onMouseDown={(e) => handleMouseDown(e, "bottom")} />
      <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
           onMouseDown={(e) => handleMouseDown(e, "left")} />
      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
           onMouseDown={(e) => handleMouseDown(e, "right")} />
      
      {/* 四个角的拖动手柄 */}
      <div className="absolute top-0 left-0 w-3 h-3 bg-blue-500 cursor-nwse-resize"
           onMouseDown={(e) => handleMouseDown(e, "top-left")} />
      <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 cursor-nesw-resize"
           onMouseDown={(e) => handleMouseDown(e, "top-right")} />
      <div className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 cursor-nesw-resize"
           onMouseDown={(e) => handleMouseDown(e, "bottom-left")} />
      <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-nwse-resize"
           onMouseDown={(e) => handleMouseDown(e, "bottom-right")} />
      
      {/* 删除按钮 */}
      <button
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        ×
      </button>
      
      {/* 文字标签 */}
      {region.text && (
        <div className="absolute -top-6 left-0 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {region.text}
        </div>
      )}
    </div>
  )
}
```

### 4.4 API 客户端

**文件位置**: `web_app/src/lib/api.ts`

```typescript
export async function detectText(imageFile: File): Promise<TextRegion[]> {
  const imageBase64 = await convertToBase64(imageFile)
  
  const res = await fetch(`${API_ENDPOINT}/detect_text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  })
  
  if (res.ok) {
    const data = await res.json()
    return data.text_regions
  }
  
  throw await throwErrors(res)
}
```

## 5. 数据库设计

本功能不需要数据库，所有状态都在前端内存中管理。

## 6. 测试策略

### 6.1 后端测试

- **单元测试**: 测试 OCRPlugin 的文字检测功能
- **集成测试**: 测试 /detect_text API 接口
- **性能测试**: 测试不同尺寸图片的处理时间

### 6.2 前端测试

- **组件测试**: 测试 TextRegion 组件的拖动功能
- **状态测试**: 测试 Zustand store 的状态更新
- **E2E 测试**: 测试完整的文字检测和移除流程

## 7. 安全性设计

### 7.1 输入验证

- 图片大小限制：最大 10MB
- 图片格式验证：仅支持 PNG, JPEG, WebP
- 文字区域数量限制：最多 100 个

### 7.2 超时控制

- OCR 处理超时：30 秒
- API 请求超时：60 秒

### 7.3 错误处理

- 捕获所有异常并返回友好的错误信息
- 记录详细的错误日志用于调试

## 8. 性能优化

### 8.1 后端优化

- 使用 GPU 加速 OCR（如果可用）
- 对大图片进行预处理（缩放）
- 缓存 EasyOCR 模型

### 8.2 前端优化

- 使用 requestAnimationFrame 优化拖动性能
- 虚拟化渲染大量矩形框
- 防抖处理状态更新

## 9. 部署方案

### 9.1 依赖安装

```bash
# 后端
pip install easyocr>=1.7.0

# 前端（无需额外依赖）
```

### 9.2 配置项

```python
# CLI 参数
--enable-ocr: 启用 OCR 功能
--ocr-device: OCR 设备 (cpu/cuda)
--ocr-languages: 支持的语言列表
```

## 10. 监控与日志

- 记录 OCR 处理时间
- 记录检测到的文字区域数量
- 记录 API 调用次数和错误率

