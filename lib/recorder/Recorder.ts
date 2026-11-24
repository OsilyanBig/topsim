/**
 * Records the 9:16 canvas + Web Audio output into a single video file
 * using canvas.captureStream() and MediaRecorder.
 */

const CANDIDATES: { mime: string; ext: string }[] = [
  { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { mime: "video/mp4;codecs=avc1,opus", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

export function pickFormat(prefer: "mp4" | "webm" = "mp4"): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const list = prefer === "webm" ? [...CANDIDATES].sort((a) => (a.ext === "webm" ? -1 : 1)) : CANDIDATES;
  for (const c of list) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype
  );
}

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  startedAt = 0;
  format: { mime: string; ext: string } | null = null;

  get recording(): boolean {
    return !!this.rec && this.rec.state === "recording";
  }

  start(
    canvas: HTMLCanvasElement,
    audio: MediaStream | null,
    opts: { fps?: number; bitrate?: number; prefer?: "mp4" | "webm" } = {},
  ): boolean {
    if (this.recording || !recordingSupported()) return false;
    const fmt = pickFormat(opts.prefer);
    if (!fmt) return false;
    const video = canvas.captureStream(opts.fps ?? 60);
    const tracks: MediaStreamTrack[] = [...video.getVideoTracks()];
    if (audio) tracks.push(...audio.getAudioTracks());
    this.stream = new MediaStream(tracks);
    this.chunks = [];
    try {
      this.rec = new MediaRecorder(this.stream, {
        mimeType: fmt.mime,
        videoBitsPerSecond: opts.bitrate ?? 12_000_000,
        audioBitsPerSecond: 192_000,
      });
    } catch {
      try {
        this.rec = new MediaRecorder(this.stream);
      } catch {
        return false;
      }
    }
    this.format = fmt;
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.start(250);
    this.startedAt = performance.now();
    return true;
  }

  elapsed(): number {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  stop(): Promise<{ blob: Blob; ext: string } | null> {
    const rec = this.rec;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const type = this.format?.mime.split(";")[0] ?? "video/webm";
        const blob = new Blob(this.chunks, { type });
        // stop only the video track (the audio track belongs to the audio engine)
        this.stream?.getVideoTracks().forEach((t) => t.stop());
        this.rec = null;
        this.stream = null;
        this.chunks = [];
        resolve({ blob, ext: this.format?.ext ?? "webm" });
      };
      rec.stop();
    });
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
