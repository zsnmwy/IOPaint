# Docker 多阶段构建优化 - 需求文档

## 介绍

当前 IOPaint 项目的 Docker 镜像构建方式依赖于先将代码发布到 PyPI，然后在 Dockerfile 中通过 `pip install` 安装已发布的包。这种方式存在以下问题：

1. **构建依赖外部发布**：必须先发布到 PyPI 才能构建 Docker 镜像
2. **无法快速迭代**：本地开发的代码无法直接构建成 Docker 镜像进行测试
3. **版本管理复杂**：Docker 镜像版本必须与 PyPI 版本严格对应
4. **构建效率低**：每次构建都需要从 PyPI 下载完整的包

本需求旨在将 Docker 构建方式改为**多阶段构建 + 本地源码**的方式，实现：
- 直接从本地源码构建 Docker 镜像
- 支持开发分支和未发布版本的快速构建
- 优化镜像体积和构建速度
- 保持与现有功能的完全兼容

---

## 需求

### 需求 1 - 多阶段 Dockerfile 构建

**用户故事：** 作为开发者，我希望能够直接从本地源码构建 Docker 镜像，而不需要先发布到 PyPI

#### 验收标准

1. When 执行 `docker build` 命令时，Docker 应当能够从本地源码构建完整的镜像，无需依赖 PyPI
2. When 构建过程中，Docker 应当使用多阶段构建，分别处理前端构建、Python 依赖安装和最终运行时镜像
3. When 构建完成后，最终镜像应当只包含运行时必需的文件，不包含构建工具和中间文件
4. When 使用构建好的镜像启动容器时，应用应当能够正常运行，功能与 PyPI 安装版本完全一致

### 需求 2 - CPU 版本 Dockerfile 优化

**用户故事：** 作为开发者，我希望 CPU 版本的 Docker 镜像能够高效构建，并且镜像体积尽可能小

#### 验收标准

1. When 构建 CPU 版本镜像时，Docker 应当使用 `python:3.10-slim` 作为基础镜像
2. When 安装系统依赖时，Docker 应当只安装运行时必需的库（libsm6, libxext6, ffmpeg 等）
3. When 安装 PyTorch 时，Docker 应当安装 CPU 版本的 PyTorch（torch==2.1.2, torchvision==0.16.2）
4. When 构建完成后，最终镜像大小应当比当前方式减少至少 10%
5. When 容器启动时，应用应当默认监听 `0.0.0.0:8080`，支持外部访问

### 需求 3 - GPU 版本 Dockerfile 优化

**用户故事：** 作为开发者，我希望 GPU 版本的 Docker 镜像能够支持 CUDA 加速，并且构建过程高效

#### 验收标准

1. When 构建 GPU 版本镜像时，Docker 应当使用 `nvidia/cuda:11.8.0-runtime-ubuntu22.04` 作为基础镜像
2. When 安装 PyTorch 时，Docker 应当安装 CUDA 版本的 PyTorch（torch==2.1.2, torchvision==0.16.2, cu118）
3. When 安装 xformers 时，Docker 应当安装对应 CUDA 版本的 xformers（xformers==0.0.23.post1）
4. When 容器启动时，应用应当能够正确识别和使用 GPU 设备
5. When 使用 `--device=cuda` 参数启动时，应用应当能够在 GPU 上运行模型推理

### 需求 4 - 前端资源构建集成

**用户故事：** 作为开发者，我希望 Docker 构建过程能够自动处理前端资源的构建，无需手动操作

#### 验收标准

1. When 构建 Docker 镜像时，Docker 应当在第一阶段自动构建前端资源（npm install && npm run build）
2. When 前端构建完成后，Docker 应当将构建产物（web_app/dist）复制到 Python 包的正确位置（iopaint/web_app）
3. When 最终镜像中，前端资源应当被正确打包，Web UI 能够正常访问
4. When 访问容器的 8080 端口时，应当能够看到完整的 Web 界面

### 需求 5 - 构建脚本更新

**用户故事：** 作为开发者，我希望有便捷的构建脚本来构建不同版本的 Docker 镜像

#### 验收标准

1. When 执行构建脚本时，脚本应当支持构建 CPU 和 GPU 两个版本的镜像
2. When 指定版本号时，镜像应当被正确打上版本标签（如 `iopaint:cpu-1.6.0`）
3. When 不指定版本号时，镜像应当使用 `latest` 标签
4. When 构建完成后，脚本应当输出镜像的详细信息（镜像 ID、大小、标签等）
5. When 构建失败时，脚本应当输出清晰的错误信息并返回非零退出码

### 需求 6 - .dockerignore 文件配置

**用户故事：** 作为开发者，我希望 Docker 构建过程能够忽略不必要的文件，提升构建速度

#### 验收标准

1. When 执行 `docker build` 时，Docker 应当忽略 `.git`、`venv`、`node_modules` 等开发文件
2. When 执行 `docker build` 时，Docker 应当忽略 `__pycache__`、`*.pyc`、`.pytest_cache` 等临时文件
3. When 执行 `docker build` 时，Docker 应当忽略 `dist`、`build`、`*.egg-info` 等构建产物
4. When 构建上下文传输时，传输的文件大小应当比不使用 `.dockerignore` 时减少至少 50%

### 需求 7 - 容器启动命令优化

**用户故事：** 作为用户，我希望容器启动后能够直接运行 IOPaint 服务，而不是进入 bash shell

#### 验收标准

