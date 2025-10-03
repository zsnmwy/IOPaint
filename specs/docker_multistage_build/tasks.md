# Docker 多阶段构建优化 - 实施计划

## 任务概览

本实施计划将 Docker 多阶段构建优化工作拆分为 10 个主要任务，预计总工作量为 12-16 小时。

---

## 任务列表

- [ ] 1. 创建 .dockerignore 文件
  - 创建 `.dockerignore` 文件，配置需要忽略的文件和目录
  - 验证构建上下文大小是否显著减小
  - 测试构建过程是否正常
  - **预计时间**: 30 分钟
  - **依赖**: 无
  - **需求**: 需求 6

- [ ] 2. 编写 CPU 版本多阶段 Dockerfile
  - 创建 `docker/CPUDockerfile.multistage` 文件
  - 实现三阶段构建：前端构建 → Python依赖 → 运行时镜像
  - 配置系统依赖、PyTorch CPU 版本、应用代码复制
  - 设置健康检查和启动命令
  - **预计时间**: 2 小时
  - **依赖**: 任务 1
  - **需求**: 需求 1, 2, 4

- [ ] 3. 编写 GPU 版本多阶段 Dockerfile
  - 创建 `docker/GPUDockerfile.multistage` 文件
  - 基于 NVIDIA CUDA 基础镜像实现三阶段构建
  - 配置 CUDA 版本的 PyTorch 和 xformers
  - 设置 GPU 相关的启动参数
  - **预计时间**: 1.5 小时
  - **依赖**: 任务 2
  - **需求**: 需求 1, 3, 4

- [ ] 4. 编写构建脚本
  - 创建 `build_docker_multistage.sh` 脚本
  - 实现 CPU/GPU/All 三种构建模式
  - 添加颜色输出、错误处理、镜像信息显示
  - 支持版本号参数和镜像推送功能
  - **预计时间**: 2 小时
  - **依赖**: 任务 2, 3
  - **需求**: 需求 5

- [ ] 5. 本地构建测试 - CPU 版本
  - 执行 CPU 版本镜像构建
  - 验证构建过程无错误
  - 检查镜像大小是否符合预期（< 3GB）
  - 记录构建时间（首次和缓存）
  - **预计时间**: 1 小时
  - **依赖**: 任务 2, 4
  - **需求**: 需求 2, 9

- [ ] 6. 本地构建测试 - GPU 版本
  - 执行 GPU 版本镜像构建
  - 验证构建过程无错误
  - 检查镜像大小是否符合预期（< 5GB）
  - 记录构建时间（首次和缓存）
  - **预计时间**: 1 小时
  - **依赖**: 任务 3, 4
  - **需求**: 需求 3, 9

- [ ] 7. 功能测试 - CPU 版本
  - 启动 CPU 版本容器
  - 验证 Web UI 是否正常加载
  - 测试图片上传和 inpainting 功能
  - 测试模型切换功能
  - 验证数据卷挂载是否正常
  - **预计时间**: 1.5 小时
  - **依赖**: 任务 5
  - **需求**: 需求 2, 4, 7, 8

- [ ] 8. 功能测试 - GPU 版本（可选）
  - 启动 GPU 版本容器（需要 NVIDIA Docker Runtime）
  - 验证 GPU 是否被正确识别
  - 测试 GPU 加速的 inpainting 功能
  - 对比 CPU 和 GPU 的推理速度
  - **预计时间**: 1.5 小时
  - **依赖**: 任务 6
  - **需求**: 需求 3, 7, 8
  - **注意**: 需要 NVIDIA GPU 环境

- [ ] 9. 创建 Docker Compose 配置
  - 创建 `docker-compose.yml` 文件
  - 配置 CPU 和 GPU 两个服务
  - 设置环境变量、数据卷、端口映射
  - 测试 docker-compose 启动是否正常
  - **预计时间**: 1 小时
  - **依赖**: 任务 7, 8
  - **需求**: 需求 7, 8

- [ ] 10. 更新文档
  - 更新 README.md 的 Docker 使用说明
  - 创建 docs/docker-multistage.md 详细文档
  - 添加常见问题和故障排查指南
  - 更新构建脚本的使用说明
  - **预计时间**: 2 小时
  - **依赖**: 任务 9
  - **需求**: 需求 10

---

## 任务详细说明

### 任务 1: 创建 .dockerignore 文件

#### 具体步骤
1. 在项目根目录创建 `.dockerignore` 文件
2. 添加以下内容：
   - Git 相关文件（.git, .gitignore）
   - Python 临时文件（__pycache__, *.pyc, venv/）
   - Node.js 相关（node_modules/, npm-debug.log）
   - 前端构建产物（web_app/dist/）
   - IDE 配置（.vscode/, .idea/）
   - 文档和测试（docs/, specs/, iopaint/tests/）

#### 验收标准
- [ ] `.dockerignore` 文件已创建
- [ ] 执行 `docker build` 时，构建上下文大小减少至少 50%
- [ ] 构建过程正常，无文件缺失错误

