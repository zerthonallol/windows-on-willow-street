// Voiced story content: intro cutscene + ghost caretaker dialogue. Audio lives in /public/voice/<lang>/<id>.wav
export type Lang = "ru" | "en";
type T = Record<Lang, string>;

export const CUTSCENE: { id: string; text: T }[] = [
  { id: "intro1", text: {
    ru: "Машина заглохла посреди леса. Ливень, на дороге ни души… и телефон не ловит. А за деревьями — огни.",
    en: "My car died in the middle of the woods. Pouring rain, not a soul on the road… and no signal. But past the trees — lights.",
  } },
  { id: "intro2", text: {
    ru: "Старый парк «Весёлые Горки». Закрыт с восемьдесят седьмого. Но кто-то включил там свет… Я просто хотел позвонить.",
    en: "The old Happy Hills amusement park. Closed since eighty-seven. But someone turned the lights on… I just wanted to make a call.",
  } },
  { id: "intro3", text: {
    ru: "Ворота захлопнулись за моей спиной. И тогда я увидел его. Один оранжевый глаз в темноте.",
    en: "The gate slammed shut behind me. And that's when I saw him. One orange eye in the dark.",
  } },
];

export type Speaker = "ghost" | "player";
export interface Line { id: string; who: Speaker; text: T }
export interface Choice { id: string; text: T; reply: Line; when?: "notes" | "gens"; action?: "release" | "keeper"; once?: boolean }

export const GHOST_HELLO: Line = { id: "g_hello", who: "ghost", text: {
  ru: "Ещё один… Не бойся меня, сынок. Бойся его. Я сторож этого парка. Был когда-то.",
  en: "Another one… Don't be afraid of me, kid. Be afraid of him. I'm the caretaker of this park. Used to be.",
} };

export const CHOICES: Choice[] = [
  { id: "p_who", text: { ru: "Кто ты такой?", en: "Who are you?" }, reply: { id: "g_who", who: "ghost", text: {
    ru: "Митч. Ночной сторож. Барни поймал меня в ту ночь, в восемьдесят седьмом. С тех пор я не могу уйти.",
    en: "Mitch. Night watchman. Barney got me that night, back in eighty-seven. I haven't been able to leave since.",
  } } },
  { id: "p_how", text: { ru: "Как отсюда выбраться?", en: "How do I get out of here?" }, reply: { id: "g_how", who: "ghost", text: {
    ru: "Три щитка. Предохранитель, шестерня и механический ключ. Запустишь все — ворота откроются. Но гул его разбудит.",
    en: "Three fuse boxes. A fuse, a cog and a wind-up key. Power them all and the gate opens. But the hum will wake him.",
  } } },
  { id: "p_bear", text: { ru: "Что не так с этим медведем?", en: "What's wrong with that bear?" }, reply: { id: "g_bear", who: "ghost", text: {
    ru: "Внутри Барни застрял мальчик. Томми. Найди все три записи и возвращайся. Я знаю, как его отпустить.",
    en: "There's a boy trapped inside Barney. Tommy. Find all three records and come back. I know how to set him free.",
  } } },
  { id: "p_notes", when: "notes", action: "release", text: { ru: "Я нашёл все записи.", en: "I found all the records." }, reply: { id: "g_release", who: "ghost", text: {
    ru: "Значит, ты знаешь правду. Когда он придёт — не беги. Не свети ему в глаз. Просто позволь подойти… и назови его имя.",
    en: "Then you know the truth. When he comes — don't run. Don't shine the light in his eye. Just let him come close… and say his name.",
  } } },
  { id: "p_keeper", when: "gens", action: "keeper", text: { ru: "Я останусь вместо тебя.", en: "I'll stay in your place." }, reply: { id: "g_keeper", who: "ghost", text: {
    ru: "Ты… правда? Сорок лет я ждал этих слов. Держи фонарь, сторож. Теперь это твой парк.",
    en: "You… really? Forty years I've waited to hear that. Take the lantern, watchman. This is your park now.",
  } } },
  { id: "p_bye", text: { ru: "Мне пора.", en: "I have to go." }, reply: { id: "g_bye", who: "ghost", text: {
    ru: "Держись подальше от света. Он идёт на свет.",
    en: "Stay out of the light. He follows the light.",
  } } },
];