1. When 使用 `docker run` 启动容器时，容器应当自动启动 IOPaint 服务
2. When 容器启动时，IOPaint 应当使用默认配置：`--model=lama --device=cpu --host=0.0.0.0 --port=8080`
3. When 用户需要自定义启动参数时，应当能够通过环境变量或命令行参数覆盖默认配置
4. When 容器停止时，IOPaint 服务应当能够优雅地关闭，保存必要的状态

### 需求 8 - 向后兼容性保证

**用户故事：** 作为现有用户，我希望新的 Docker 镜像能够与旧版本保持兼容，不影响现有的使用方式

#### 验收标准

1. When 使用新镜像替换旧镜像时，所有现有的 `docker run` 命令应当能够正常工作
2. When 使用新镜像时，所有 CLI 参数和环境变量应当与旧版本保持一致
3. When 挂载数据卷时，数据路径和格式应当与旧版本兼容
4. When 使用 docker-compose 时，配置文件应当无需修改即可使用新镜像

### 需求 9 - 构建缓存优化

**用户故事：** 作为开发者，我希望 Docker 构建能够充分利用缓存，提升重复构建的速度

#### 验收标准

1. When 只修改 Python 代码时，Docker 应当能够复用前端构建和依赖安装的缓存层
2. When 只修改前端代码时，Docker 应当能够复用 Python 依赖安装的缓存层
3. When 只修改 requirements.txt 时，Docker 应当能够复用前端构建的缓存层
4. When 重复构建相同代码时，构建时间应当比首次构建减少至少 70%

### 需求 10 - 文档更新

**用户故事：** 作为用户，我希望有清晰的文档说明如何构建和使用新的 Docker 镜像

#### 验收标准

1. When 查看 README.md 时，应当包含使用新 Docker 镜像的完整说明
2. When 查看构建文档时，应当包含本地构建 Docker 镜像的详细步骤
3. When 查看文档时，应当包含常见问题和故障排查指南
4. When 文档更新后，所有示例命令应当经过验证，确保可以正常执行

---

## 非功能性需求

### 性能要求

1. **构建速度**：首次构建时间不超过 15 分钟（CPU 版本）、20 分钟（GPU 版本）
2. **镜像大小**：CPU 版本镜像不超过 3GB，GPU 版本镜像不超过 5GB
3. **启动时间**：容器启动到服务可用不超过 30 秒

### 安全要求

1. **最小权限**：容器应当以非 root 用户运行（可选，但推荐）
2. **依赖安全**：所有依赖应当使用固定版本，避免安全漏洞
3. **镜像扫描**：构建的镜像应当通过基本的安全扫描（无高危漏洞）

### 兼容性要求

1. **Docker 版本**：支持 Docker 20.10+ 和 Docker Compose 2.0+
2. **平台支持**：支持 linux/amd64 和 linux/arm64 平台（arm64 可选）
3. **GPU 支持**：GPU 版本支持 NVIDIA GPU（CUDA 11.8+）

---

## 验收测试场景

### 场景 1：本地源码构建 CPU 镜像

```bash
# 构建镜像
./build_docker.sh cpu

# 运行容器
docker run -p 8080:8080 iopaint:cpu-latest

# 验证：访问 http://localhost:8080，应当能够看到 Web UI
# 验证：上传图片并进行 inpainting，应当能够正常处理
```

### 场景 2：本地源码构建 GPU 镜像

```bash
# 构建镜像
./build_docker.sh gpu

# 运行容器（需要 NVIDIA Docker Runtime）
docker run --gpus all -p 8080:8080 iopaint:gpu-latest

# 验证：容器日志应当显示 "Using device: cuda"
# 验证：GPU 推理速度应当明显快于 CPU
```

### 场景 3：自定义启动参数

```bash
# 使用环境变量自定义配置
docker run -p 8080:8080 \
  -e MODEL=sd1.5 \
  -e DEVICE=cpu \
  iopaint:cpu-latest

# 验证：应当使用 SD1.5 模型启动
```

### 场景 4：数据持久化

```bash
# 挂载模型目录和输出目录
docker run -p 8080:8080 \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/outputs:/app/outputs \
  iopaint:cpu-latest

# 验证：下载的模型应当保存在本地 models 目录
# 验证：处理的图片应当保存在本地 outputs 目录
```

---

## 成功标准

1. ✅ 所有验收标准通过
2. ✅ 构建的镜像能够在 Docker Hub 或私有仓库正常使用
3. ✅ 现有用户能够无缝迁移到新镜像
4. ✅ 文档完整且经过验证
5. ✅ 至少有 2 名团队成员完成代码审查

---

## 风险与依赖

### 风险

1. **镜像体积过大**：多阶段构建可能无法有效减小镜像体积
   - 缓解措施：使用 slim 基础镜像，清理不必要的文件
   
2. **构建时间过长**：前端构建和依赖安装可能耗时较长
   - 缓解措施：优化 Dockerfile 层级，充分利用缓存

3. **兼容性问题**：新镜像可能与现有部署方式不兼容
   - 缓解措施：充分测试，保持 API 和配置向后兼容

### 依赖

1. **Node.js 18+**：前端构建需要 Node.js 环境
2. **Docker Buildx**：多平台构建需要 Buildx 支持
3. **NVIDIA Container Toolkit**：GPU 版本需要 NVIDIA 运行时

---

## 时间估算

- 需求分析和设计：已完成
- Dockerfile 编写和测试：4-6 小时
- 构建脚本开发：2-3 小时
- 文档编写：2-3 小时
- 测试和验证：3-4 小时
- **总计**：11-16 小时（约 2-3 个工作日）

