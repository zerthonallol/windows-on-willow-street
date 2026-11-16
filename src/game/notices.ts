// Paper notices in the stairwell: what they say (RU/EN) and how they are painted onto canvas.
import type { Lang } from "./story";

export type NoticeStyle = "typed" | "hand" | "old";
export interface Notice { title: Record<Lang, string>; body: Record<Lang, string>; style: NoticeStyle; tabs?: string }

export const NOTICES = {
  hotwater: {
    style: "typed",
    title: { ru: "ВНИМАНИЕ, ЖИЛЬЦЫ!", en: "ATTENTION, RESIDENTS!" },
    body: {
      ru: "С 17 по 30 ноября в связи с ремонтом теплотрассы горячая вода будет отключена.\nПриносим извинения за временные неудобства.\n\nЖЭК №4",
      en: "From November 17 to 30 the hot water will be shut off for heating-main repairs.\nWe apologise for the inconvenience.\n\nHousing Office No. 4",
    },
  },
  dog: {
    style: "hand",
    tabs: "2-14-87",
    title: { ru: "ПРОПАЛА СОБАКА!", en: "LOST DOG!" },
    body: {
      ru: "Рыжий пёс, кличка Тузик. Левое ухо порвано.\nУбежал в сторону старого парка и не вернулся.\nНашедшему — вознаграждение!\nТел. 2-14-87",
      en: "Ginger dog named Tuzik. Torn left ear.\nRan off towards the old park and never came back.\nReward for the finder!\nPhone 2-14-87",
    },
  },
  meeting: {
    style: "typed",
    title: { ru: "СОБРАНИЕ ЖИЛЬЦОВ", en: "RESIDENTS' MEETING" },
    body: {
      ru: "В четверг в 19:00 у второго подъезда.\nПовестка:\n1) ремонт крыши;\n2) кто опять курит на лестнице;\n3) кто по ночам катает коляску по первому этажу?\n\nСтарший по дому",
      en: "Thursday, 7 PM, by entrance two.\nAgenda:\n1) roof repairs;\n2) who keeps smoking on the stairs;\n3) who rolls a pram around the ground floor at night?\n\nBuilding warden",
    },
  },
  missing: {
    style: "old",
    title: { ru: "РАЗЫСКИВАЕТСЯ", en: "MISSING" },
    body: {
      ru: "14 ноября 1987 г. ушёл из дома и не вернулся Томми Ч., 8 лет.\nБыл одет в жёлтую куртку и соломенную шляпу.\nПоследний раз его видели у ворот парка «Весёлые горки».\nЗнающих что-либо просим сообщить в милицию: 02.",
      en: "On November 14, 1987, Tommy C., age 8, left home and never returned.\nHe wore a yellow jacket and a straw hat.\nHe was last seen at the gates of Happy Hills park.\nAnyone with information, please call the police: 02.",
    },
  },
  lift: {
    style: "typed",
    title: { ru: "ЛИФТ НЕ РАБОТАЕТ", en: "LIFT OUT OF ORDER" },
    body: {
      ru: "Ремонт по заявке №118. Мастер будет «на неделе».\nНе стучите по дверям и не кричите в шахту —\nвас всё равно никто не слышит.\n\nЖЭК №4",
      en: "Repair request No. 118. The technician will come \"this week\".\nDo not bang on the doors or shout into the shaft —\nnobody can hear you anyway.\n\nHousing Office No. 4",
    },
  },
  chute: {
    style: "hand",
    title: { ru: "МУСОРОПРОВОД", en: "RUBBISH CHUTE" },
    body: {
      ru: "Мусор мимо не бросать!\nПосле полуночи люк не открывать —\nжильцы жалуются на звуки снизу.",
      en: "Do not drop rubbish beside it!\nDo not open the hatch after midnight —\nresidents complain about noises from below.",
    },
  },
  timetable: {
    style: "typed",
    title: { ru: "ОСТАНОВКА «ПАРК»", en: "STOP: \"THE PARK\"" },
    body: {
      ru: "Автобус №13 «Вокзал — Весёлые Горки»\nПо выходным: 9:00, 11:30, 14:00, 17:30\n\nС 15.11.1987 маршрут отменён.\n\nКто-то ручкой дописал снизу: «последний рейс так и не вернулся»",
      en: "Bus No. 13 \"Station — Happy Hills\"\nWeekends: 9:00, 11:30, 14:00, 17:30\n\nRoute cancelled from 15.11.1987.\n\nSomeone has added in pen: \"the last run never came back\"",
    },
  },
  watchman: {
    style: "hand",
    title: { ru: "ТРЕБУЕТСЯ СТОРОЖ", en: "NIGHT WATCHMAN WANTED" },
    body: {
      ru: "В парк «Весёлые Горки» требуется ночной сторож.\nЖильё, фонарь и тёплая куртка выдаются.\nОпыт не обязателен. Смена — до рассвета.\nСпросить Митча у главных ворот.",
      en: "Happy Hills park needs a night watchman.\nLodging, lantern and a warm jacket provided.\nNo experience needed. Shift lasts until dawn.\nAsk for Mitch at the main gate.",
    },
  },
  ticket: {
    style: "old",
    title: { ru: "БИЛЕТ · 30 коп.", en: "TICKET · 30 kopecks" },
    body: {
      ru: "Парк культуры и отдыха «Весёлые Горки»\nДетский. Все аттракционы.\n14 ноября 1987 г.\nКорешок не оторван — билетом так никто и не воспользовался.",
      en: "Happy Hills Park of Culture and Leisure\nChild. All rides.\nNovember 14, 1987.\nThe stub was never torn off — nobody ever used this ticket.",
    },
  },
  poster: {
    style: "old",
    title: { ru: "ЦИРК! ТОЛЬКО ОДИН ВЕЧЕР!", en: "CIRCUS! ONE NIGHT ONLY!" },
    body: {
      ru: "Медведь Барни и его друзья!\nКлоуны, акробаты, поющие аниматроники.\nКаждый ребёнок получит воздушный шарик.\nНачало в 20:00. Вход через главные ворота.",
      en: "Barney the Bear and friends!\nClowns, acrobats, singing animatronics.\nEvery child gets a balloon.\nShow starts at 8 PM. Enter by the main gate.",
    },
  },
} satisfies Record<string, Notice>;

