// Hook bank for Paige: every hook is about HER (the girl watching), not about Paige.
// Paige's life is the proof; the girl is the subject. She should think "that's literally me"
// or "that's who i'm becoming". Written in Paige's voice: casual, honest, a little cheeky, lowercase.
// p = pillar, t = type, f = format, her = the thought it hits, r = what it makes her do, k = words that make it a match.

export const HOOKS = [
  // ---- becoming her
  { text: "if you've had 'move abroad' in your notes app for two years, this is for you", p: "becoming", t: "moving abroad", f: "callout", her: "one day i'll move abroad", r: "share", k: ["move", "moved", "abroad", "australia", "uk", "notes", "plan"] },
  { text: "you're not behind. you're just in the part nobody films", p: "becoming", t: "honest yap", f: "emotive", her: "am i wasting my 20s?", r: "save", k: ["behind", "late", "20s", "age", "time", "figured"] },
  { text: "if your life looks fine on paper but feels a bit small, watch this", p: "becoming", t: "honest yap", f: "callout", her: "is this it?", r: "share", k: ["stuck", "same", "routine", "small", "fine", "bored", "life"] },
  { text: "the girl you're scared to become is honestly having the best time", p: "becoming", t: "personal growth", f: "identity", her: "i want more but i'm scared", r: "save", k: ["scared", "scary", "brave", "become", "change"] },
  { text: "things you stop doing when you finally pick yourself", p: "becoming", t: "personal growth", f: "identity", her: "i always put myself last", r: "save", k: ["stopped", "stop", "myself", "choose", "pick"] },
  { text: "you don't need a plan. you need a date and a one-way ticket", p: "becoming", t: "moving abroad", f: "strong", her: "i can't go until i have it all figured out", r: "share", k: ["plan", "ticket", "flight", "moved", "move", "figured"] },
  { text: "if you overthink every decision, this one's for you (i still do)", p: "becoming", t: "honest yap", f: "callout", her: "i overthink everything", r: "comment", k: ["overthink", "overthinking", "decision", "think", "worry"] },
  { text: "the version of you that books the flight is already in there", p: "becoming", t: "voiceover", f: "emotive", her: "i'm not brave enough", r: "save", k: ["flight", "book", "version", "brave", "travel"] },
  { text: "you're allowed to want a bigger life than the one you were handed", p: "becoming", t: "voiceover", f: "emotive", her: "is it greedy to want more?", r: "share", k: ["life", "want", "more", "bigger", "home"] },
  { text: "what nobody tells you about starting again at 22", p: "becoming", t: "moving abroad", f: "age", her: "it's too late to start over", r: "save", k: ["start", "again", "new", "22", "23", "age", "moved"] },
  { text: "if you're 20 to 25 and scared you're wasting your 20s, read this", p: "becoming", t: "honest yap", f: "age", her: "am i wasting my 20s?", r: "save", k: ["20s", "age", "wasting", "young", "years"] },
  { text: "stop waiting to feel ready. ready is a myth, babe", p: "becoming", t: "personal growth", f: "strong", her: "i'll do it when i feel ready", r: "share", k: ["ready", "wait", "waiting", "start", "confidence"] },
  { text: "the friend who 'always wanted to travel' doesn't have to stay that friend", p: "becoming", t: "travel diary", f: "identity", her: "i'm the one who always talks about it", r: "share", k: ["friend", "travel", "always", "wanted"] },
  { text: "if you want your own money and a creative job, this is your sign to start", p: "becoming", t: "online income", f: "callout", her: "a creative career isn't realistic for me", r: "save", k: ["money", "income", "online", "ugc", "job", "work", "creative"] },
  { text: "you're one decision away from a completely different life", p: "becoming", t: "voiceover", f: "emotive", her: "nothing ever changes", r: "save", k: ["decision", "choice", "different", "change", "life"] },

  // ---- style
  { text: "if you know exactly what you'd wear in your head but never actually wear it", p: "style", t: "personal style", f: "callout", her: "i always end up in the same jeans", r: "save", k: ["wear", "outfit", "style", "clothes", "jeans"] },
  { text: "outfits for every version of you (yes, even the one you haven't met yet)", p: "style", t: "fashion finds", f: "identity", her: "i want to dress like the girl i'm becoming", r: "save", k: ["outfit", "outfits", "fashion", "finds", "version"] },
  { text: "3 styling tricks that make you look like you have your life together", p: "style", t: "styling", f: "list", her: "i want to look put together", r: "save", k: ["styling", "tricks", "style", "outfit", "tips"] },
  { text: "dress like the girl who already lives the life you want", p: "style", t: "personal style", f: "identity", her: "i want to feel like her", r: "save", k: ["dress", "style", "life", "outfit", "confidence"] },
  { text: "if you buy clothes then return them because they don't feel like 'you'", p: "style", t: "personal style", f: "callout", her: "i don't know what my style is", r: "comment", k: ["buy", "return", "clothes", "style", "haul"] },
  { text: "pack for the trip like you're the main event (because you are)", p: "style", t: "holiday wardrobe", f: "strong", her: "i never feel good in holiday pics", r: "save", k: ["packing", "pack", "holiday", "trip", "bali", "suitcase"] },
  { text: "the fashion-student trick that makes a cheap outfit look expensive", p: "style", t: "styling", f: "strong", her: "i want to look expensive on a budget", r: "save", k: ["fashion", "trick", "cheap", "expensive", "design"] },
  { text: "you don't need a new wardrobe. you need these 4 pieces", p: "style", t: "styling", f: "list", her: "i have nothing to wear", r: "save", k: ["wardrobe", "pieces", "basics", "outfit"] },

  // ---- experiencing life
  { text: "if you've saved 300 bali videos and booked nothing, this is your sign", p: "experiencing", t: "bali", f: "callout", her: "one day i'll go to bali", r: "share", k: ["bali", "saved", "trip", "book", "travel"] },
  { text: "send this to the friend you keep saying 'we should go' to", p: "experiencing", t: "travel diary", f: "strong", her: "we always say we'll go", r: "share", k: ["friend", "trip", "travel", "go", "bali", "beach"] },
  { text: "a normal tuesday in bali, so you know it's actually possible", p: "experiencing", t: "bali", her: "that life isn't for people like me", r: "follow", k: ["bali", "day", "normal", "tuesday", "life"] },
  { text: "if you think living abroad is only for rich girls, watch how i actually do it", p: "experiencing", t: "moving abroad", f: "callout", her: "i could never afford that", r: "save", k: ["money", "afford", "abroad", "cost", "visa", "australia"] },
  { text: "5 things in bali that'll make you book a one-way ticket", p: "experiencing", t: "bali", f: "list", her: "is it worth it?", r: "save", k: ["bali", "things", "uluwatu", "canggu", "cafe", "beach"] },
  { text: "the trip you keep putting off is the one you'll talk about forever", p: "experiencing", t: "voiceover", f: "emotive", her: "maybe next year", r: "share", k: ["trip", "travel", "putting", "off", "forever"] },
  { text: "if you're thinking about australia, this is your sign to stop thinking", p: "experiencing", t: "australia", f: "callout", her: "should i do a working holiday?", r: "save", k: ["australia", "visa", "working", "holiday", "thinking"] },

  // ---- little life
  { text: "the 6am version of you is closer than you think", p: "little", t: "morning routine", f: "identity", her: "i want to be a morning person", r: "save", k: ["morning", "6am", "routine", "wake", "early"] },
  { text: "you don't need a new life to romanticise this one", p: "little", t: "little moments", f: "emotive", her: "my life is too boring to romanticise", r: "share", k: ["romanticise", "life", "little", "ordinary", "day"] },
  { text: "if you keep starting pilates 'on monday', do class 1 with me", p: "little", t: "pilates", f: "callout", her: "i'll start on monday", r: "follow", k: ["pilates", "class", "monday", "start", "workout", "promise"] },
  { text: "promise 1 of 60: showing up for her (the girl you're becoming)", p: "little", t: "pilates", f: "identity", her: "i never stick to anything", r: "follow", k: ["pilates", "promise", "class", "60", "showing"] },
  { text: "little things that make an ordinary day feel like yours", p: "little", t: "little moments", f: "list", her: "my days all feel the same", r: "save", k: ["little", "things", "day", "ordinary", "coffee", "sunset"] },
  { text: "a slow morning for the girl who's always rushing", p: "little", t: "morning routine", f: "identity", her: "i never have time for me", r: "save", k: ["morning", "slow", "rushing", "coffee", "routine"] },
  { text: "if your weekends disappear on your phone, steal this one", p: "little", t: "day in my life", f: "callout", her: "my weekends feel wasted", r: "save", k: ["weekend", "phone", "day", "life", "vlog"] },
  { text: "things you stop doing when you start showing up for yourself", p: "little", t: "pilates", f: "identity", her: "i let myself down", r: "save", k: ["stop", "showing", "pilates", "habits", "gym"] },

  // ---- funny / relatable / tiktok diary
  { text: "tell me you're a 'one day i'll move abroad' girl without telling me", p: "becoming", t: "funny", her: "that's literally me", r: "comment", k: ["abroad", "move", "one", "day"] },
  { text: "the day you stop talking about it and actually go", p: "experiencing", t: "funny", her: "i want to be that girl", r: "share", k: ["went", "finally", "trip", "moved", "talking"] },
  { text: "if this found you, you're probably planning your escape in your head right now", p: "becoming", t: "funny", f: "callout", her: "i daydream about leaving", r: "comment", k: ["escape", "planning", "leave", "travel", "move"] },
  { text: "girls who have 40 unposted drafts, this one's for you", p: "becoming", t: "online income", f: "callout", her: "i'm too scared to post", r: "comment", k: ["drafts", "post", "posting", "content", "camera", "scared"] },
];

