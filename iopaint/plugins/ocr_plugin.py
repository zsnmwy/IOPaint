import uuid
from typing import List, Dict, Any
import numpy as np
from loguru import logger

from iopaint.plugins.base_plugin import BasePlugin
from iopaint.schema import RunPluginRequest


class OCRPlugin(BasePlugin):
    """
    OCR Plugin for text detection using EasyOCR
    """
    name = "OCR"
    support_gen_mask = False  # This plugin only detects text regions, doesn't generate masks
    support_gen_image = False

    def __init__(self, device: str = "cpu", languages: List[str] = None):
        """
        Initialize OCR Plugin
        
        Args:
            device: Device to run OCR on ('cpu' or 'cuda')
            languages: List of languages to detect (default: ['ch_sim', 'en'])
        """
        super().__init__()
        self.device = device
        self.languages = languages or ['ch_sim', 'en']
        self.reader = None
        self._init_reader()

    def _init_reader(self):
        """Initialize EasyOCR reader"""
        try:
            import easyocr
            gpu = self.device != "cpu"
            logger.info(f"Initializing EasyOCR with languages: {self.languages}, GPU: {gpu}")
            self.reader = easyocr.Reader(self.languages, gpu=gpu)
            logger.info("EasyOCR initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            raise

    def check_dep(self):
        """Check if EasyOCR is installed"""
        try:
            import easyocr
            return None
        except ImportError:
            return (
                "EasyOCR is not installed. Please install it with: pip install easyocr"
            )

    def detect_text(self, rgb_np_img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect text regions in the image
        
        Args:
            rgb_np_img: RGB numpy array image
            
        Returns:
            List of text regions with format:
            [
                {
                    "id": "unique_id",
                    "bbox": {"x": 100, "y": 200, "width": 150, "height": 50},
                    "text": "detected text",
                    "confidence": 0.95
                }
            ]
        """
        if self.reader is None:
            raise RuntimeError("EasyOCR reader not initialized")

        try:
            logger.info(f"Starting text detection on image with shape: {rgb_np_img.shape}")
            
            # EasyOCR expects RGB image
            results = self.reader.readtext(rgb_np_img)
            
            text_regions = []
            for idx, (bbox, text, confidence) in enumerate(results):
                # bbox is a list of 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                # Convert to rectangle format (x, y, width, height)
                x_coords = [point[0] for point in bbox]
                y_coords = [point[1] for point in bbox]
                
                x = int(min(x_coords))
                y = int(min(y_coords))
                width = int(max(x_coords) - x)
                height = int(max(y_coords) - y)
                
                # Ensure minimum size
                if width < 5 or height < 5:
                    logger.warning(f"Skipping too small text region: {width}x{height}")
                    continue
                
                region = {
                    "id": str(uuid.uuid4()),
                    "bbox": {
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height
                    },
                    "text": text,
                    "confidence": float(confidence)
                }
                text_regions.append(region)
                logger.debug(f"Detected text region {idx}: {text} at ({x}, {y}, {width}, {height})")
            
            logger.info(f"Detected {len(text_regions)} text regions")
            return text_regions
            
        except Exception as e:
            logger.error(f"Text detection failed: {e}")
            raise

    def gen_image(self, rgb_np_img, req: RunPluginRequest) -> np.ndarray:
        """Not implemented for OCR plugin"""
        raise NotImplementedError("OCR plugin does not generate images")

    def gen_mask(self, rgb_np_img, req: RunPluginRequest) -> np.ndarray:
        """Not implemented for OCR plugin"""
        raise NotImplementedError("OCR plugin does not generate masks")

    def switch_model(self, new_model_name: str):
        """Switch OCR model (not implemented yet)"""
        logger.warning("Model switching not implemented for OCR plugin")
        pass

