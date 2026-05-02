export interface VisionProvider {
  name: string;
  describeImage(base64Image: string, apiKey: string): Promise<string>;
}