export type NoticeId = keyof typeof NOTICES;

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) { out.push(""); continue; }
    let cur = "";
    for (const word of para.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (g.measureText(next).width > maxW && cur) { out.push(cur); cur = word; } else cur = next;
    }
    out.push(cur);
  }
  return out;
}

/** Paints a sheet of paper with a title, wrapped body text and optional tear-off tabs. */
export function paintNotice(g: CanvasRenderingContext2D, w: number, h: number, n: Notice, lang: Lang) {
  const paper = n.style === "old" ? "#cdbf98" : n.style === "hand" ? "#ece8dc" : "#e6e2d4";
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  const age = g.createLinearGradient(0, 0, w, h);
  age.addColorStop(0, "rgba(120,90,40,0.05)"); age.addColorStop(1, n.style === "old" ? "rgba(90,60,20,0.35)" : "rgba(120,90,40,0.14)");
  g.fillStyle = age; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(80,60,30,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const ink = n.style === "hand" ? "#1d2a6b" : n.style === "old" ? "#2a2218" : "#1b1b1b";
  const font = n.style === "hand" ? "'Comic Sans MS', 'Segoe Print', cursive" : n.style === "old" ? "Georgia, serif" : "'Courier New', monospace";
  const pad = w * 0.08, tabsH = n.tabs ? h * 0.2 : 0;
  g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "top";
  let ts = Math.round(w * 0.085);
  g.font = `bold ${ts}px ${font}`;
  while (g.measureText(n.title[lang]).width > w - pad * 2 && ts > 8) { ts -= 1; g.font = `bold ${ts}px ${font}`; }
  g.fillText(n.title[lang], w / 2, pad * 0.8);
  if (n.style === "old") { g.fillStyle = "rgba(40,30,20,0.55)"; g.fillRect(w * 0.3, pad + ts * 1.3, w * 0.4, h * 0.22); g.fillStyle = ink; }
  let bs = Math.round(w * 0.05);
  const top = pad + ts * 1.5 + (n.style === "old" ? h * 0.25 : 0);
  let lines: string[] = [];
  for (; bs > 6; bs--) {
    g.font = `${bs}px ${font}`;
    lines = wrap(g, n.body[lang], w - pad * 2);
    if (top + lines.length * bs * 1.25 < h - tabsH - pad * 0.5) break;
  }
  g.textAlign = "left";
  lines.forEach((l, i) => g.fillText(l, pad, top + i * bs * 1.25));
  if (n.tabs) {
    const count = 8, tw = w / count;
    g.save();
    for (let i = 0; i < count; i++) {
      if (i === 2 || i === 5) { g.clearRect(i * tw, h - tabsH, tw, tabsH); continue; }
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.moveTo(i * tw, h - tabsH); g.lineTo(i * tw, h); g.stroke();
      g.save(); g.translate(i * tw + tw * 0.62, h - tabsH * 0.08); g.rotate(-Math.PI / 2);
      g.font = `${Math.round(tw * 0.42)}px ${font}`; g.fillStyle = ink; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(n.tabs, 0, 0);
      g.restore();
    }
    g.restore();
  }
}
