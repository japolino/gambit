/**
 * The models the vendored cut-out and depth run (from Cue,
 * visual-novel-preview origin/testing @ 150abe7, src/shared/sprites.ts).
 * The cut-out's model store keeps Cue's cache names on purpose: on the same
 * Lumiverse origin a model Cue already downloaded is not downloaded again.
 */

/** ISNet-anime (anime figure segmentation), float32. */
export const CUTOUT_MODEL_URL = "https://huggingface.co/skytnt/anime-seg/resolve/main/isnetis.onnx";
/** The same model in half precision (88 MB): used where it runs at full speed. */
export const CUTOUT_MODEL_F16_URL = "https://huggingface.co/onnx-community/anime-seg-ONNX/resolve/main/onnx/model_fp16.onnx";
/** A small anime face detector (YOLOv8): where the face is on a figure. */
export const FACE_MODEL_URL = "https://huggingface.co/deepghs/anime_face_detection/resolve/main/face_detect_v1.4_n/model.onnx";
/** Depth Anything V2 Small, int8 (27 MB, Apache-2.0), pinned to one revision. */
export const DEPTH_MODEL_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model_quantized.onnx";
