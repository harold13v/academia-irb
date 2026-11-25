export type OutlineView = {
  title: string;
  slug: string;
  cover: string | null;
  totalS: number;
  count: number;
  modules: { id: number; title: string; lessons: { id: number; slug: string; title: string; durationS: number; isFree: boolean; mediaType: string }[] }[];
};
export type Prog = Record<number, { positionS: number; percent: number; completed: boolean }>;
export type PlayerUser = { name: string; reminderHour: number | null; soundOn: boolean } | null;
