"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { drawWorld } from "@/lib/engine/render";
import { H, W, World } from "@/lib/engine/world";
import { Recorder, downloadBlob, pickFormat, recordingSupported } from "@/lib/recorder/Recorder";
import { SIMULATIONS, findSimIndex } from "@/simulations/registry";
import type { SimDef, SimInstance } from "@/simulations/types";
import { tapSpawn } from "@/simulations/helpers";
import ControlPanel, { type PanelState } from "./ControlPanel";

const N = SIMULATIONS.length;
const MAX_AUTO_SECONDS = 120;

interface AutoRec {
  mode: PanelState["autoMode"];
  threshold: number;
  tailUntil: number | null;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const worldRef = useRef<World | null>(null);
  const instRef = useRef<SimInstance | null>(null);
  const defRef = useRef<SimDef>(SIMULATIONS[0]);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const recRef = useRef<Recorder>(new Recorder());
  const autoRef = useRef<AutoRec | null>(null);

  const [state, setState] = useState<PanelState>(() => ({
    simIndex: 0,
    paused: false,
    speed: 1,
    trails: true,
    quality: 1080,
    autoLoop: true,
    audioOn: true,
    volume: 0.7,
    profile: "auto",
    recording: false,
    autoActive: false,
    autoMode: "t30",
    ballThreshold: 512,
    recSupported: recordingSupported(),
    recFormat: pickFormat()?.ext.toUpperCase() ?? "",
    fps: 60,
    balls: 0,
  }));
  const stateRef = useRef(state);
  stateRef.current = state;

