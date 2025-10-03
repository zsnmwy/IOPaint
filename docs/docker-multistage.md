# IOPaint Docker 多阶段构建使用指南

## 📖 目录

- [简介](#简介)
- [快速开始](#快速开始)
- [构建镜像](#构建镜像)
- [运行容器](#运行容器)
- [配置选项](#配置选项)
- [数据持久化](#数据持久化)
- [Docker Compose](#docker-compose)
- [常见问题](#常见问题)
- [故障排查](#故障排查)

---

## 简介

IOPaint 现在支持**多阶段构建（Multi-stage Build）**方式，直接从本地源码构建 Docker 镜像，无需先发布到 PyPI。

### 优势

✅ **本地构建**: 直接从源码构建，无需发布到 PyPI  
✅ **快速迭代**: 支持开发分支和未发布版本的快速构建  
✅ **镜像优化**: 使用多阶段构建，镜像体积更小  
✅ **缓存友好**: 充分利用 Docker 缓存，重复构建更快  
✅ **灵活配置**: 支持环境变量和数据卷配置  

### 版本说明

- **CPU 版本**: 适用于没有 GPU 的环境，使用 CPU 进行推理
- **GPU 版本**: 适用于有 NVIDIA GPU 的环境，使用 CUDA 加速

---

## 快速开始

### 前置要求

- Docker 20.10+ 或 Docker Desktop
- （GPU 版本）NVIDIA Docker Runtime

### 1. 构建镜像

```bash
# 构建 CPU 版本
./build_docker_multistage.sh cpu

# 构建 GPU 版本
./build_docker_multistage.sh gpu

# 构建所有版本
./build_docker_multistage.sh all
```

### 2. 运行容器

```bash
# 运行 CPU 版本
docker run -p 8080:8080 iopaint:cpu-latest

# 运行 GPU 版本（需要 NVIDIA Docker Runtime）
docker run --gpus all -p 8080:8080 iopaint:gpu-latest
```

### 3. 访问 Web UI

打开浏览器访问: http://localhost:8080

---

## 构建镜像

### 基本用法

```bash
./build_docker_multistage.sh [cpu|gpu|all] [version]
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `cpu` | 仅构建 CPU 版本 | - |
| `gpu` | 仅构建 GPU 版本 | - |
| `all` | 构建所有版本 | `all` |
| `version` | 镜像版本标签 | `latest` |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VERSION` | 镜像版本标签 | `latest` |
| `PUSH` | 构建后推送到仓库 | `false` |
| `REGISTRY` | Docker 仓库前缀 | 空 |

### 示例

```bash
# 构建 CPU 版本，标签为 latest
./build_docker_multistage.sh cpu

# 构建 GPU 版本，标签为 1.6.0
./build_docker_multistage.sh gpu 1.6.0

# 构建所有版本，标签为 1.6.0
VERSION=1.6.0 ./build_docker_multistage.sh all

# 构建并推送到私有仓库
REGISTRY=myregistry.com/iopaint PUSH=true ./build_docker_multistage.sh all
```

### 构建时间

- **首次构建**: 约 10-15 分钟（CPU）/ 15-20 分钟（GPU）
- **缓存构建**: 约 2-5 分钟（仅修改代码时）

### 镜像大小

- **CPU 版本**: 约 2.5-3 GB
- **GPU 版本**: 约 4-5 GB

---

## 运行容器

### 基本用法

```bash
# CPU 版本
docker run -p 8080:8080 iopaint:cpu-latest

# GPU 版本
docker run --gpus all -p 8080:8080 iopaint:gpu-latest
```

### 后台运行

```bash
docker run -d \
  --name iopaint \
  -p 8080:8080 \
  iopaint:cpu-latest
```

### 查看日志

```bash
# 查看实时日志
docker logs -f iopaint

# 查看最近 100 行日志
docker logs --tail 100 iopaint
```

### 停止和删除容器

```bash
# 停止容器
docker stop iopaint

# 删除容器
docker rm iopaint

# 停止并删除
docker rm -f iopaint
```

---

## 配置选项

### 环境变量

容器支持以下环境变量配置：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `MODEL` | 默认使用的模型 | `lama` |
| `DEVICE` | 计算设备 | `cpu` / `cuda` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `PORT` | 监听端口 | `8080` |

### 使用环境变量

```bash
docker run -p 8080:8080 \
  -e MODEL=sd1.5 \
  -e DEVICE=cpu \
  iopaint:cpu-latest
```

### 可用模型

- `lama` - LaMa（推荐用于文字移除）
- `ldm` - LDM
- `zits` - ZITS
- `mat` - MAT
- `fcf` - FcF
- `sd1.5` - Stable Diffusion 1.5
- `sd2` - Stable Diffusion 2
- `sdxl` - Stable Diffusion XL
- 以及任何 HuggingFace 上的 SD/SDXL 模型

---

## 数据持久化

### 挂载数据卷

```bash
docker run -p 8080:8080 \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/outputs:/app/outputs \
  iopaint:cpu-latest
```

### 目录说明

| 容器路径 | 说明 | 推荐挂载 |
|---------|------|---------|
| `/app/models` | 模型存储目录 | ✅ 推荐 |
| `/app/outputs` | 输出文件目录 | ✅ 推荐 |

### Windows 路径示例

```bash
docker run -p 8080:8080 \
  -v D:/iopaint/models:/app/models \
  -v D:/iopaint/outputs:/app/outputs \
  iopaint:cpu-latest
```

---

## Docker Compose

### 使用 Docker Compose

```bash
# 启动所有服务
docker-compose -f docker-compose.multistage.yml up -d

# 查看服务状态
docker-compose -f docker-compose.multistage.yml ps

# 查看日志
docker-compose -f docker-compose.multistage.yml logs -f

# 停止服务
docker-compose -f docker-compose.multistage.yml down
```

### 配置文件

`docker-compose.multistage.yml` 包含两个服务：

- **iopaint-cpu**: CPU 版本，端口 8080
- **iopaint-gpu**: GPU 版本，端口 8081

### 自定义配置

编辑 `docker-compose.multistage.yml` 文件，修改环境变量或数据卷路径。

---

## 常见问题

### Q1: 如何切换模型？

**方法 1**: 使用环境变量

```bash
docker run -p 8080:8080 \
  -e MODEL=sd1.5 \
  iopaint:cpu-latest
```

**方法 2**: 在 Web UI 中切换

访问 http://localhost:8080，在设置中切换模型。

### Q2: 如何使用自定义模型？

将模型文件放在挂载的 `models` 目录中：

```bash
docker run -p 8080:8080 \
  -v $(pwd)/models:/app/models \
  -e MODEL=/app/models/my-model.safetensors \
  iopaint:cpu-latest
```

### Q3: GPU 版本无法识别 GPU？

确保已安装 NVIDIA Docker Runtime：

```bash
# 检查 NVIDIA Docker Runtime
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# 如果失败，安装 NVIDIA Container Toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
```

### Q4: 如何减小镜像体积？

镜像已经使用多阶段构建优化，如需进一步减小：

1. 使用 `--squash` 参数构建（实验性功能）
2. 删除不需要的模型和依赖

### Q5: 构建速度慢怎么办？

1. **使用缓存**: 不要使用 `--no-cache` 参数
2. **优化网络**: 使用国内镜像源
3. **并行构建**: 使用 BuildKit

```bash
# 启用 BuildKit
export DOCKER_BUILDKIT=1
./build_docker_multistage.sh cpu
```

---

## 故障排查

### 问题 1: 构建失败 - 前端构建错误

**症状**: `npm ci` 或 `npm run build` 失败

**解决方案**:
1. 检查 `package.json` 和 `package-lock.json` 是否同步
2. 清理 Docker 缓存: `docker builder prune -af`
3. 重新构建

### 问题 2: 容器启动失败

**症状**: 容器启动后立即退出

**解决方案**:
1. 查看日志: `docker logs <container_id>`
2. 检查端口是否被占用: `netstat -an | grep 8080`
3. 检查环境变量配置是否正确

### 问题 3: Web UI 无法访问

**症状**: 浏览器无法打开 http://localhost:8080

**解决方案**:
1. 检查容器是否运行: `docker ps`
2. 检查端口映射: `docker port <container_id>`
3. 检查防火墙设置
4. 尝试使用 `0.0.0.0:8080` 或 `127.0.0.1:8080`

### 问题 4: 模型下载失败

**症状**: 启动时提示模型下载失败

**解决方案**:
1. 检查网络连接
2. 使用 HuggingFace 镜像:
   ```bash
   docker run -p 8080:8080 \
     -e HF_ENDPOINT=https://hf-mirror.com \
     iopaint:cpu-latest
   ```
3. 手动下载模型并挂载到容器

### 问题 5: GPU 内存不足

**症状**: GPU 版本运行时提示 CUDA out of memory

**解决方案**:
1. 使用 `--low-mem` 参数:
   ```bash
   docker run --gpus all -p 8080:8080 \
     iopaint:gpu-latest \
     python -m iopaint start --low-mem
   ```
2. 减小图片分辨率
3. 使用 CPU 版本

---

## 高级用法

### 自定义启动命令

```bash
docker run -p 8080:8080 \
  iopaint:cpu-latest \
  python -m iopaint start \
    --model lama \
    --device cpu \
    --host 0.0.0.0 \
    --port 8080 \
    --enable-interactive-seg \
    --enable-remove-bg
```

### 使用配置文件

```bash
# 创建配置文件
cat > config.json << EOF
{
  "model": "lama",
  "device": "cpu",
  "host": "0.0.0.0",
  "port": 8080
}
EOF

# 使用配置文件启动
docker run -p 8080:8080 \
  -v $(pwd)/config.json:/app/config.json \
  iopaint:cpu-latest \
  python -m iopaint start --config /app/config.json
```

### 批处理模式

```bash
docker run --rm \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  iopaint:cpu-latest \
  python -m iopaint run \
    --model lama \
    --device cpu \
    --image /app/input \
    --mask /app/input/masks \
    --output /app/output
```

---

## 参考资料

- [IOPaint 官方文档](https://www.iopaint.com)
- [Docker 官方文档](https://docs.docker.com)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)
- [多阶段构建最佳实践](https://docs.docker.com/develop/develop-images/multistage-build/)

---

## 贡献

如果你发现文档有误或有改进建议，欢迎提交 Issue 或 Pull Request。

## 许可证

本项目采用 Apache 2.0 许可证。