export const FORMATS = [
  { id: "age", name: "Age-based", goal: "make her instantly think: \"she's talking to me.\"",
    formula: "i'm [age]. if you're between [ages], [do / stop doing this] before [milestone].",
    why: "A specific age range makes her recognise herself, and a deadline adds urgency." },
  { id: "list", name: "Lists", goal: "give her a number and a reason to keep watching.",
    formula: "[number] [unexpected word] signs you're [the change she wants].",
    why: "The number promises an easy payoff and the odd word creates curiosity. If you promise 5, deliver 5 (in the video or caption)." },
  { id: "emotive", name: "Emotive quote", goal: "sometimes the feeling IS the content.",
    formula: "i lied. [unexpected confession]. [strong belief]. [identity statement].",
    why: "Gives her a belief she wants to claim as her own. Made for shares. Pair with aesthetic b-roll + audio that matches the emotion." },
  { id: "identity", name: "Identity maxxing", goal: "describe the woman she is, or is becoming.",
    formula: "things i don't do anymore as a [specific identity].",
    why: "The right girl recognises herself or the identity she wants. The wrong girl keeps scrolling. Perfect." },
  { id: "callout", name: "Algorithm call-out", goal: "make finding your reel feel a little too accurate.",
    formula: "if this found you, you're probably [hyper-specific habit, struggle or desire].",
    why: "It feels like a personal call-out, not a generic tip." },
  { id: "strong", name: "Strong language", goal: "sound like her bestie, not a marketing textbook.",
    formula: "[bold, conversational phrase] i did to go from [before] to [after].",
    why: "A slightly unhinged opener plus a result she wants = instant curiosity." },
];

