export {};

declare global {
  interface Window {
    /** HeroStage 调试句柄（见 components/HeroStage.tsx） */
    __hero?: {
      readonly intensity: number;
      readonly isSelf: boolean;
      readonly images: {
        clothed: HTMLImageElement;
        training: HTMLImageElement;
      } | null;
      readonly size: { w: number; h: number };
      bodyAlpha: (nx: number, ny: number) => number;
      tick: () => void;
    };
  }
}
