export interface DesktopAdapter {
  screenshot(): Promise<Buffer>;
  move(x: number, y: number): Promise<void>;
  click(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  keys(keys: string): Promise<void>;
}
