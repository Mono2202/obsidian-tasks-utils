export interface Task {
  task: string;
  rel_path: string;
  file: string;
  top_folder: string;
  raw_line: string;
  due: string | null;
  scheduled: string | null;
  start: string | null;
  time: string | null;
  recur: string | null;
  completable: boolean;
  tags?: string[];
  happens?: string;
}

export interface InboxItem {
  id: string;
  description: string;
  raw_line: string;
  tags: string[];
  due: string | null;
  scheduled: string | null;
  start: string | null;
  time: string | null;
  recur: string | null;
  rel_path?: string;
}

export interface Habit {
  name: string;
  title: string;
  description: string;
  done_today: boolean;
  streak: number;
  entries: string[];
}

export interface MusicTrack {
  track_id: string;
  track_name: string;
  track_number: number;
  artist: string;
  album_name: string;
  album_id: string;
  cover_url: string;
  release_year: string;
}

export interface MusicReview {
  rating: number;
  notes: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight: string | null;
}

export interface ExerciseEntry extends Exercise {
  flatIndex: number;
}

export interface WorkoutSession {
  date: string;
  exercises: Exercise[];
}

export interface WorkoutRecord {
  name: string;
  weight: string;
  weight_num: number;
  reps: number;
  date: string;
}

export interface WorkoutProgress {
  date: string;
  weight: string;
  weight_num: number;
  reps: number;
}

export interface ExerciseSuggestion {
  name: string;
  sets: number;
  reps: number;
  weight: string | null;
}

export interface FinanceEntry {
  date: string;
  category: string;
  title: string;
  amount: number;
}

export interface FinanceSubscription {
  day: number;
  name: string;
  category: string;
  amount: number;
}

export type TabName = 'today' | 'planning' | 'inbox' | 'habits' | 'finance' | 'workout' | 'music' | 'food';
export type TaskSource = 'today' | 'next' | 'upcoming';
export type ItemSource = 'inbox' | 'today' | 'next' | 'upcoming';

export interface UnifiedItem {
  id: string;
  raw_line: string;
  rel_path: string;
  description: string;
  due: string | null;
  scheduled: string | null;
  start: string | null;
  time: string | null;
  recur: string | null;
  tags: string[];
}

export interface TaskEditState {
  item: UnifiedItem;
  source: ItemSource;
}

export interface NextActionState {
  relPath: string;
  file: string;
}

export interface InlineTasks {
  tasks: Array<{
    description: string;
    raw_line: string;
    due: string | null;
    scheduled: string | null;
    start: string | null;
    time: string | null;
    recur: string | null;
  }>;
}