  const [panelOpen, setPanelOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  const [stageSize, setStageSize] = useState({ w: 360, h: 640 });
  const [recElapsed, setRecElapsed] = useState(0);
  const [titleKey, setTitleKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const set = useCallback(<K extends keyof PanelState>(k: K, v: PanelState[K]) => {
    setState((s) => ({ ...s, [k]: v }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ------------------------------------------------------------ simulation lifecycle
  const loadSim = useCallback((index: number, showTitle: boolean) => {
    const def = SIMULATIONS[((index % N) + N) % N];
    const world = new World();
    const audio = audioRef.current;
    world.sfx = (kind, intensity, r, x) => audio.play(kind, intensity, r, x);
    const inst = def.create(world);
    world.hooks = inst;
    worldRef.current = world;
    instRef.current = inst;
    defRef.current = def;
    audio.simProfile = def.sound;
    if (showTitle) setTitleKey((k) => k + 1);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${def.id}`);
    }
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (autoRef.current) return; // don't switch during auto recording
      const i = ((index % N) + N) % N;
      setState((s) => ({ ...s, simIndex: i }));
      loadSim(i, true);
      audioRef.current.play("whoosh", 0.6, 20, 540);
    },
    [loadSim],
  );

  const next = useCallback(() => goTo(stateRef.current.simIndex + 1), [goTo]);
  const prev = useCallback(() => goTo(stateRef.current.simIndex - 1), [goTo]);
  const restart = useCallback(() => loadSim(stateRef.current.simIndex, false), [loadSim]);

  // initial sim from URL hash
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    const i = id ? findSimIndex(id) : -1;
    const start = i >= 0 ? i : 0;
    setState((s) => ({ ...s, simIndex: start }));
    loadSim(start, true);
  }, [loadSim]);

  // ------------------------------------------------------------ audio settings
  useEffect(() => {
    const a = audioRef.current;
    a.setEnabled(state.audioOn);
    a.setVolume(state.volume);
    a.profile = state.profile;
  }, [state.audioOn, state.volume, state.profile]);

  // ------------------------------------------------------------ canvas resolution
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = state.quality === 1080 ? W : 720;
    c.height = state.quality === 1080 ? H : 1280;
  }, [state.quality]);

  // ------------------------------------------------------------ stage fit (9:16)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      let h = r.height;
      let w = (h * 9) / 16;
      if (w > r.width) {
        w = r.width;
        h = (w * 16) / 9;
      }
      setStageSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ------------------------------------------------------------ recording
  const stopRecording = useCallback(
    async (reason?: string) => {
      const rec = recRef.current;
      autoRef.current = null;
      const res = await rec.stop();
      setState((s) => ({ ...s, recording: false, autoActive: false }));
      setRecElapsed(0);
      if (res && res.blob.size > 0) {
        const def = defRef.current;
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        downloadBlob(res.blob, `topsim-${def.id}-${ts}.${res.ext}`);
        showToast(`${reason ? reason + " · " : ""}Video indirildi (${(res.blob.size / 1e6).toFixed(1)} MB, ${res.ext.toUpperCase()})`);
      }
    },
    [showToast],
  );

  const startRecording = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const audio = audioRef.current;
    audio.ensure();
    const ok = recRef.current.start(canvas, audio.stream, {
      fps: 60,
      bitrate: stateRef.current.quality === 1080 ? 14_000_000 : 8_000_000,
    });
    if (!ok) {
      showToast("Kayıt başlatılamadı: tarayıcı desteklemiyor.");
      return false;
    }
    setState((s) => ({ ...s, recording: true, recFormat: recRef.current.format?.ext.toUpperCase() ?? s.recFormat }));
    return true;
  }, [showToast]);

  const toggleRecord = useCallback(() => {
    if (recRef.current.recording) void stopRecording();
    else startRecording();
  }, [startRecording, stopRecording]);

  const autoRecord = useCallback(() => {
    if (autoRef.current || recRef.current.recording) {
      void stopRecording("Kayıt durduruldu");
      return;
    }
    audioRef.current.ensure();
    loadSim(stateRef.current.simIndex, false);
    const s = stateRef.current;
    autoRef.current = { mode: s.autoMode, threshold: s.ballThreshold, tailUntil: null };
    if (startRecording()) setState((st) => ({ ...st, autoActive: true, paused: false }));
    else autoRef.current = null;
  }, [loadSim, startRecording, stopRecording]);

  // ------------------------------------------------------------ main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let fpsAcc = 0;
    let fpsFrames = 0;
    let uiT = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1 / 30) dt = 1 / 30;
      if (dt <= 0) return;
      const world = worldRef.current;
      const inst = instRef.current;
      const canvas = canvasRef.current;
      if (!world || !inst || !canvas) return;
      const s = stateRef.current;

      if (!s.paused) {
        const sdt = dt * s.speed;
        inst.update?.(sdt);
        world.step(sdt);
      }

      // auto restart after completion
      if (world.completed && !autoRef.current && s.autoLoop && world.autoRestart && world.t - world.completeAt > 3.5) {
        loadSim(s.simIndex, false);
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const scale = canvas.width / W;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(ctx, world, defRef.current, inst, { trails: s.trails });
      }

      // auto record conditions
      const auto = autoRef.current;
      const rec = recRef.current;
      if (auto && rec.recording) {
        const el = rec.elapsed();
        const w2 = worldRef.current!;
        let done: string | null = null;
        if (auto.mode === "t15" && el >= 15) done = "15 sn";
        else if (auto.mode === "t30" && el >= 30) done = "30 sn";
        else if (auto.mode === "t60" && el >= 60) done = "60 sn";
        else if (auto.mode === "complete" || auto.mode === "balls") {
          const hit = auto.mode === "complete" ? w2.completed : w2.count >= auto.threshold;
          if (hit && auto.tailUntil === null) auto.tailUntil = el + 2;
          if (auto.tailUntil !== null && el >= auto.tailUntil) done = auto.mode === "complete" ? "Olay tamamlandı" : `${auto.threshold} top`;
          if (el >= MAX_AUTO_SECONDS) done = "Maks. süre";
        }
        if (done) void stopRecording(done);
      }

      fpsAcc += dt;
      fpsFrames++;
      uiT += dt;
      if (uiT > 0.25) {
        uiT = 0;
        const fps = Math.round(fpsFrames / fpsAcc);
        fpsAcc = 0;
        fpsFrames = 0;
        const balls = world.count;
        setState((st) => (st.fps === fps && st.balls === balls ? st : { ...st, fps, balls }));
        setRecElapsed(rec.recording ? rec.elapsed() : 0);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loadSim, stopRecording]);

  // ------------------------------------------------------------ input
  const fullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      audioRef.current.ensure();
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case " ":
          e.preventDefault();
          setState((s) => ({ ...s, paused: !s.paused }));
          break;
        case "r":
        case "R":
          restart();
          break;
        case "h":
        case "H":
          setPanelOpen((o) => !o);
          break;
        case "m":
        case "M":
          setState((s) => ({ ...s, audioOn: !s.audioOn }));
          break;
        case "v":
        case "V":
          toggleRecord();
          break;
        case "f":
        case "F":
          fullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, restart, toggleRecord, fullscreen]);

  const down = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const toWorld = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    audioRef.current.ensure();
    down.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.3 && performance.now() - d.t < 800) {
      if (dy < 0) next();
      else prev();
      return;
    }
    const p = toWorld(d.x, d.y);
    const inst = instRef.current;
    const world = worldRef.current;
    if (!inst || !world) return;
    if (inst.pointer) inst.pointer(p.x, p.y);
    else tapSpawn(world, p.x, p.y, 12, defRef.current.accent);
  };

  const wheelAcc = useRef({ v: 0, last: 0 });
  const onWheel = (e: React.WheelEvent) => {
    const now = performance.now();
    const w = wheelAcc.current;
    if (now - w.last < 650) return;
    w.v += e.deltaY;
    if (Math.abs(w.v) > 80) {
      if (w.v > 0) next();
      else prev();
      w.v = 0;
      w.last = now;
    }
  };

  const def = SIMULATIONS[state.simIndex];

  return (
    <main className="flex h-dvh w-full items-stretch gap-4 bg-[#050509] p-0 md:p-4">
      <div ref={areaRef} className="relative flex min-w-0 flex-1 items-center justify-center">
        <div
          ref={stageRef}
          className="stage-root relative overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.6)] md:rounded-2xl"
          style={{ width: stageSize.w, height: stageSize.h }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="stage-canvas block h-full w-full"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (down.current = null)}
            onWheel={onWheel}
          />

          {/* DOM overlays are NOT part of the recorded canvas */}
          {state.recording && (
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-bold text-white ring-1 ring-red-500/60">
              <span className="rec-dot inline-block h-3 w-3 rounded-full bg-red-500" />
              REC {fmtTime(recElapsed)}
              {state.autoActive && <span className="text-[10px] font-semibold text-red-300">AUTO</span>}
            </div>
          )}

          {titleKey > 0 && !state.recording && (
            <div
              key={titleKey}
              className="title-card pointer-events-none absolute inset-x-0 bottom-[7%] flex flex-col items-center text-center"
            >
              <div className="rounded-xl bg-black/60 px-4 py-2 ring-1 ring-white/10">
                <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-400">
                  #{String(state.simIndex + 1).padStart(2, "0")} / {N}
                </div>
                <div className="text-base font-black text-white">{def.name}</div>
              </div>
            </div>
          )}

          {state.paused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 px-5 py-2 text-sm font-bold tracking-widest text-white">PAUSED</div>
            </div>
          )}

          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="absolute right-2 top-2 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/50 transition hover:bg-black/70 hover:text-white"
              title="Kontrol paneli (H)"
            >
              ⚙
            </button>
          )}

          {toast && (
            <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
              <div className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white">{toast}</div>
            </div>
          )}
        </div>
      </div>

      {panelOpen && (
        <>
          <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setPanelOpen(false)} />
          <ControlPanel
            s={state}
            set={set}
            onSelect={goTo}
            onPrev={prev}
            onNext={next}
            onRestart={restart}
            onToggleRecord={toggleRecord}
            onAutoRecord={autoRecord}
            onClose={() => setPanelOpen(false)}
            onFullscreen={fullscreen}
          />
        </>
      )}
    </main>
  );
}
