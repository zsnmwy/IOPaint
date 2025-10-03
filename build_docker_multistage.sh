#!/usr/bin/env bash
#
# IOPaint Docker Multi-stage Build Script
# 
# Usage:
#   ./build_docker_multistage.sh [cpu|gpu|all] [version]
#
# Examples:
#   ./build_docker_multistage.sh cpu          # Build CPU version with 'latest' tag
#   ./build_docker_multistage.sh gpu 1.6.0    # Build GPU version with '1.6.0' tag
#   ./build_docker_multistage.sh all          # Build both versions
#
# Environment Variables:
#   VERSION   - Image version tag (default: latest)
#   PUSH      - Push to registry after build (default: false)
#   REGISTRY  - Docker registry prefix (default: empty)
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认参数
BUILD_TYPE=${1:-"all"}
VERSION=${2:-${VERSION:-"latest"}}
PUSH=${PUSH:-false}
REGISTRY=${REGISTRY:-""}

# 镜像名称
IMAGE_NAME="iopaint"
if [ -n "$REGISTRY" ]; then
    IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
fi

# 打印函数
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 打印分隔线
print_separator() {
    echo "========================================"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    print_info "Docker version: $(docker --version)"
}

# 检查 Dockerfile 是否存在
check_dockerfile() {
    local type=$1
    local dockerfile="docker/${type}Dockerfile.multistage"
    
    if [ ! -f "$dockerfile" ]; then
        print_error "Dockerfile not found: $dockerfile"
        exit 1
    fi
}

# 构建镜像
build_image() {
    local type=$1
    local dockerfile="docker/${type}Dockerfile.multistage"
    local tag="${IMAGE_NAME}:${type}-${VERSION}"
    local latest_tag="${IMAGE_NAME}:${type}-latest"
    
    print_separator
    print_step "Building ${type} image: ${tag}"
    print_separator
    
    # 记录开始时间
    local start_time=$(date +%s)
    
    # 构建镜像
    docker buildx build \
        --platform linux/amd64 \
        --file "${dockerfile}" \
        --tag "${tag}" \
        --tag "${latest_tag}" \
        --build-arg VERSION="${VERSION}" \
        --label org.opencontainers.image.title="IOPaint" \
        --label org.opencontainers.image.description="Image inpainting tool powered by SOTA AI Model" \
        --label org.opencontainers.image.url="https://github.com/Sanster/IOPaint" \
        --label org.opencontainers.image.source="https://github.com/Sanster/IOPaint" \
        --label org.opencontainers.image.version="${VERSION}" \
        --label org.opencontainers.image.created="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        .
    
    # 记录结束时间
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $? -eq 0 ]; then
        print_separator
        print_info "✓ Successfully built ${tag} in ${duration}s"
        print_separator
        
        # 显示镜像信息
        echo ""
        print_info "Image details:"
        docker images "${IMAGE_NAME}" | grep -E "REPOSITORY|${type}-"
        echo ""
        
        # 显示镜像大小
        local image_size=$(docker images "${tag}" --format "{{.Size}}")
        print_info "Image size: ${image_size}"
        
        # 推送镜像（如果需要）
        if [ "$PUSH" = "true" ]; then
            print_separator
            print_step "Pushing ${tag} to registry..."
            docker push "${tag}"
            docker push "${latest_tag}"
            print_info "✓ Successfully pushed ${tag}"
        fi
        
        return 0
    else
        print_separator
        print_error "✗ Failed to build ${tag}"
        print_separator
        return 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
IOPaint Docker Multi-stage Build Script

Usage:
    $0 [cpu|gpu|all] [version]

Arguments:
    cpu         Build CPU version only
    gpu         Build GPU version only
    all         Build both CPU and GPU versions (default)
    version     Image version tag (default: latest)

Environment Variables:
    VERSION     Image version tag (default: latest)
    PUSH        Push to registry after build (default: false)
    REGISTRY    Docker registry prefix (default: empty)

Examples:
    $0 cpu                    # Build CPU version with 'latest' tag
    $0 gpu 1.6.0              # Build GPU version with '1.6.0' tag
    $0 all                    # Build both versions
    VERSION=1.6.0 $0 all      # Build both versions with '1.6.0' tag
    PUSH=true $0 cpu          # Build and push CPU version

EOF
}

# 主逻辑
main() {
    # 显示帮助
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_help
        exit 0
    fi
    
    print_separator
    print_info "IOPaint Docker Multi-stage Build Script"
    print_separator
    print_info "Build Type: ${BUILD_TYPE}"
    print_info "Version: ${VERSION}"
    print_info "Push: ${PUSH}"
    if [ -n "$REGISTRY" ]; then
        print_info "Registry: ${REGISTRY}"
    fi
    print_separator
    echo ""
    
    # 检查 Docker
    check_docker
    echo ""
    
    # 构建镜像
    case "$BUILD_TYPE" in
        cpu)
            check_dockerfile "CPU"
            build_image "cpu"
            ;;
        gpu)
            check_dockerfile "GPU"
            build_image "gpu"
            ;;
        all)
            check_dockerfile "CPU"
            check_dockerfile "GPU"
            build_image "cpu" && build_image "gpu"
            ;;
        *)
            print_error "Invalid build type: ${BUILD_TYPE}"
            echo ""
            show_help
            exit 1
            ;;
    esac
    
    # 最终总结
    if [ $? -eq 0 ]; then
        echo ""
        print_separator
        print_info "✓ Build completed successfully!"
        print_separator
        echo ""
        print_info "You can now run the container with:"
        if [ "$BUILD_TYPE" = "cpu" ] || [ "$BUILD_TYPE" = "all" ]; then
            echo "  docker run -p 8080:8080 ${IMAGE_NAME}:cpu-${VERSION}"
        fi
        if [ "$BUILD_TYPE" = "gpu" ] || [ "$BUILD_TYPE" = "all" ]; then
            echo "  docker run --gpus all -p 8080:8080 ${IMAGE_NAME}:gpu-${VERSION}"
        fi
        echo ""
    else
        echo ""
        print_separator
        print_error "✗ Build failed!"
        print_separator
        exit 1
    fi
}

# 执行主函数
main "$@"

