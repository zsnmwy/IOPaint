# Docker Compose 使用指南

本文档介绍如何使用 Docker Compose 部署和管理 IOPaint 服务。

## 📋 目录

- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [日志管理](#日志管理)
- [资源限制](#资源限制)
- [健康检查](#健康检查)
- [常用命令](#常用命令)
- [故障排查](#故障排查)

---

## 🚀 快速开始

### 1. 启动服务

```bash
# 启动 CPU 版本
docker-compose -f docker-compose.multistage.yml up -d iopaint-cpu

# 启动 GPU 版本（需要 NVIDIA GPU 和 nvidia-docker）
docker-compose -f docker-compose.multistage.yml up -d iopaint-gpu

# 同时启动两个版本
docker-compose -f docker-compose.multistage.yml up -d
```

### 2. 查看服务状态

```bash
# 查看运行状态
docker-compose -f docker-compose.multistage.yml ps

# 查看日志
docker-compose -f docker-compose.multistage.yml logs -f iopaint-cpu
```

### 3. 访问服务

- **CPU 版本**: http://localhost:8080
- **GPU 版本**: http://localhost:8081

---

## ⚙️ 配置说明

### 自动重启策略

配置文件中使用 `restart: unless-stopped`，这意味着：

- ✅ 容器崩溃时自动重启
- ✅ Docker 守护进程重启时自动启动容器
- ✅ 系统重启后自动启动容器
- ❌ 手动停止容器后不会自动重启

**其他可选策略：**

```yaml
restart: no              # 不自动重启
restart: always          # 总是重启（即使手动停止）
restart: on-failure      # 仅在失败时重启
restart: unless-stopped  # 除非手动停止，否则总是重启（推荐）
```

### 环境变量

可以通过修改 `environment` 部分来自定义配置：

```yaml
environment:
  - MODEL=lama                              # 默认模型
  - DEVICE=cpu                              # 设备类型：cpu 或 cuda
  - HOST=0.0.0.0                            # 监听地址
  - PORT=8080                               # 服务端口
  - EASYOCR_MODEL_DIR=/app/models/.EasyOCR  # OCR 模型路径
  - ENABLE_OCR=true                         # 是否启用 OCR 插件（true/false）
```

**OCR 插件控制：**

- `ENABLE_OCR=true`：启用 OCR 插件（默认）
- `ENABLE_OCR=false`：禁用 OCR 插件

如果禁用 OCR，可以减少内存占用和启动时间。

---

## 📝 日志管理

### 日志配置

配置文件中已经设置了日志回收策略：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"      # 单个日志文件最大 10MB
    max-file: "3"        # 保留 3 个日志文件
    compress: "true"     # 压缩旧日志
```

**日志存储空间：** 最多 30MB（10MB × 3 个文件）

### 查看日志

```bash
# 查看实时日志
docker-compose -f docker-compose.multistage.yml logs -f iopaint-cpu

# 查看最近 100 行日志
docker-compose -f docker-compose.multistage.yml logs --tail=100 iopaint-cpu

# 查看特定时间段的日志
docker-compose -f docker-compose.multistage.yml logs --since="2024-01-01T00:00:00" iopaint-cpu
```

### 日志文件位置

Docker 日志文件默认存储在：

- **Linux**: `/var/lib/docker/containers/<container-id>/<container-id>-json.log`
- **Windows**: `C:\ProgramData\Docker\containers\<container-id>\<container-id>-json.log`
- **macOS**: `~/Library/Containers/com.docker.docker/Data/vms/0/data/docker/containers/<container-id>/<container-id>-json.log`

### 清理日志

```bash
# 清理所有容器日志
docker-compose -f docker-compose.multistage.yml down
docker system prune -a --volumes

# 手动清理特定容器日志
docker inspect --format='{{.LogPath}}' iopaint-cpu
# 然后删除该文件（需要 root 权限）
```

---

## 💻 资源限制

### CPU 版本资源限制

```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'        # 最多使用 4 个 CPU 核心
      memory: 8G         # 最多使用 8GB 内存
    reservations:
      cpus: '1.0'        # 至少保证 1 个 CPU 核心
      memory: 2G         # 至少保证 2GB 内存
```

### GPU 版本资源限制

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1       # 使用 1 个 GPU
          capabilities: [gpu]
      cpus: '2.0'
      memory: 4G
    limits:
      cpus: '8.0'        # 最多使用 8 个 CPU 核心
      memory: 16G        # 最多使用 16GB 内存
```

### 调整资源限制

根据实际需求修改配置文件中的资源限制：

```bash
# 编辑配置文件
vim docker-compose.multistage.yml

# 重启服务使配置生效
docker-compose -f docker-compose.multistage.yml up -d --force-recreate
```

---

## 🏥 健康检查

### 健康检查配置

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/server-config"]
  interval: 30s          # 每 30 秒检查一次
  timeout: 10s           # 10 秒内必须响应
  retries: 3             # 连续失败 3 次才标记为 unhealthy
  start_period: 60s      # 启动后 60 秒才开始检查
```

### 查看健康状态

```bash
# 查看容器健康状态
docker-compose -f docker-compose.multistage.yml ps

# 查看详细健康检查日志
docker inspect --format='{{json .State.Health}}' iopaint-cpu | jq
```

### 健康状态说明

- **starting**: 容器正在启动，还未开始健康检查
- **healthy**: 容器健康，服务正常运行
- **unhealthy**: 容器不健康，可能需要重启

当容器标记为 `unhealthy` 时，Docker 会根据 `restart` 策略自动重启容器。

---

## 🛠️ 常用命令

### 服务管理

```bash
# 启动服务
docker-compose -f docker-compose.multistage.yml up -d

# 停止服务
docker-compose -f docker-compose.multistage.yml stop

# 重启服务
docker-compose -f docker-compose.multistage.yml restart

# 停止并删除服务
docker-compose -f docker-compose.multistage.yml down

# 强制重新创建容器
docker-compose -f docker-compose.multistage.yml up -d --force-recreate
```

### 日志查看

```bash
# 查看实时日志
docker-compose -f docker-compose.multistage.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.multistage.yml logs -f iopaint-cpu

# 查看最近 N 行日志
docker-compose -f docker-compose.multistage.yml logs --tail=100
```

### 状态监控

```bash
# 查看服务状态
docker-compose -f docker-compose.multistage.yml ps

# 查看资源使用情况
docker stats iopaint-cpu iopaint-gpu

# 查看容器详细信息
docker inspect iopaint-cpu
```

### 镜像管理

```bash
# 构建镜像
docker-compose -f docker-compose.multistage.yml build

# 拉取镜像
docker-compose -f docker-compose.multistage.yml pull

# 查看镜像
docker images | grep iopaint
```

---

## 🔧 故障排查

### 1. 容器无法启动

**检查日志：**
```bash
docker-compose -f docker-compose.multistage.yml logs iopaint-cpu
```

**常见原因：**
- 端口被占用：修改 `ports` 配置
- 资源不足：调整 `deploy.resources` 配置
- 镜像不存在：运行 `docker-compose build`

### 2. 服务频繁重启

**查看健康检查状态：**
```bash
docker inspect --format='{{json .State.Health}}' iopaint-cpu | jq
```

**可能原因：**
- 健康检查失败：检查服务是否正常启动
- 资源不足：增加资源限制
- 配置错误：检查环境变量配置

### 3. 日志文件过大

**检查日志大小：**
```bash
docker inspect --format='{{.LogPath}}' iopaint-cpu
ls -lh $(docker inspect --format='{{.LogPath}}' iopaint-cpu)
```

**解决方法：**
- 调整 `logging.options.max-size` 配置
- 减少 `logging.options.max-file` 数量
- 手动清理日志文件

### 4. GPU 版本无法使用 GPU

**检查 NVIDIA Docker 运行时：**
```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

**可能原因：**
- 未安装 nvidia-docker2
- NVIDIA 驱动版本不兼容
- Docker 配置未启用 GPU 支持

---

## 📚 参考资料

- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Docker 日志驱动](https://docs.docker.com/config/containers/logging/configure/)
- [Docker 健康检查](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [NVIDIA Container Toolkit](https://github.com/NVIDIA/nvidia-docker)

