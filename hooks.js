// Starter hook bank, written for Paige's voice: casual, honest, a little cheeky, lowercase-friendly.
// Not life-coach, not "that girl". Tags help the editor pick hooks that fit the clip.
// p = pillar (style | becoming | experiencing | little), t = type, k = keywords that make it a good match.

export const HOOKS = [
  // ---- becoming her / moving abroad / growth
  { text: "i moved to the other side of the world with no real plan", p: "becoming", t: "moving abroad", k: ["moved", "move", "australia", "uk", "plan", "abroad", "left"] },
  { text: "nobody tells you how weird it is to start your whole life again at 22", p: "becoming", t: "moving abroad", k: ["start", "again", "new", "life", "moved", "weird"] },
  { text: "the version of me that stayed in the uk would not believe this", p: "becoming", t: "different versions", k: ["uk", "stayed", "version", "home", "believe"] },
  { text: "there are so many versions of your life you could be living", p: "becoming", t: "different versions", k: ["version", "versions", "life", "could", "different"] },
  { text: "i was so scared to do this and honestly it's the best thing i've done", p: "becoming", t: "personal growth", k: ["scared", "scary", "nervous", "best", "decision"] },
  { text: "things i wish someone told me before i moved abroad", p: "becoming", t: "things i wish i knew", k: ["wish", "knew", "moved", "abroad", "before", "tips"] },
  { text: "i didn't have it figured out. i still don't. here's what i know so far", p: "becoming", t: "honest yap", k: ["figured", "know", "honestly", "still", "plan"] },
  { text: "the scariest decisions are usually the ones worth making", p: "becoming", t: "voiceover", k: ["decision", "scared", "scary", "worth", "choice"] },
  { text: "a little reminder from someone who also overthinks everything", p: "becoming", t: "honest yap", k: ["overthink", "overthinking", "worry", "anxious", "think"] },
  { text: "what nobody shows you about building a life abroad", p: "becoming", t: "moving abroad", k: ["abroad", "hard", "lonely", "real", "truth"] },
  { text: "i used to wait until i felt ready. spoiler: you never feel ready", p: "becoming", t: "personal growth", k: ["ready", "wait", "start", "never", "confidence"] },
  { text: "trying to make money online in my 20s, an honest update", p: "becoming", t: "honest yap", k: ["money", "online", "income", "ugc", "work", "job", "business"] },
  { text: "if you feel stuck right now, watch this", p: "becoming", t: "honest yap", k: ["stuck", "routine", "same", "bored", "change"] },
  { text: "the confidence came after, not before", p: "becoming", t: "voiceover", k: ["confidence", "confident", "after", "before", "brave"] },

  // ---- style / fashion
  { text: "outfits for every version of you", p: "style", t: "fashion finds", k: ["outfit", "outfits", "style", "wear", "fashion", "finds"] },
  { text: "styling one piece three ways because i can't stop", p: "style", t: "styling", k: ["styling", "ways", "piece", "style", "wear"] },
  { text: "fashion design graduate rates her own outfits", p: "style", t: "outfit diary", k: ["outfit", "rate", "design", "fashion", "wore"] },
  { text: "everything i wore this week (no repeats, i'm unwell)", p: "style", t: "outfit diary", k: ["week", "wore", "outfits", "repeat"] },
  { text: "the find of the month and i'm being dramatic", p: "style", t: "fashion finds", k: ["find", "found", "obsessed", "bought", "new"] },
  { text: "packing for bali like the outfits are the main itinerary", p: "style", t: "holiday wardrobe", k: ["packing", "pack", "bali", "holiday", "trip", "suitcase"] },
  { text: "i studied fashion so you don't have to: here's the trick", p: "style", t: "styling", k: ["trick", "tip", "fashion", "studied", "design", "fit"] },
  { text: "get ready with me but i change my outfit four times", p: "style", t: "getting ready", k: ["ready", "grwm", "outfit", "change", "makeup"] },
  { text: "dressing for the life you're building, not the one you had", p: "style", t: "personal style", k: ["dress", "style", "life", "building", "confidence"] },

  // ---- experiencing life / travel / bali
  { text: "island diaries: the day i didn't want to end", p: "experiencing", t: "travel diary", k: ["bali", "island", "day", "beach", "sunset"] },
  { text: "a very unproductive (perfect) day in bali", p: "experiencing", t: "bali", k: ["bali", "day", "beach", "pool", "relax"] },
  { text: "said yes to everything this week. here's what happened", p: "experiencing", t: "saying yes", k: ["yes", "week", "spontaneous", "trip", "adventure"] },
  { text: "things that just make sense in bali", p: "experiencing", t: "bali", k: ["bali", "scooter", "cafe", "smoothie", "uluwatu", "canggu"] },
  { text: "frequent flyer, infrequent homebody: a travel day", p: "experiencing", t: "travel day", k: ["flight", "airport", "plane", "travel", "fly"] },
  { text: "the gold coast at 6am hits different", p: "experiencing", t: "australia", k: ["morning", "sunrise", "gold", "coast", "beach", "australia"] },
  { text: "my first solo trip and every thought i had", p: "experiencing", t: "solo", k: ["solo", "alone", "myself", "first", "trip"] },
  { text: "if you're thinking about moving to australia, this is your sign to stop thinking", p: "experiencing", t: "australia", k: ["australia", "visa", "moving", "move", "thinking"] },

  // ---- little life / pilates / routines
  { text: "promise 1 of 60: showing up even when i don't want to", p: "little", t: "pilates", k: ["pilates", "class", "promise", "workout", "showing", "60"] },
  { text: "pilates girlies, how are we feeling about class {n}", p: "little", t: "pilates", k: ["pilates", "class", "sore", "workout", "reformer"] },
  { text: "a slow morning on the coast, no alarms", p: "little", t: "morning routine", k: ["morning", "coffee", "slow", "sunrise", "routine"] },
  { text: "the little things that made today feel good", p: "little", t: "little moments", k: ["little", "today", "things", "good", "day"] },
  { text: "making ordinary days feel like something", p: "little", t: "daily vlog", k: ["day", "ordinary", "normal", "routine", "vlog"] },
  { text: "coffee, sunset, beach walk: the holy trinity", p: "little", t: "little moments", k: ["coffee", "sunset", "beach", "walk"] },
  { text: "a day in my life but i'm honest about the boring bits", p: "little", t: "day in my life", k: ["day", "life", "boring", "honest", "vlog"] },
  { text: "the only stress i want is my next outfit and destination", p: "little", t: "funny", k: ["stress", "outfit", "destination", "travel"] },

  // ---- funny / relatable / tiktok diary
  { text: "unfortunately my entire personality is…", p: "little", t: "funny", k: ["personality", "obsessed", "love", "always"] },
  { text: "storytime: i really should not have done this", p: "becoming", t: "storytime", k: ["storytime", "story", "happened", "should", "mistake"] },
  { text: "tell me you moved abroad without telling me", p: "becoming", t: "funny", k: ["moved", "abroad", "uk", "australia", "british"] },
  { text: "british girl in australia, day whatever: it's still too hot", p: "experiencing", t: "funny", k: ["british", "australia", "hot", "weather", "sun"] },
  { text: "diary entry: i have no idea what i'm doing (but it's going well)", p: "becoming", t: "tiktok diary", k: ["idea", "doing", "diary", "honestly", "going"] },
  { text: "chatty update because a lot has happened", p: "becoming", t: "honest yap", k: ["update", "happened", "news", "lot", "chat"] },

  // ---- photo dumps / voiceover storytelling
  { text: "proof that saying yes was the right call", p: "experiencing", t: "photo dump", k: ["yes", "trip", "memories", "dump", "photos"] },
  { text: "a month in pictures (that i'll look back on forever)", p: "little", t: "photo dump", k: ["month", "pictures", "photos", "memories"] },
  { text: "a year ago i was too scared to post this", p: "becoming", t: "voiceover", k: ["year", "ago", "scared", "post", "camera"] },
  { text: "this is what the other side of a scary decision looks like", p: "becoming", t: "voiceover", k: ["decision", "scary", "side", "other", "worth"] },
];