// Caption first lines that work as a second hook (from the trial-reel method).
export const CAPTION_OPENERS = ["the how??? ↓", "wait for number 3", "i almost didn't post this", "why did nobody tell me this", "save this for later", "this one's for the girl who…"];

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9']+/g, " ");

// Picks the hooks that best fit the clip: words you actually said + the series pillar.
export function suggestHooks(transcript, { pillar = null, n = 6, shuffleSeed = 0, mine = [], favs = [] } = {}) {
  const words = new Set(norm(transcript || "").split(/\s+/).filter((w) => w.length > 2));
  const pool = [...mine.map((h) => ({ ...h, k: h.k?.length ? h.k : norm(h.text).split(/\s+/).filter((w) => w.length > 3) })), ...HOOKS];
  const scored = pool.map((h, i) => {
    const hits = (h.k || []).filter((k) => words.has(k)).length;
    const score = hits * 3 + (pillar && h.p === pillar ? 2 : 0) + (favs.includes(h.text) ? 2 : 0) + ((i * 7 + shuffleSeed * 13) % 10) / 10;
    return { ...h, score, hits };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

// Shared prompt pieces so every "Ask Claude" request is written about HER.
export function herBlock(b) {
  const h = b.her || {};
  const list = (h.who || b.strategy?.herLife || []).map((x) => `- ${x}`).join("\n");
  return `WHO I'M TALKING TO (${h.title || "my girl"}): ${b.audience?.who || ""}
Her biggest thought: "${b.audience?.innerThought || ""}"
Everything I know about her:
${list}
Why she watches: ${h.watches || ""}
Why she saves: ${h.saves || ""}
Why she shares: ${h.shares || ""}
Why she follows: ${h.follows || ""}
Why she comments: ${h.comments || ""}`;
}
export const HER_RULES = `RULES FOR HOOKS: write every hook about HER life, not mine. Nobody's lying in bed thinking about my niche; she's thinking about her money, her future, the girl she wants to become. Use "you", "the girl who…", "if you…" or identity statements so she thinks "that's literally me" or "that's who i'm becoming". My story is only the proof. Hit a specific thought from her list. Sound like her bestie, not a coach.`;
