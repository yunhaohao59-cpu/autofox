export interface EdgeResult {
  buffer: Buffer;
  width: number;
  height: number;
  originalSize: number;
  edgeSize: number;
}

export class SimpleEdgeDetector {
  async detect(image: Buffer): Promise<EdgeResult> {
    return {
      buffer: image,
      width: 0,
      height: 0,
      originalSize: image.length,
      edgeSize: image.length,
    };
  }
}
