import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/states"
import { Loader2, FileText, X, Plus, Trash2 } from "lucide-react"

export const TextDetectionButton = () => {
  const [isDetecting, detectText, isTextDetectionMode, exitTextDetectionMode] =
    useStore((state) => [
      state.textDetectionState.isDetecting,
      state.detectText,
      state.textDetectionState.isTextDetectionMode,
      state.exitTextDetectionMode,
    ])

  const handleClick = () => {
    if (isTextDetectionMode) {
      exitTextDetectionMode()
    } else {
      detectText()
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isDetecting}
      variant={isTextDetectionMode ? "default" : "outline"}
      size="sm"
      className="gap-2"
    >
      {isDetecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          检测中...
        </>
      ) : isTextDetectionMode ? (
        <>
          <X className="h-4 w-4" />
          退出文字检测
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          检测文字
        </>
      )}
    </Button>
  )
}

export const TextDetectionToolbar = () => {
  const [
    isTextDetectionMode,
    detectedRegions,
    addTextRegion,
    clearTextRegions,
    removeText,
    isInpainting,
  ] = useStore((state) => [
    state.textDetectionState.isTextDetectionMode,
    state.textDetectionState.detectedRegions,
    state.addTextRegion,
    state.clearTextRegions,
    state.removeText,
    state.isInpainting,
  ])

  if (!isTextDetectionMode) {
    return null
  }

  const hasRegions = detectedRegions.length > 0

  return (
    <div className="flex items-center gap-2 p-2 bg-background border rounded-lg">
      <span className="text-sm text-muted-foreground">
        已检测到 {detectedRegions.length} 个文字区域
      </span>

      <div className="flex-1" />

      <Button
        onClick={addTextRegion}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        添加区域
      </Button>

      <Button
        onClick={clearTextRegions}
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!hasRegions}
      >
        <Trash2 className="h-4 w-4" />
        清除所有
      </Button>

      <Button
        onClick={removeText}
        variant="default"
        size="sm"
        disabled={!hasRegions || isInpainting}
        className="gap-2"
      >
        {isInpainting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            处理中...
          </>
        ) : (
          <>移除文字</>
        )}
      </Button>
    </div>
  )
}

