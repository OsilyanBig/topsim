"use client";

import { SOUND_PROFILES, type SoundProfile } from "@/lib/audio/AudioEngine";
import { CATEGORIES, SIMULATIONS, simsByCategory } from "@/simulations/registry";
import { CATEGORY_LABELS } from "@/simulations/types";

export type AutoMode = "t15" | "t30" | "t60" | "complete" | "balls";

export const AUTO_MODES: { id: AutoMode; label: string }[] = [
  { id: "t15", label: "15 saniye" },
  { id: "t30", label: "30 saniye" },
  { id: "t60", label: "60 saniye" },
  { id: "complete", label: "Olay: simülasyon tamamlanınca" },
  { id: "balls", label: "Eşik: top sayısına ulaşınca" },
];

export interface PanelState {
  simIndex: number;
  paused: boolean;
  speed: number;
  trails: boolean;
  quality: 720 | 1080;
  autoLoop: boolean;
  audioOn: boolean;
  volume: number;
  profile: SoundProfile | "auto";
  recording: boolean;
  autoActive: boolean;
  autoMode: AutoMode;
  ballThreshold: number;
  recSupported: boolean;
  recFormat: string;
  fps: number;
  balls: number;
}

interface Props {
  s: PanelState;
  set: <K extends keyof PanelState>(k: K, v: PanelState[K]) => void;
  onSelect(i: number): void;
  onPrev(): void;
  onNext(): void;
  onRestart(): void;
  onToggleRecord(): void;
  onAutoRecord(): void;
  onClose(): void;
  onFullscreen(): void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-800/80 px-4 py-3">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Btn({
  children,
  onClick,
  active,
  danger,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick(): void;
  active?: boolean;
  danger?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        danger
          ? "bg-red-600 text-white hover:bg-red-500"
          : active
            ? "bg-zinc-100 text-zinc-900 hover:bg-white"
            : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-300">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-emerald-500" : "bg-zinc-700"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

const selectCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-400";

export default function ControlPanel(p: Props) {
  const { s, set } = p;
  const sim = SIMULATIONS[s.simIndex];
  return (
    <aside className="panel-scroll fixed inset-y-0 right-0 z-30 flex w-[320px] max-w-[88vw] flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 backdrop-blur md:static md:z-auto md:h-full md:max-w-none md:rounded-2xl md:border">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm font-black tracking-wider text-white">TOPSIM STUDIO</div>
          <div className="text-[10px] text-zinc-500">
            {SIMULATIONS.length} simülasyon · {s.fps} FPS · {s.balls} top
          </div>
        </div>
        <button
          type="button"
          onClick={p.onClose}
          className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
          title="Paneli gizle (H)"
        >
          Gizle ✕
        </button>
      </div>

      <Section title="Simülasyon">
        <select className={selectCls} value={s.simIndex} onChange={(e) => p.onSelect(Number(e.target.value))}>
          {CATEGORIES.map((c) => (
            <optgroup key={c} label={CATEGORY_LABELS[c]}>
              {simsByCategory(c).map(({ sim: d, index }) => (
                <option key={d.id} value={index}>
                  {String(index + 1).padStart(2, "0")} · {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-[11px] leading-snug text-zinc-400">{sim.description}</p>
        <div className="flex gap-2">
          <Btn onClick={p.onPrev} title="Önceki (↑)">
            ↑ Önceki
          </Btn>
          <Btn onClick={p.onNext} title="Sonraki (↓)">
            ↓ Sonraki
          </Btn>
          <Btn onClick={p.onRestart} title="Yeniden başlat (R)">
            {sim.id === "chaos-mix" ? "🎲 Yeni Senaryo" : "↻ Restart"}
          </Btn>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => set("paused", !s.paused)} active={s.paused} title="Duraklat (Space)">
            {s.paused ? "▶ Devam" : "❚❚ Duraklat"}
          </Btn>
          <Btn onClick={p.onFullscreen} title="Tam ekran (F)">
            ⛶ Tam ekran
          </Btn>
        </div>
      </Section>

      <Section title="Video Kayıt (9:16)">
        {!s.recSupported && (
          <p className="rounded-md bg-amber-900/40 p-2 text-[11px] text-amber-200">
            Bu tarayıcı canvas kaydını desteklemiyor. Chrome / Edge / güncel Safari önerilir.
          </p>
        )}
        <div className="flex gap-2">
          <Btn onClick={p.onToggleRecord} danger={s.recording && !s.autoActive} className="flex-1" title="Kayıt (V)">
            {s.recording && !s.autoActive ? "■ Durdur & İndir" : "● Manuel Kayıt"}
          </Btn>
        </div>
        <label className="block text-[11px] text-zinc-400">Otomatik kayıt bitişi</label>
        <select className={selectCls} value={s.autoMode} onChange={(e) => set("autoMode", e.target.value as AutoMode)}>
          {AUTO_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {s.autoMode === "balls" && (
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span>Top eşiği</span>
            <input
              type="number"
              min={10}
              max={1200}
              step={10}
              value={s.ballThreshold}
              onChange={(e) => set("ballThreshold", Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
            />
          </div>
        )}
        <Btn onClick={p.onAutoRecord} danger={s.autoActive} className="w-full">
          {s.autoActive ? "■ Otomatik kaydı iptal et & indir" : "⏺ Otomatik Kayıt (baştan başlat)"}
        </Btn>
        <p className="text-[10px] leading-snug text-zinc-500">
          Otomatik kayıt simülasyonu sıfırlar, kaydı başlatır ve koşul gerçekleşince dosyayı indirir. Format: {s.recFormat || "—"}. Ses
          kayda dahildir.
        </p>
      </Section>

      <Section title="Ses (ASMR)">
        <Toggle label="Ses açık (M)" value={s.audioOn} onChange={(v) => set("audioOn", v)} />
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="w-14">Seviye</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={s.volume}
            onChange={(e) => set("volume", Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
        </div>
        <select className={selectCls} value={s.profile} onChange={(e) => set("profile", e.target.value as SoundProfile | "auto")}>
          <option value="auto">Otomatik (simülasyona göre: {SOUND_PROFILES.find((x) => x.id === sim.sound)?.label})</option>
          {SOUND_PROFILES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Görünüm & Performans">
        <Toggle label="Hareket izi (trail)" value={s.trails} onChange={(v) => set("trails", v)} />
        <Toggle label="Bitince otomatik yeniden başlat" value={s.autoLoop} onChange={(v) => set("autoLoop", v)} />
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="w-14">Hız</span>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={s.speed}
            onChange={(e) => set("speed", Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
          <span className="w-10 text-right tabular-nums">{s.speed.toFixed(2)}x</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="w-14">Çözünürlük</span>
          <select className={selectCls} value={s.quality} onChange={(e) => set("quality", Number(e.target.value) as 720 | 1080)}>
            <option value={1080}>1080 × 1920 (Full HD)</option>
            <option value={720}>720 × 1280 (hızlı)</option>
          </select>
        </div>
      </Section>

      <Section title="Kısayollar">
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-zinc-400">
          <li>↑ / ↓ : geçiş</li>
          <li>Swipe / tekerlek : geçiş</li>
          <li>Tıkla : etkileşim</li>
          <li>Space : duraklat</li>
          <li>R : restart</li>
          <li>H : paneli gizle</li>
          <li>M : ses</li>
          <li>V : kayıt</li>
          <li>F : tam ekran</li>
        </ul>
      </Section>
    </aside>
  );
}