#### 测试命令
```bash
# 查看构建上下文大小
docker build --no-cache -f docker/CPUDockerfile.multistage -t test . 2>&1 | grep "Sending build context"
```

---

### 任务 2: 编写 CPU 版本多阶段 Dockerfile

#### 具体步骤
1. 创建 `docker/CPUDockerfile.multistage` 文件
2. 实现 Stage 1: 前端构建
   - 使用 `node:18-alpine` 作为基础镜像
   - 复制 `web_app/package*.json` 并执行 `npm ci`
   - 复制前端源码并执行 `npm run build`
3. 实现 Stage 2: Python 依赖安装
   - 使用 `python:3.10-slim-bookworm` 作为基础镜像
   - 安装构建工具（gcc, g++, build-essential）
   - 安装 PyTorch CPU 版本和其他依赖
4. 实现 Stage 3: 运行时镜像
   - 使用 `python:3.10-slim-bookworm` 作为基础镜像
   - 安装运行时系统依赖
   - 从 Stage 2 复制 Python 包
   - 从 Stage 1 复制前端构建产物
   - 复制应用代码并安装
   - 配置健康检查和启动命令

#### 验收标准
- [ ] Dockerfile 文件已创建
- [ ] 三个构建阶段定义清晰
- [ ] 系统依赖安装正确
- [ ] PyTorch CPU 版本安装正确
- [ ] 前端资源正确复制到 `iopaint/web_app`
- [ ] 健康检查配置正确
- [ ] 启动命令使用 `--host 0.0.0.0`

#### 关键代码片段
```dockerfile
# Stage 1: Frontend Builder
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web_app
COPY web_app/package*.json ./
RUN npm ci
COPY web_app/ ./
RUN npm run build

# Stage 2: Python Builder
FROM python:3.10-slim-bookworm AS python-builder
# ... (详见设计文档)

# Stage 3: Runtime
FROM python:3.10-slim-bookworm
# ... (详见设计文档)
```

---

### 任务 3: 编写 GPU 版本多阶段 Dockerfile

#### 具体步骤
1. 创建 `docker/GPUDockerfile.multistage` 文件
2. Stage 1 和 Stage 2 与 CPU 版本类似，但：
   - Stage 2 使用 CUDA 版本的 PyTorch
   - 额外安装 xformers
3. Stage 3 使用 `nvidia/cuda:11.8.0-runtime-ubuntu22.04`
4. 默认启动命令使用 `--device cuda`

#### 验收标准
- [ ] Dockerfile 文件已创建
- [ ] 使用 NVIDIA CUDA 基础镜像
- [ ] PyTorch CUDA 版本安装正确
- [ ] xformers 安装正确
- [ ] 默认设备设置为 cuda

#### 关键差异
```dockerfile
# Stage 2: Python Builder (GPU)
RUN pip install --no-cache-dir --user \
    torch==2.1.2 torchvision==0.16.2 \
    --index-url https://download.pytorch.org/whl/cu118 && \
    pip install --no-cache-dir --user \
    xformers==0.0.23.post1 \
    --index-url https://download.pytorch.org/whl/cu118

# Stage 3: Runtime (GPU)
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04
# ...
CMD ["python", "-m", "iopaint", "start", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--model", "lama", \
     "--device", "cuda"]
```

---

### 任务 4: 编写构建脚本

#### 具体步骤
1. 创建 `build_docker_multistage.sh` 脚本
2. 实现参数解析（cpu/gpu/all）
3. 实现颜色输出函数（print_info, print_warn, print_error）
4. 实现构建函数（build_image）
5. 添加镜像信息显示
6. 添加可选的镜像推送功能

#### 验收标准
- [ ] 脚本文件已创建并添加执行权限
- [ ] 支持 cpu/gpu/all 三种构建模式
- [ ] 输出信息清晰，带颜色区分
- [ ] 构建失败时返回非零退出码
- [ ] 构建成功后显示镜像信息

#### 测试命令
```bash
# 赋予执行权限
chmod +x build_docker_multistage.sh

# 测试 CPU 构建
./build_docker_multistage.sh cpu

# 测试 GPU 构建
./build_docker_multistage.sh gpu

# 测试全部构建
./build_docker_multistage.sh all
```

---

### 任务 5-6: 本地构建测试

#### 具体步骤
1. 清理 Docker 缓存（可选）
2. 执行首次构建并记录时间
3. 修改一个 Python 文件，重新构建并记录时间（验证缓存）
4. 修改一个前端文件，重新构建并记录时间（验证缓存）
5. 检查镜像大小

#### 验收标准
- [ ] 首次构建成功，时间 < 15 分钟（CPU）/ 20 分钟（GPU）
- [ ] 缓存构建时间 < 5 分钟
- [ ] 镜像大小 < 3GB（CPU）/ 5GB（GPU）
- [ ] 无构建错误或警告

#### 测试命令
```bash
# 清理缓存
docker builder prune -af

# 首次构建（记录时间）
time ./build_docker_multistage.sh cpu

# 查看镜像大小
docker images iopaint:cpu-latest

# 修改文件后重新构建
echo "# test" >> iopaint/cli.py
time ./build_docker_multistage.sh cpu
git checkout iopaint/cli.py
```

