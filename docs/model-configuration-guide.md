# IOPaint 模型配置与参数调整指南

## 📋 目录
1. [支持的模型类型](#支持的模型类型)
2. [模型配置方法](#模型配置方法)
3. [LaMa 参数调整](#lama-参数调整)
4. [Stable Diffusion 配置](#stable-diffusion-配置)
5. [性能优化建议](#性能优化建议)

---

## 支持的模型类型

### 🎨 Erase Models（擦除模型）
这些模型专门用于图像修复和文字移除，**不需要提示词**：

| 模型名称 | 说明 | 推荐用途 |
|---------|------|---------|
| **lama** | 最流行的修复模型 | 文字移除、物体移除（推荐） |
| **ldm** | Latent Diffusion Model | 大面积修复 |
| **zits** | ZITS 修复模型 | 结构化内容修复 |
| **mat** | MAT 修复模型 | 高质量修复 |
| **fcf** | FCF 修复模型 | 快速修复 |
| **manga** | 漫画专用模型 | 漫画图片修复 |
| **cv2** | OpenCV 修复 | 简单快速修复 |
| **migan** | MIGAN 模型 | 通用修复 |

### 🌟 Diffusion Models（扩散模型）
这些模型基于 Stable Diffusion，**需要提示词**，功能更强大：

#### SD 1.5 系列
```bash
# Stable Diffusion Inpainting（官方）
runwayml/stable-diffusion-inpainting

# Realistic Vision（写实风格）
Uminosachi/realisticVisionV51_v51VAE-inpainting

# DreamShaper（梦幻风格）
redstonehero/dreamshaper-inpainting

# Anything 4.0（动漫风格）
Sanster/anything-4.0-inpainting
```

#### SDXL 系列
```bash
# SDXL Inpainting（官方）
diffusers/stable-diffusion-xl-1.0-inpainting-0.1

# Juggernaut XI（写实风格）
RunDiffusion/Juggernaut-XI-v11

# RealVisXL（超写实）
SG161222/RealVisXL_V5.0

# Anything XL（动漫风格）
eienmojiki/Anything-XL
```

#### 特殊模型
```bash
# Paint by Example（参考图生成）
Fantasy-Studio/Paint-by-Example

# PowerPaint（多功能）
powerpaint

# AnyText（文字生成）
anytext
```

---

## 模型配置方法

### 方法 1: 命令行启动

#### 使用内置模型
```bash
# 使用 LaMa（推荐用于文字移除）
python main.py start --model=lama --device=cpu --port=8080

# 使用 MAT（高质量修复）
python main.py start --model=mat --device=cuda --port=8080

# 使用 MIGAN（通用修复）
python main.py start --model=migan --device=cuda --port=8080
```

#### 使用 Stable Diffusion 模型
```bash
# 使用 SD 1.5 Inpainting
python main.py start \
  --model=runwayml/stable-diffusion-inpainting \
  --device=cuda \
  --port=8080

# 使用 SDXL Inpainting
python main.py start \
  --model=diffusers/stable-diffusion-xl-1.0-inpainting-0.1 \
  --device=cuda \
  --port=8080 \
  --no-half  # SDXL 建议使用完整精度

# 使用 Realistic Vision（写实风格）
python main.py start \
  --model=Uminosachi/realisticVisionV51_v51VAE-inpainting \
  --device=cuda \
  --port=8080
```

### 方法 2: 下载模型到本地

```bash
# 下载模型
python main.py download --model=runwayml/stable-diffusion-inpainting

# 查看已下载的模型
python main.py list

# 使用已下载的模型
python main.py start --model=runwayml/stable-diffusion-inpainting
```

### 方法 3: 使用配置文件

创建 `config.json`:
```json
{
  "host": "127.0.0.1",
  "port": 8080,
  "model": "lama",
  "device": "cuda",
  "enable_ocr": true,
  "ocr_device": "cuda"
}
```

启动：
```bash
python main.py start --config=config.json
```

### 方法 4: 前端切换模型

1. 启动服务后，打开浏览器
2. 点击右上角的 **Settings** 按钮
3. 在 **Available models** 下拉菜单中选择模型
4. 点击 **Switch Model** 按钮

---

## LaMa 参数调整

LaMa 是最适合文字移除的模型，以下是可调整的参数：

### HD Strategy（高清策略）

控制如何处理大图片：

```bash
# 在前端 Settings 中调整，或通过 API 传递参数
```

#### 1. ORIGINAL（原始）
- **说明**: 直接处理原图，不做任何预处理
- **优点**: 保持原始分辨率，质量最高
- **缺点**: 大图片可能内存不足
- **适用**: 小于 2048x2048 的图片

#### 2. RESIZE（调整大小）
- **说明**: 将图片缩小到指定大小处理，然后放大回原尺寸
- **优点**: 节省内存，速度快
- **缺点**: 可能损失细节
- **参数**: 
  - `hd_strategy_resize_limit`: 最大边长（默认 2048）
- **适用**: 大图片快速处理

#### 3. CROP（裁剪）
- **说明**: 只处理包含 mask 的区域，其他部分保持不变
- **优点**: 最节省内存，速度最快，质量最好
- **缺点**: 需要合理设置裁剪参数
- **参数**:
  - `hd_strategy_crop_trigger_size`: 触发裁剪的图片大小（默认 800）
  - `hd_strategy_crop_margin`: 裁剪边距（默认 128）
- **适用**: 大图片局部修复（**推荐用于文字移除**）

### 前端参数设置

在前端 Settings 中可以调整：

1. **HD Strategy**: 选择处理策略
2. **HD Strategy Crop Trigger Size**: 裁剪触发大小
3. **HD Strategy Crop Margin**: 裁剪边距
4. **HD Strategy Resize Limit**: 调整大小限制

### API 参数示例

```json
{
  "image": "base64_encoded_image",
  "mask": "base64_encoded_mask",
  "hd_strategy": "CROP",
  "hd_strategy_crop_trigger_size": 800,
  "hd_strategy_crop_margin": 128,
  "hd_strategy_resize_limit": 2048
}
```

### 文字移除最佳实践

```bash
# 启动命令
python main.py start \
  --model=lama \
  --device=cuda \
  --port=8080 \
  --enable-ocr \
  --ocr-device=cuda

# 前端设置
# HD Strategy: CROP
# Crop Trigger Size: 800
# Crop Margin: 128
```

**为什么选择 CROP 策略？**
- ✅ 只处理文字区域，速度快
- ✅ 保持其他区域完全不变
- ✅ 内存占用小
- ✅ 质量最好

---

## Stable Diffusion 配置

### 基础参数

```bash
python main.py start \
  --model=runwayml/stable-diffusion-inpainting \
  --device=cuda \
  --port=8080 \
  --no-half=false \          # 使用半精度（FP16）节省显存
  --low-mem=false \          # 低显存模式
  --cpu-offload=false \      # CPU 卸载（极低显存）
  --cpu-textencoder=false    # 文本编码器使用 CPU
```

### 显存优化

| 显存大小 | 推荐配置 |
|---------|---------|
| **12GB+** | 默认配置 |
| **8-12GB** | `--no-half=false` |
| **6-8GB** | `--no-half=false --low-mem` |
| **4-6GB** | `--no-half=false --cpu-offload` |
| **<4GB** | `--no-half=false --cpu-offload --cpu-textencoder` |

### 前端 SD 参数

在前端 Settings 中可以调整：

#### 基础参数
- **Prompt**: 正向提示词（描述想要的内容）
- **Negative Prompt**: 负向提示词（描述不想要的内容）
- **Steps**: 采样步数（20-50，越高质量越好但越慢）
- **Guidance Scale**: 提示词引导强度（7-15）
- **Sampler**: 采样器（推荐 DPM++ 2M Karras）

#### 高级参数
- **Seed**: 随机种子（-1 为随机）
- **Strength**: 修复强度（0.7-1.0）
- **Use Croper**: 使用裁剪器
- **Enable ControlNet**: 启用 ControlNet
- **Enable BrushNet**: 启用 BrushNet

### 文字移除提示词示例

```
Prompt: 
clean background, seamless, natural, high quality, detailed

Negative Prompt:
text, watermark, logo, signature, words, letters, characters, 
low quality, blurry, artifacts
```

---

## 性能优化建议

### 1. 硬件选择

| 任务 | CPU | GPU | 显存 |
|-----|-----|-----|------|
| **文字移除（LaMa）** | 可用 | 推荐 | 2GB+ |
| **SD 1.5** | 不推荐 | 必需 | 4GB+ |
| **SDXL** | 不推荐 | 必需 | 8GB+ |

### 2. 模型选择建议

| 场景 | 推荐模型 | 原因 |
|-----|---------|------|
| **文字移除** | LaMa + CROP | 速度快，质量好，不需要提示词 |
| **物体移除** | LaMa / MAT | 自动填充背景 |
| **创意修复** | SD 1.5 Inpainting | 可以生成新内容 |
| **高质量修复** | SDXL Inpainting | 质量最高，但需要更多显存 |
| **动漫图片** | Anything 4.0 / Manga | 专门优化 |

### 3. 速度优化

```bash
# 最快配置（文字移除）
python main.py start \
  --model=lama \
  --device=cuda \
  --port=8080

# 前端设置
# HD Strategy: CROP
# Crop Trigger Size: 800
```

### 4. 质量优化

```bash
# 最高质量配置
python main.py start \
  --model=mat \
  --device=cuda \
  --port=8080

# 前端设置
# HD Strategy: ORIGINAL
```

---

## 常见问题

### Q: 如何切换模型？
A: 
1. 前端：Settings → Available models → 选择模型 → Switch Model
2. 命令行：重启服务并指定 `--model` 参数

### Q: 模型会自动下载吗？
A: 是的，首次使用时会自动从 HuggingFace 下载到 `~/.cache` 目录

### Q: 如何使用本地模型？
A: 
```bash
# 下载到本地
python main.py download --model=模型名称

# 使用本地模型
python main.py start --model=模型名称 --local-files-only
```

### Q: 显存不足怎么办？
A: 
1. 使用 `--no-half=false` 启用半精度
2. 使用 `--low-mem` 启用低显存模式
3. 使用 `--cpu-offload` 将部分计算卸载到 CPU
4. 选择更小的模型（如 LaMa 而不是 SDXL）

### Q: LaMa 和 SD 哪个更适合文字移除？
A: 
- **LaMa**: 速度快，质量好，不需要提示词，**推荐用于文字移除**
- **SD**: 功能强大，可以生成新内容，但需要提示词和更多显存

---

## 总结

### 文字移除最佳配置

```bash
# 启动命令
python main.py start \
  --model=lama \
  --device=cuda \
  --port=8080 \
  --enable-ocr \
  --ocr-device=cuda

# 前端设置
# HD Strategy: CROP
# Crop Trigger Size: 800
# Crop Margin: 128
```

这个配置提供了：
- ✅ 最快的处理速度
- ✅ 最好的修复质量
- ✅ 最低的显存占用
- ✅ 自动文字检测
- ✅ 无需提示词

---

## 参考资料

- [IOPaint GitHub](https://github.com/Sanster/IOPaint)
- [LaMa 论文](https://arxiv.org/abs/2109.07161)
- [Stable Diffusion](https://stability.ai/)
- [HuggingFace Models](https://huggingface.co/models)

