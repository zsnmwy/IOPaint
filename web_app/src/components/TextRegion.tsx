import { useStore } from "@/lib/states"
import { TextRegion as TextRegionType } from "@/lib/types"
import { X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface TextRegionProps {
  region: TextRegionType
  scale: number
  viewportRef: React.RefObject<HTMLDivElement>
  imageWidth: number
  imageHeight: number
}

type DragHandle =
  | "move"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"

export const TextRegionComponent = ({
  region,
  scale,
  viewportRef,
  imageWidth,
  imageHeight,
}: TextRegionProps) => {
  const [updateTextRegion, deleteTextRegion, selectTextRegion, selectedRegionId] =
    useStore((state) => [
      state.updateTextRegion,
      state.deleteTextRegion,
      state.selectTextRegion,
      state.textDetectionState.selectedRegionId,
    ])

  const [isDragging, setIsDragging] = useState(false)
  const [dragHandle, setDragHandle] = useState<DragHandle | null>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragStartBBox = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const isSelected = selectedRegionId === region.id

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: DragHandle) => {
      e.stopPropagation()
      e.preventDefault()

      setIsDragging(true)
      setDragHandle(handle)
      selectTextRegion(region.id)

      dragStartPos.current = { x: e.clientX, y: e.clientY }
      dragStartBBox.current = { ...region.bbox }
    },
    [region.id, region.bbox, selectTextRegion]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragHandle) return

      const deltaX = (e.clientX - dragStartPos.current.x) / scale
      const deltaY = (e.clientY - dragStartPos.current.y) / scale

      const startBBox = dragStartBBox.current
      let newBBox = { ...startBBox }

      // Use actual image dimensions for boundary checking
      const maxWidth = imageWidth
      const maxHeight = imageHeight

      const minSize = 10 // Minimum size for width and height

      switch (dragHandle) {
        case "move":
          newBBox.x = Math.max(0, Math.min(startBBox.x + deltaX, maxWidth - startBBox.width))
          newBBox.y = Math.max(0, Math.min(startBBox.y + deltaY, maxHeight - startBBox.height))
          break

        case "top":
          newBBox.y = Math.max(0, Math.min(startBBox.y + deltaY, startBBox.y + startBBox.height - minSize))
          newBBox.height = startBBox.height - (newBBox.y - startBBox.y)
          break

        case "bottom":
          newBBox.height = Math.max(minSize, Math.min(startBBox.height + deltaY, maxHeight - startBBox.y))
          break

        case "left":
          newBBox.x = Math.max(0, Math.min(startBBox.x + deltaX, startBBox.x + startBBox.width - minSize))
          newBBox.width = startBBox.width - (newBBox.x - startBBox.x)
          break

        case "right":
          newBBox.width = Math.max(minSize, Math.min(startBBox.width + deltaX, maxWidth - startBBox.x))
          break

        case "top-left":
          newBBox.x = Math.max(0, Math.min(startBBox.x + deltaX, startBBox.x + startBBox.width - minSize))
          newBBox.y = Math.max(0, Math.min(startBBox.y + deltaY, startBBox.y + startBBox.height - minSize))
          newBBox.width = startBBox.width - (newBBox.x - startBBox.x)
          newBBox.height = startBBox.height - (newBBox.y - startBBox.y)
          break

        case "top-right":
          newBBox.y = Math.max(0, Math.min(startBBox.y + deltaY, startBBox.y + startBBox.height - minSize))
          newBBox.width = Math.max(minSize, Math.min(startBBox.width + deltaX, maxWidth - startBBox.x))
          newBBox.height = startBBox.height - (newBBox.y - startBBox.y)
          break

        case "bottom-left":
          newBBox.x = Math.max(0, Math.min(startBBox.x + deltaX, startBBox.x + startBBox.width - minSize))
          newBBox.width = startBBox.width - (newBBox.x - startBBox.x)
          newBBox.height = Math.max(minSize, Math.min(startBBox.height + deltaY, maxHeight - startBBox.y))
          break

        case "bottom-right":
          newBBox.width = Math.max(minSize, Math.min(startBBox.width + deltaX, maxWidth - startBBox.x))
          newBBox.height = Math.max(minSize, Math.min(startBBox.height + deltaY, maxHeight - startBBox.y))
          break
      }

      updateTextRegion(region.id, newBBox)
    },
    [isDragging, dragHandle, region.id, scale, updateTextRegion, viewportRef]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragHandle(null)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteTextRegion(region.id)
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectTextRegion(region.id)
  }

  return (
    <div
      className={cn(
        "absolute border-2 transition-colors",
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-yellow-400 bg-yellow-400/10 hover:border-yellow-500"
      )}
      style={{
        left: region.bbox.x * scale,
        top: region.bbox.y * scale,
        width: region.bbox.width * scale,
        height: region.bbox.height * scale,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onClick={handleSelect}
      onMouseDown={(e) => handleMouseDown(e, "move")}
    >
      {/* Edge handles */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/30"
        onMouseDown={(e) => handleMouseDown(e, "top")}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/30"
        onMouseDown={(e) => handleMouseDown(e, "bottom")}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30"
        onMouseDown={(e) => handleMouseDown(e, "left")}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30"
        onMouseDown={(e) => handleMouseDown(e, "right")}
      />

      {/* Corner handles */}
      <div
        className="absolute top-0 left-0 w-3 h-3 bg-blue-500 cursor-nwse-resize rounded-full -translate-x-1/2 -translate-y-1/2"
        onMouseDown={(e) => handleMouseDown(e, "top-left")}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 bg-blue-500 cursor-nesw-resize rounded-full translate-x-1/2 -translate-y-1/2"
        onMouseDown={(e) => handleMouseDown(e, "top-right")}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 cursor-nesw-resize rounded-full -translate-x-1/2 translate-y-1/2"
        onMouseDown={(e) => handleMouseDown(e, "bottom-left")}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-nwse-resize rounded-full translate-x-1/2 translate-y-1/2"
        onMouseDown={(e) => handleMouseDown(e, "bottom-right")}
      />

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
        onClick={handleDelete}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Text label */}
      {region.text && (
        <div
          className="absolute -top-7 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap max-w-xs overflow-hidden text-ellipsis pointer-events-none"
          style={{ fontSize: Math.max(10, 12 / scale) }}
        >
          {region.text}
          {region.confidence < 1 && (
            <span className="ml-1 opacity-70">
              ({Math.round(region.confidence * 100)}%)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const TextRegionsContainer = () => {
  const [detectedRegions, isTextDetectionMode, imageWidth, imageHeight] =
    useStore((state) => [
      state.textDetectionState.detectedRegions,
      state.textDetectionState.isTextDetectionMode,
      state.imageWidth,
      state.imageHeight,
    ])

  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (viewportRef.current && imageWidth && imageHeight) {
      const viewportRect = viewportRef.current.getBoundingClientRect()
      const scaleX = viewportRect.width / imageWidth
      const scaleY = viewportRect.height / imageHeight
      setScale(Math.min(scaleX, scaleY))
    }
  }, [imageWidth, imageHeight])

  if (!isTextDetectionMode || detectedRegions.length === 0) {
    return null
  }

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 pointer-events-none"
      style={{ pointerEvents: isTextDetectionMode ? "auto" : "none" }}
    >
      {detectedRegions.map((region) => (
        <TextRegionComponent
          key={region.id}
          region={region}
          scale={scale}
          viewportRef={viewportRef}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
      ))}
    </div>
  )
}

