// Suggested nicknames: an adjective and an animal, never one that is in use.

const ADJECTIVES = [
  "Brave", "Calm", "Clever", "Cosy", "Curious", "Daring", "Dizzy", "Eager", "Fuzzy", "Gentle",
  "Happy", "Jolly", "Lucky", "Mellow", "Merry", "Nimble", "Plucky", "Quick", "Quiet", "Rapid",
  "Sleepy", "Sly", "Snappy", "Sunny", "Swift", "Tidy", "Witty", "Zesty",
];
const ANIMALS = [
  "Badger", "Beaver", "Crane", "Dolphin", "Falcon", "Ferret", "Fox", "Gecko", "Hedgehog", "Heron",
  "Koala", "Lemur", "Lynx", "Marmot", "Moose", "Narwhal", "Otter", "Owl", "Panda", "Penguin",
  "Puffin", "Quokka", "Raccoon", "Seal", "Sloth", "Tanuki", "Turtle", "Walrus",
];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

/** A random "Adjective Animal" not in `used`; with a number appended once every pair is taken. */
export function pickName(used: Iterable<string>, rand: () => number = Math.random): string {
  const taken = new Set([...used].map((n) => n.toLowerCase()));
  const free = (n: string) => !taken.has(n.toLowerCase());
  // a few random tries first: cheap, and almost always enough
  for (let i = 0; i < 20; i++) {
    const name = `${pick(ADJECTIVES, rand)} ${pick(ANIMALS, rand)}`;
    if (free(name)) return name;
  }
  const all = ADJECTIVES.flatMap((a) => ANIMALS.map((b) => `${a} ${b}`));
  const left = all.filter(free);
  if (left.length) return pick(left, rand);
  const base = pick(all, rand);
  for (let n = 2; ; n++) if (free(`${base} ${n}`)) return `${base} ${n}`;
}
