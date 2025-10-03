# IOPaint 文字识别与移除功能使用指南

## 功能概述

IOPaint 现已集成文字识别与移除功能，可以自动检测图片中的文字区域，并使用 AI inpainting 技术智能移除文字。

## 功能特性

### ✨ 核心功能
- 🔍 **自动文字检测**: 使用 EasyOCR 自动识别图片中的中英文文字
- 🎯 **可视化标注**: 在图片上显示检测到的文字区域
- ✏️ **交互式调整**: 可以拖动、调整文字区域的大小和位置
- ➕ **手动添加**: 支持手动添加文字区域
- 🗑️ **灵活删除**: 可以删除单个或清除所有文字区域
- 🎨 **智能移除**: 使用 AI inpainting 技术智能填充文字区域

### 🎮 交互功能
- **移动**: 拖动矩形框中心区域
- **调整大小**: 拖动四条边或四个角
- **删除**: 点击矩形框右上角的 ❌ 按钮
- **选择**: 点击矩形框选中（蓝色高亮）

## 使用步骤

### 1. 启动服务

```bash
# 激活虚拟环境
.\venv\Scripts\activate

# 启动 IOPaint 并启用 OCR 功能
python main.py start --model=lama --device=cpu --port=8080 --enable-ocr

# 如果有 GPU，可以使用 CUDA 加速
python main.py start --model=lama --device=cuda --port=8080 --enable-ocr --ocr-device=cuda
```

### 2. 打开浏览器

访问 http://localhost:8080

### 3. 上传图片

点击上传按钮，选择包含文字的图片

### 4. 检测文字

点击工具栏中的 **"检测文字"** 按钮（📄 图标）

- 系统会自动识别图片中的文字
- 检测到的文字区域会以黄色矩形框显示
- 每个矩形框上方会显示识别到的文字内容和置信度

### 5. 调整文字区域（可选）

- **移动**: 拖动矩形框中心
- **调整大小**: 拖动边缘或角落
- **删除单个**: 点击矩形框右上角的 ❌ 按钮
- **添加区域**: 点击工具栏的 **"添加区域"** 按钮
- **清除所有**: 点击工具栏的 **"清除所有"** 按钮

### 6. 移除文字

点击工具栏中的 **"移除文字"** 按钮

- 系统会生成 mask 并执行 inpainting
- 处理完成后，文字区域会被智能填充
- 文字检测模式会自动退出

### 7. 保存结果

点击工具栏中的下载按钮保存处理后的图片

## 命令行参数

### OCR 相关参数

```bash
--enable-ocr              # 启用 OCR 功能
--ocr-device cpu|cuda     # OCR 设备（默认: cpu）
```

### 完整示例

```bash
# CPU 模式（推荐用于测试）
python main.py start \
  --model=lama \
  --device=cpu \
  --port=8080 \
  --enable-ocr \
  --ocr-device=cpu

# GPU 模式（推荐用于生产）
python main.py start \
  --model=lama \
  --device=cuda \
  --port=8080 \
  --enable-ocr \
  --ocr-device=cuda
```

## API 接口

### POST /api/v1/detect_text

检测图片中的文字区域

**请求体**:
```json
{
  "image": "base64_encoded_image",
  "languages": ["ch_sim", "en"]
}
```

**响应**:
```json
{
  "text_regions": [
    {
      "id": "uuid",
      "bbox": {
        "x": 100,
        "y": 200,
        "width": 150,
        "height": 50
      },
      "text": "识别到的文字",
      "confidence": 0.95
    }
  ]
}
```

## 技术架构

### 后端
- **OCR 引擎**: EasyOCR
- **支持语言**: 中文简体、英文
- **Inpainting 模型**: LaMa
- **框架**: FastAPI

### 前端
- **框架**: React 18 + TypeScript
- **状态管理**: Zustand + Immer
- **UI 组件**: Radix UI + Tailwind CSS
- **交互**: 自定义拖拽实现

## 性能优化建议

### 1. 使用 GPU 加速
```bash
--device=cuda --ocr-device=cuda
```

### 2. 调整图片大小
- 建议图片分辨率不超过 1920x1080
- 过大的图片会影响 OCR 和 inpainting 速度

### 3. 批量处理
- 对于多张图片，建议使用文件管理器功能
- 可以设置输入输出目录进行批量处理

## 常见问题

### Q: OCR 检测不到文字？
A: 
- 确保图片清晰，文字可读
- 尝试调整图片亮度和对比度
- 检查是否启用了 `--enable-ocr` 参数

### Q: 文字移除效果不理想？
A:
- 调整文字区域的大小，确保完全覆盖文字
- 尝试使用不同的 inpainting 模型
- 对于复杂背景，可能需要手动调整区域

### Q: 处理速度慢？
A:
- 使用 GPU 加速（`--device=cuda --ocr-device=cuda`）
- 减小图片分辨率
- 关闭不必要的插件

### Q: 支持哪些语言？
A: 
- 当前默认支持中文简体和英文
- EasyOCR 支持 80+ 种语言，可以通过修改代码添加

## 开发文档

### 文件结构

```
iopaint/
├── plugins/
│   └── ocr_plugin.py          # OCR 插件实现
├── schema.py                   # API Schema 定义
└── api.py                      # API 接口实现

web_app/src/
├── components/
│   ├── TextDetection.tsx      # 文字检测按钮和工具栏
│   ├── TextRegion.tsx         # 文字区域矩形框组件
│   └── Editor.tsx             # 编辑器主组件
├── lib/
│   ├── types.ts               # TypeScript 类型定义
│   ├── states.ts              # Zustand 状态管理
│   └── api.ts                 # API 客户端
└── docs/
    └── text-detection-feature.md  # 本文档
```

### 扩展开发

如需添加新功能或修改现有功能，请参考：
- 后端插件开发: `iopaint/plugins/base_plugin.py`
- 前端组件开发: `web_app/src/components/`
- 状态管理: `web_app/src/lib/states.ts`

## 更新日志

### v1.0.0 (2025-10-03)
- ✅ 集成 EasyOCR 文字识别
- ✅ 实现可交互的文字区域标注
- ✅ 支持拖动、调整大小、删除操作
- ✅ 集成 AI inpainting 文字移除
- ✅ 完整的前后端实现

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

本功能遵循 IOPaint 项目的许可证。