// The 6 hook formats (method inspired by @its.amyjames), adapted with Paige examples.
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

HOOKS.push(
  { text: "i'm 23. if you're 20 to 25 and dreaming about moving abroad, read this before you talk yourself out of it", p: "becoming", t: "age-based", f: "age", k: ["moved", "abroad", "move", "dream", "age", "23"] },
  { text: "i'm 23. if you're in your early 20s, start doing these things before you're 25", p: "becoming", t: "age-based", f: "age", k: ["habits", "start", "20s", "age", "things"] },
  { text: "if you're 22 and feel behind, this is what 23 looked like for me", p: "becoming", t: "age-based", f: "age", k: ["behind", "age", "life", "year"] },
  { text: "5 weird signs you're about to outgrow your hometown", p: "becoming", t: "lists", f: "list", k: ["home", "hometown", "outgrow", "change", "signs"] },
  { text: "4 unexpected things that changed when i moved to australia", p: "becoming", t: "lists", f: "list", k: ["moved", "australia", "changed", "things"] },
  { text: "3 outfits that made me feel like a completely different person", p: "style", t: "lists", f: "list", k: ["outfit", "outfits", "different", "feel"] },
  { text: "i lied. i'm not brave. i just couldn't stand the idea of staying the same", p: "becoming", t: "emotive quote", f: "emotive", k: ["brave", "same", "scared", "change"] },
  { text: "i lied. i don't have it figured out. i'm doing it anyway", p: "becoming", t: "emotive quote", f: "emotive", k: ["figured", "anyway", "plan", "doing"] },
  { text: "i lied. moving abroad wasn't a holiday. it was the hardest, best thing i've done", p: "becoming", t: "emotive quote", f: "emotive", k: ["moving", "abroad", "hard", "best"] },
  { text: "things i don't do anymore as a girl who moved abroad alone", p: "becoming", t: "identity maxxing", f: "identity", k: ["moved", "alone", "abroad", "anymore"] },
  { text: "things i stopped doing when i started dressing for the life i want", p: "style", t: "identity maxxing", f: "identity", k: ["dress", "dressing", "style", "stopped"] },
  { text: "things i don't do anymore as a girl who shows up for herself (60 classes in)", p: "little", t: "identity maxxing", f: "identity", k: ["pilates", "class", "show", "showing", "promise"] },
  { text: "if this found you, you've been 'about to move abroad' for two years", p: "becoming", t: "algorithm call-out", f: "callout", k: ["move", "abroad", "years", "thinking"] },
  { text: "if this landed on your feed, you've probably saved 200 bali videos and booked nothing", p: "experiencing", t: "algorithm call-out", f: "callout", k: ["bali", "saved", "trip", "travel", "book"] },
  { text: "if this found you, you're probably the friend who overthinks every single decision", p: "becoming", t: "algorithm call-out", f: "callout", k: ["overthink", "decision", "friend", "think"] },
  { text: "stupid easy things i did to stop overthinking every decision", p: "becoming", t: "strong language", f: "strong", k: ["overthink", "decision", "easy", "stop"] },
  { text: "the unhinged reason i left the uk with no plan (it worked)", p: "becoming", t: "strong language", f: "strong", k: ["uk", "left", "plan", "reason"] },
  { text: "lazy girl outfit tricks i stole from studying fashion design", p: "style", t: "strong language", f: "strong", k: ["outfit", "fashion", "design", "tricks", "lazy"] },
);

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