// Cassette found in the park; voiced as an old field recording.
export const TAPE: { id: string; text: T } = { id: "tape1", text: {
  ru: "…*шипение*… Он реагирует на свет. Если светишь прямо в глаз — идёт к тебе. И на шум тоже: когда запускаешь щиток, он слышит гул через весь парк. …Прячься в шкафчиках или под столом в операторской, пока не пройдёт мимо. Только не дай ему увидеть, куда ты залез… И ещё. У шпрехшталмейстера в вагончике осталась рация. Дай ей питание — может, кто-нибудь услышит. *щелчок*",
  en: "…*static*… He follows light. Shine in his eye and he comes for you. Noise too: a running fuse box can be heard across the park. Hide in lockers or under the operator room table until he passes. Don't let him see you hide… One more thing. The ringmaster's wagon still has a radio. Get it some power — maybe someone will hear. *click*",
} };

export const voiceUrl = (lang: Lang, id: string) => `/voice/${lang}/${id}.wav`;

// Prologue in the player's 7th-floor apartment; voiced, played before the park intro.
export type ApartmentVoice = "narr" | "news" | "ghost";
export const APARTMENT: Record<string, { who: ApartmentVoice; text: T }> = {
  a_wake: { who: "narr", text: {
    ru: "Третью ночь не сплю. Седьмой этаж, а дождь лупит в стёкла так, будто хочет войти. Сегодня ровно сорок лет с той ночи.",
    en: "Third night without sleep. Seventh floor, and the rain hammers the glass like it wants in. Tonight it's been exactly forty years.",
  } },
  a_tv: { who: "news", text: {
    ru: "…и к другим новостям. Жители окраины снова сообщают о свете в заброшенном парке «Весёлые Горки». Парк закрыт с восемьдесят седьмого года, после исчезновения восьмилетнего Томми. Мальчика так и не нашли.",
    en: "…in other news. Residents again report lights inside the abandoned Happy Hills park. The park has been closed since nineteen eighty-seven, when eight-year-old Tommy disappeared. The boy was never found.",
  } },
  a_photo: { who: "narr", text: {
    ru: "Мы с Томми. Лето восемьдесят седьмого. Я тогда убежал от медведя… а он — нет. Я всем говорил, что внутри костюма кто-то был. Никто не поверил.",
    en: "Me and Tommy. Summer of eighty-seven. I outran the bear that night… he didn't. I told everyone someone was inside that suit. Nobody believed me.",
  } },
  a_phone: { who: "ghost", text: {
    ru: "…Это Митч. Сторож. Помнишь меня, сынок? Барни снова проснулся. Он ищет того, кто тогда сбежал. Приезжай… пока он не пришёл за тобой сам.",
    en: "…It's Mitch. The watchman. Remember me, kid? Barney's awake again. He's looking for the one who got away. Come to the park… before he comes for you.",
  } },
  a_window: { who: "narr", text: {
    ru: "Митч погиб в ту же ночь. Я сам видел его имя в газете. Тогда кто мне звонит?.. А там, над крышами — огни. Парк снова горит.",
    en: "Mitch died that same night. I saw his name in the paper myself. So who's calling me?.. And there, past the rooftops — lights. The park is lit again.",
  } },
  a_keys: { who: "narr", text: {
    ru: "Ключи от машины и фонарик. Если не поеду сейчас — не поеду никогда.",
    en: "Car keys and the flashlight. If I don't go now, I never will.",
  } },
  a_door: { who: "narr", text: {
    ru: "В подъезде пахнет сыростью. Лифт опять не работает. Ничего. Семь этажей вниз — и в парк.",
    en: "The stairwell smells of damp. The elevator's dead again. Fine. Seven floors down — and on to the park.",
  } },
};
