'use client';

import { useMutation } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setLessonDone } from '@/server/actions';
import { useToast } from '../ui/toast';

export type NavRef = { slug: string; title: string } | null;
export type LessonData = {
  id: number;
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  kind: 'course' | 'practice';
  basePath: string;
  slug: string;
  title: string;
  subtitle: string;
  mediaType: string;
  mediaUrl: string | null;
  vimeoId: string | null;
  vimeoHash: string | null;
  poster: string | null;
  cover: string | null;
  durationS: number;
  bodyHtml: string;
  prep: string[];
  isFree: boolean;
  autoplayNext: boolean;
  playable: boolean;
  locked: boolean;
  index: number;
  total: number;
  prev: NavRef;
  next: NavRef;
  signedIn: boolean;
  progress: { positionS: number; percent: number; completed: boolean } | null;
};

export type PlayerApi = { seek: (t: number) => void; play: (from?: number) => void; pause?: () => void };
export type Note = { id: number; positionS: number; text: string; pending?: boolean };

type Ctx = {
  lesson: LessonData;
  setLesson: (l: LessonData) => void;
  time: number;
  setTime: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  started: boolean;
  setStarted: (s: boolean) => void;
  done: boolean;
  setDone: (v: boolean) => void;
  practice: boolean;
  setPractice: (v: boolean) => void;
  closing: boolean;
  setClosing: (v: boolean) => void;
  player: React.RefObject<PlayerApi | null>;
  notes: Note[];
  setNotes: (n: Note[]) => void;
};

const LessonCtx = createContext<Ctx | null>(null);
export const useLessonCtx = () => {
  const c = useContext(LessonCtx);
  if (!c) throw new Error('LessonProvider ausente');
  return c;
};

/* almacenamiento local para quien practica sin cuenta (mismas claves que el HTML aprobado) */
export const lsKey = (l: Pick<LessonData, 'vimeoId' | 'id'>) => `irb-${l.vimeoId ? 'fuegos-' + l.vimeoId : 'l' + l.id}`;
export function lsGet<T>(l: Pick<LessonData, 'vimeoId' | 'id'>, k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(`${lsKey(l)}-${k}`) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
export function lsPut(l: Pick<LessonData, 'vimeoId' | 'id'>, k: string, v: unknown) {
  try {
    localStorage.setItem(`${lsKey(l)}-${k}`, JSON.stringify(v));
  } catch {}
}

export function LessonProvider({ initial, initialNotes = [], children }: { initial: LessonData; initialNotes?: Note[]; children: React.ReactNode }) {
  const [lesson, setLessonState] = useState(initial);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [time, setTime] = useState(initial.progress?.positionS ?? 0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDoneState] = useState(!!initial.progress?.completed);
  const [practice, setPracticeState] = useState(false);
  const [closing, setClosing] = useState(false);
  const player = useRef<PlayerApi | null>(null);
  const toast = useToast();

  // sin cuenta, el estado vive en este dispositivo
  useEffect(() => {
    if (lesson.signedIn) return;
    const pos = lsGet<{ t: number }>(lesson, 'pos');
    if (pos?.t) setTime(pos.t);
    setDoneState(!!lsGet<boolean>(lesson, 'done'));
  }, [lesson]);

  const setLesson = useCallback((l: LessonData) => {
    setLessonState((cur) => {
      if (cur.id === l.id) return cur;
      setTime(l.progress?.positionS ?? 0);
      setDoneState(!!l.progress?.completed);
      setStarted(false);
      setClosing(false);
      return l;
    });
  }, []);

  /** Completado optimista: cambia al instante; si el servidor falla, se revierte y se explica. */
  const mut = useMutation({
    mutationFn: async (v: boolean) => {
      const r = await setLessonDone(lesson.id, v);
      if (!r.ok) throw new Error(r.error);
    },
    onMutate: (v) => {
      const before = done;
      setDoneState(v);
      if (!lesson.signedIn) lsPut(lesson, 'done', v);
      return { before };
    },
    onError: (e, _v, ctx) => {
      setDoneState(ctx?.before ?? false);
      if (!lesson.signedIn) lsPut(lesson, 'done', ctx?.before ?? false);
      toast(/Server Components|fetch/i.test((e as Error).message) ? 'No pudimos guardar el cambio. Intenta de nuevo en un momento.' : `No pudimos guardar el cambio: ${(e as Error).message}`, true);
    },
  });
  const setDone = useCallback((v: boolean) => mut.mutate(v), [mut]);

  const setPractice = useCallback((v: boolean) => setPracticeState(v), []);

  const value = useMemo(
    () => ({ lesson, setLesson, time, setTime, playing, setPlaying, started, setStarted, done, setDone, practice, setPractice, closing, setClosing, player, notes, setNotes }),
    [lesson, setLesson, time, playing, started, done, setDone, practice, setPractice, closing, notes],
  );
  return <LessonCtx.Provider value={value}>{children}</LessonCtx.Provider>;
}

/** Monta en cada página de clase: cambia la clase del escenario persistente sin remontarlo. */
export function LessonSync({ lesson, notes }: { lesson: LessonData; notes?: Note[] }) {
  const { setLesson, setNotes } = useLessonCtx();
  useEffect(() => {
    setLesson(lesson);
    if (notes) setNotes(notes);
  }, [lesson, notes, setLesson, setNotes]);
  return null;
}
