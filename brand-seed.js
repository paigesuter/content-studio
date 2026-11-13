// Paige's Brand Brain: the starting point. Everything here can be edited inside the app
// (Brand Brain tab) and changes are saved on your device only.
// Only public-facing brand info lives in this file because the app's code is public.
// Private things (goals, numbers, personal details) are added inside the app and never leave your device.

export const BRAND_SEED = {
  version: 1,
  identity: {
    name: "Paige Suter",
    handles: "Instagram: @paigesuterx\nUGC: @creatorscollectiveugc",
    oneLiner: "A British girl living and travelling between Australia and Bali, documenting the process of building a life that feels like her.",
    story:
      "Fashion design background (studied in London, pattern cutting, worked in high-end couture and bridal). Loves clothes, styling, beauty, travel and Pilates.\n" +
      "Moved from the UK to Australia for a bigger life, more freedom and more experiences, without having every detail figured out.\n" +
      "Not an expert who has it all sorted. Sharing the process in real time: building confidence, exploring new places, developing personal style and working towards an online income.",
    message: "Building a life that feels like you.",
    themes: [
      "Building a life worth romanticising (said in fresh ways, not this exact phrase every time)",
      "Becoming the girl you always imagined yourself being",
      "The life on the other side of decisions you're scared to make",
      "There are so many different versions of your life you could live",
      "You don't need to have everything figured out to start",
      "Finding confidence through doing things that scare you",
      "Creating a life that feels bigger, more exciting and more your own",
    ],
  },
  audience: {
    who: "Women roughly 20–29, figuring out who they are, what they want and what their future might look like.",
    innerThought: "I want more from life, but I don't really know how to get there.",
    traits: [
      "Feel capable of more but don't know where to start",
      "Want to travel, move abroad or experience something different",
      "Feel stuck in the same routine",
      "Want to become more confident",
      "Into fashion but still figuring out their personal style",
      "Want to romanticise their everyday life",
      "Want to improve fitness and build healthy habits",
      "Want an exciting life rather than the expected path",
      "Interested in making money online, social media and creative careers",
      "Overthink decisions and worry what people think",
      "Want to feel more independent and comfortable being themselves",
    ],
    wants: "Relatability, inspiration, personality, humour and ideas they can take into their own lives. Not a perfect, unattainable influencer: a girl they relate to, want to be friends with and grow alongside.",
  },
  pillars: [
    { id: "style", name: "Style", color: "pink",
      about: "Fashion is my biggest discovery tool. Stylish, girly, effortless, visually interesting. Encourage girls to experiment and express themselves through clothes.",
      topics: ["Outfit videos & outfit diaries", "Styling inspiration", "Getting dressed", "Personal style development", "Hauls & try-ons", "Fashion finds", "Holiday wardrobes & packing", "One item styled different ways", "Fashion + travel", "Beauty & getting ready", "Future: sewing & designing clothes"] },
    { id: "becoming", name: "Becoming Her", color: "butter",
      about: "The deeper, personal side. Reflective voiceovers, relatable thoughts, storytelling, cinematic footage. Never coaching or preaching: things I've genuinely experienced or thought about.",
      topics: ["Moving abroad", "Starting over", "Confidence", "Personal growth", "Comfort zones", "Overthinking", "Acting before you feel ready", "Independence", "Building an online income", "Figuring out adulthood", "Different versions of your life", "Trusting yourself", "Doing things for future you"] },
    { id: "experiencing", name: "Experiencing Life", color: "sea",
      about: "Travel and adventure. Beautiful and aspirational but personal. The destination is part of the story; I'm the person people follow. Not a generic travel account.",
      topics: ["Australia", "Bali", "Travelling", "Moving between countries", "Exploring new places", "Beach days", "Adventures", "Trying new things", "Solo experiences", "Travel diaries", "Saying yes", "Everyday life in different countries", "Freedom of living abroad"] },
    { id: "little", name: "Little Life", color: "blush",
      about: "Everyday moments that make people feel connected. Natural, warm, feminine, visually beautiful. Turn camera-roll moments into something interesting.",
      topics: ["Morning routines", "Coffee", "Sunrise & sunset", "Beach walks", "Pilates", "Gym", "Getting ready", "Little everyday moments", "Journaling", "Flowers", "Cute cafes", "Ordinary days made lovely", "Moments with friends"] },
  ],
  personality: {
    traits: ["girly", "warm", "funny", "relatable", "honest", "aspirational", "a little cheeky", "effortlessly stylish", "reflective when it fits", "playful without trying too hard", "natural, not over-curated wording"],
    platforms: "Instagram: more curated, a cohesive fashion / beauty / travel / lifestyle brand.\nTikTok: more casual, diary-like, chatty and spontaneous.\nLove cinematic footage and thoughtful storytelling, but never lose the personality.",
  },
  voice: {
    style: [
      "Normal sentences, conversational wording, natural paragraphs",
      "Occasional humour and little observations",
      "Honest thoughts and a clever or unexpected angle",
      "Sounds like something I'd actually say, not polished marketing",
      "Lowercase is good for some captions",
      "Swearing is fine where it feels natural",
      "Emojis sparingly and only when they suit (never in the IG bio)",
      "Not every caption needs to be deep. Sometimes a funny one-liner is perfect",
    ],
    examples: [
      "frequent flyer, infrequent homebody",
      "support cars? no. fashion show? yes.",
      "anything pink has my heart <3",
      "the only stress i want in my life is my next outfit and destination",
      "could stop travelling but we're not quitters",
      "wtf is staying home",
    ],
    examplesNote: "Learn the tone from these, don't reuse them.",
    avoidTone: ["AI motivational quote", "generic lifestyle influencer", "life coach", "corporate social media manager", "trying too hard to sound deep", "someone who has it all figured out", "fake vulnerability", "overly poetic descriptions of ordinary things", "captions that repeat what's already visible"],
    bannedPhrases: ["POV: you're living your dream life", "romanticise your life (on repeat)", "main character energy", "that girl", "unlock your potential", "your best self", "here's your reminder", "chasing sunsets and dreams", "you NEED to see this"],
    punctuation: "No excessive exclamation marks. No unnecessary emojis.",
  },
  editing: {
    principles: [
      "My brand identity beats generic trends",
      "Consistency, not repetition: don't make every video identical",
      "Don't over-edit: natural, beautiful footage often wins",
      "Not every video needs a hook or text",
      "Preserve the original look and quality of the footage",
      "Natural lighting, beautiful colours, movement, interesting compositions, cinematic B-roll",
      "Pink is part of the wider brand, but don't put Pilates pink on everything",
      "Never change fonts or colours without approval",
      "Always preview before export",
    ],
    defaultText: "Classic white text over video",
    formats: "Default 9:16 for Reels & TikTok. Also 4:5, 1:1, 16:9 when needed.",
  },
  aesthetic: ["clean", "feminine", "cinematic", "fashion-led", "girly", "effortless", "editorial", "soft but not overly delicate", "cohesive without looking repetitive", "a recognisable personal brand, not a template-heavy Canva account"],
  goals: {
    // Private: filled in on your device only
    notes: "",
  },
  feedback: [],
  rules: [],
};
