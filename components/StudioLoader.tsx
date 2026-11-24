"use client";

import dynamic from "next/dynamic";

// The studio touches window, AudioContext, MediaRecorder and canvas APIs,
// so it is only ever rendered on the client.
const Studio = dynamic(() => import("./Studio"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-full items-center justify-center text-sm tracking-widest text-zinc-500">
      LOADING SIMULATIONS…
    </div>
  ),
});

export default function StudioLoader() {
  return <Studio />;
}
