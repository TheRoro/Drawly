// Fun fallback prompt ideas players can pick instead of writing their own.
export const PROMPT_SUGGESTIONS: string[] = [
  'A cat riding a unicorn',
  'A robot baking cookies',
  'A penguin on vacation',
  'A dragon eating spaghetti',
  'A wizard losing his hat',
  'A shark in a business suit',
  'A dinosaur at a birthday party',
  'An astronaut walking a dog',
  'A grumpy potato',
  'A frog playing guitar',
  'A haunted toaster',
  'A llama detective',
  'A vampire at the beach',
  'A snail in a race car',
  'A ghost ordering coffee',
  'A pirate afraid of water',
  'A cactus with a mustache',
  'A sloth doing karate',
  'An alien tourist on Earth',
  'A bear stuck in a tree',
  'A chicken plotting world domination',
  'A mermaid riding a bike',
  'A superhero who can only fly backwards',
  'A jellyfish wearing sunglasses',
  'A king made of pizza',
  'A hamster powering a city',
  'A T-rex trying to take a selfie',
  'A banana running from a monkey',
  'A skeleton at the gym',
  'A duck in a tuxedo',
  'A volcano sneezing',
  'A spider knitting a sweater',
  'A cloud raining cats',
  'A turtle late for work',
  'A clown afraid of balloons',
  'A monster under the bed eating snacks',
  'A snowman on a tropical island',
  'A bee in a tiny hard hat',
  'A whale flying a kite',
  'A grandma street racing',
]

export function getRandomPrompts(count: number, exclude: string[] = []): string[] {
  const pool = PROMPT_SUGGESTIONS.filter(p => !exclude.includes(p))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