---

### 任务 7-8: 功能测试

#### 具体步骤
1. 启动容器
2. 访问 Web UI (http://localhost:8080)
3. 上传测试图片
4. 执行 inpainting 操作
5. 测试模型切换
6. 测试数据卷挂载
7. 测试环境变量配置

#### 验收标准
- [ ] 容器启动成功，无错误日志
- [ ] Web UI 正常加载，所有资源加载成功
- [ ] 图片上传功能正常
- [ ] Inpainting 功能正常，结果符合预期
- [ ] 模型切换功能正常
- [ ] 数据卷挂载正常，文件持久化
- [ ] 环境变量配置生效

#### 测试命令
```bash
# 启动 CPU 容器
docker run -d --name iopaint-test \
  -p 8080:8080 \
  -v $(pwd)/test_models:/app/models \
  -v $(pwd)/test_outputs:/app/outputs \
  -e MODEL=lama \
  iopaint:cpu-latest

# 查看日志
docker logs -f iopaint-test

# 测试 API
curl http://localhost:8080/api/v1/server-config

# 清理
docker stop iopaint-test
docker rm iopaint-test
```

---

### 任务 9: 创建 Docker Compose 配置

#### 具体步骤
1. 创建 `docker-compose.yml` 文件
2. 配置 `iopaint-cpu` 服务
3. 配置 `iopaint-gpu` 服务（包含 GPU 资源配置）
4. 配置共享的数据卷
5. 测试启动和停止

#### 验收标准
- [ ] `docker-compose.yml` 文件已创建
- [ ] CPU 服务配置正确
- [ ] GPU 服务配置正确（包含 GPU 资源声明）
- [ ] 数据卷配置正确
- [ ] `docker-compose up` 启动成功
- [ ] `docker-compose down` 停止成功

#### 测试命令
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

### 任务 10: 更新文档

#### 具体步骤
1. 更新 `README.md`
   - 添加多阶段构建的说明
   - 更新 Docker 使用示例
2. 创建 `docs/docker-multistage.md`
   - 详细的构建说明
   - 配置选项说明
   - 常见问题和故障排查
3. 更新 `build_docker_multistage.sh` 的注释

#### 验收标准
- [ ] README.md 已更新，包含新的 Docker 使用说明
- [ ] docs/docker-multistage.md 已创建，内容完整
- [ ] 所有示例命令经过验证，可以正常执行
- [ ] 包含常见问题和解决方案

#### 文档结构
```markdown
# Docker 多阶段构建使用指南

## 快速开始
## 构建镜像
## 运行容器
## 配置选项
## 数据持久化
## 常见问题
## 故障排查
```

---

## 风险与注意事项

### 风险 1: 镜像体积超出预期
- **影响**: 镜像过大，下载和部署缓慢
- **缓解措施**: 
  - 使用 slim/runtime 基础镜像
  - 清理 apt 缓存和临时文件
  - 使用 `--no-cache-dir` 安装 pip 包

### 风险 2: 构建时间过长
- **影响**: 开发迭代效率低
- **缓解措施**:
  - 优化 Dockerfile 层级顺序
  - 充分利用 Docker 缓存
  - 使用 BuildKit 并行构建

### 风险 3: GPU 环境测试受限
- **影响**: 无法充分测试 GPU 版本
- **缓解措施**:
  - 确保 Dockerfile 语法正确
  - 参考官方 NVIDIA Docker 文档
  - 在 CI/CD 中添加 GPU 测试

### 风险 4: 前端构建失败
- **影响**: 镜像构建失败
- **缓解措施**:
  - 确保 package.json 和 package-lock.json 同步
  - 使用固定版本的 Node.js
  - 在本地先测试前端构建

---

## 成功标准

- [x] 所有 10 个任务完成
- [ ] CPU 和 GPU 镜像构建成功
- [ ] 镜像大小符合预期
- [ ] 功能测试全部通过
- [ ] 文档完整且经过验证
- [ ] 至少一次完整的端到端测试

---

## 时间估算汇总

| 任务 | 预计时间 | 累计时间 |
|------|---------|---------|
| 任务 1 | 0.5 小时 | 0.5 小时 |
| 任务 2 | 2 小时 | 2.5 小时 |
| 任务 3 | 1.5 小时 | 4 小时 |
| 任务 4 | 2 小时 | 6 小时 |
| 任务 5 | 1 小时 | 7 小时 |
| 任务 6 | 1 小时 | 8 小时 |
| 任务 7 | 1.5 小时 | 9.5 小时 |
| 任务 8 | 1.5 小时 | 11 小时 |
| 任务 9 | 1 小时 | 12 小时 |
| 任务 10 | 2 小时 | 14 小时 |
| **总计** | **14 小时** | |

---

## 下一步行动

1. ✅ 需求文档已确认
2. ✅ 技术方案已确认
3. ✅ 任务拆分已完成
4. ⏭️ **开始执行任务 1: 创建 .dockerignore 文件**

