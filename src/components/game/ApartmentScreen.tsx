import { useEffect, useRef, useState } from "react";
import type { Apartment, AptHud } from "@/game/Apartment";
import type { Game } from "@/game/Game";
import type { Lang } from "@/game/story";
import { TouchControls } from "./TouchControls";
import loadingImg from "@/assets/apartment/loading.jpg";

// Prologue: loading picture -> 7th-floor apartment -> onDone sends the player to the main game.
export function ApartmentScreen({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const apt = useRef<Apartment | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [hud, setHud] = useState<AptHud | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const L = (ru: string, en: string) => (lang === "ru" ? ru : en);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    let alive = true;
    import("@/game/Apartment").then(({ Apartment }) => {
      if (!alive || !box.current) return;
      apt.current = new Apartment(box.current, {
        onHud: setHud, onProgress: setProgress,
        onReady: () => setTimeout(() => alive && setReady(true), 900),
        onDone: () => setTimeout(() => alive && onDone(), 1500),
      }, lang);
    });
    return () => { alive = false; apt.current?.dispose(); apt.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = () => { setEntered(true); apt.current?.lock(); };

  return (
    <div className="absolute inset-0 z-30 bg-background">
      <div ref={box} className="absolute inset-0" onClick={() => entered && apt.current?.lock()} />
      {entered && hud && (
        <div className="pointer-events-none absolute inset-0 p-4 text-sm md:p-6">
          {hud.objective && <div className="panel-glass inline-block rounded px-4 py-2"><span className="text-muted-foreground">{L("Цель", "Goal")}: </span>{hud.objective}</div>}
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70" />
          {hud.prompt && <div className={`absolute left-0 w-full text-center text-lg ${isTouch ? "bottom-40" : "bottom-28"}`}><span className="panel-glass rounded px-3 py-1">{isTouch ? "" : "[E] "}{hud.prompt}</span></div>}
          {hud.subtitle && <div className="absolute bottom-10 left-0 w-full px-6 text-center"><span className="cutscene-caption inline-block max-w-3xl rounded px-4 py-2 text-base md:text-lg">{hud.subtitle}</span></div>}
          {hud.paused && !isTouch && <div className="absolute inset-0 grid place-items-center bg-background/60 font-display text-2xl">{L("Кликните, чтобы продолжить", "Click to continue")}</div>}
          <div className="absolute inset-0 bg-background" style={{ opacity: hud.fade }} />
        </div>
      )}
      {entered && hud && isTouch && (
        <TouchControls game={apt as unknown as React.MutableRefObject<Game | null>} prompt={hud.prompt} flashlight={hud.flashlight} onInventory={() => {}} />
      )}
      {!entered && (
        <div className="absolute inset-0 z-10">
          <img src={loadingImg} alt="" className="h-full w-full animate-pulse object-cover [animation-duration:4s]" />
          <div className="cutscene-caption absolute inset-x-0 bottom-0 px-6 pb-10 pt-24 text-center">
            <p className="mx-auto max-w-2xl text-muted-foreground">{L("23:41. Седьмой этаж. Ливень не прекращается третьи сутки…", "11:41 PM. Seventh floor. The downpour hasn't stopped in three days…")}</p>
            {ready ? (
              <button onClick={enter} className="mt-6 font-display text-2xl tracking-widest text-foreground hover:text-accent">{L("Нажмите, чтобы начать", "Click to begin")}</button>
            ) : (
              <div className="mx-auto mt-6 h-1 w-64 overflow-hidden rounded bg-muted">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
