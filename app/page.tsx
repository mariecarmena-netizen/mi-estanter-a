'use client';

import {
  ChangeEvent,
  SyntheticEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Image from 'next/image';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ImagePlus,
  Library,
  Play,
  Plus,
  Sparkles,
  Square,
  Target,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';

type BookStatus = 'reading' | 'completed';

type Book = {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  color: string;
  accent: string;
  isbn?: string;
  coverImage?: string;
  createdAt: string;
  completedAt?: string;
};

type ReadingSession = {
  id: string;
  bookId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pagesRead: number;
};

type ActiveTimer = {
  bookId: string;
  startedAt: number;
};

type PendingSession = {
  bookId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
};

type SessionSummary = {
  bookId: string;
  bookTitle: string;
  totalPages: number;
  currentPage: number;
  pagesRead: number;
  durationSeconds: number;
  pagesPerHour: number;
  remainingPages: number;
  remainingSeconds: number;
  completed: boolean;
};

const STORAGE_KEY = 'mi-estanteria-v1';
const BOOK_COLORS = [
  ['#304c3d', '#f5df9d'],
  ['#253a52', '#d6ba78'],
  ['#734a35', '#ead5ad'],
  ['#5f3150', '#f1d8c4'],
  ['#455c67', '#f3d7a0'],
  ['#6b352d', '#f3d3b0'],
  ['#455333', '#ebe0b4'],
  ['#3b355e', '#decfa0'],
] as const;
const SHELF_BOTTOMS = [78.2, 65.1, 51.8, 38.8, 25.4, 12.1];
const BOOKS_PER_SHELF = 6;
const DEMO_BOOK_IDS = new Set([
  'demo-junco',
  'demo-nada',
  'demo-persuasion',
  'demo-ficciones',
]);
const PAGES_CHART_CONFIG = {
  pages: {
    label: 'Páginas',
    theme: { light: '#2e5945', dark: '#93b7a4' },
  },
} satisfies ChartConfig;
const MINUTES_CHART_CONFIG = {
  minutes: {
    label: 'Minutos',
    theme: { light: '#b07b38', dark: '#e4bf79' },
  },
} satisfies ChartConfig;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFormText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIsbn(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

function isValidIsbn(value: string) {
  return /^(?:\d{9}[\dX]|\d{13})$/.test(value);
}

async function prepareCoverImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = document.createElement('img');
    image.decoding = 'async';
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    });

    const scale = Math.min(
      1,
      600 / image.naturalWidth,
      900 / image.naturalHeight,
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');

    context.fillStyle = '#f4f0e8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatReadingTime(totalSeconds: number) {
  if (totalSeconds <= 0) return '0 min';
  if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))} s`;
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatPagesPerHour(pagesPerHour: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: pagesPerHour < 10 ? 1 : 0,
  }).format(pagesPerHour);
}

function localDateKey(value: string | number | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatShortDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function formatFullDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function getBookEstimate(book: Book, sessions: ReadingSession[]) {
  const usefulSessions = sessions.filter(
    (session) =>
      session.bookId === book.id &&
      session.pagesRead > 0 &&
      session.durationSeconds > 0,
  );
  const measuredPages = usefulSessions.reduce(
    (sum, session) => sum + session.pagesRead,
    0,
  );
  const measuredSeconds = usefulSessions.reduce(
    (sum, session) => sum + session.durationSeconds,
    0,
  );
  const remainingPages = Math.max(0, book.totalPages - book.currentPage);

  if (!measuredPages || !measuredSeconds) return null;

  const remainingSeconds = (measuredSeconds / measuredPages) * remainingPages;
  const readingDays = new Set(
    usefulSessions.map((session) => localDateKey(session.endedAt)),
  ).size;
  const pagesPerReadingDay = measuredPages / Math.max(1, readingDays);
  const daysRemaining = Math.max(
    1,
    Math.ceil(remainingPages / pagesPerReadingDay),
  );
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysRemaining);

  return {
    remainingSeconds,
    daysRemaining,
    finishDate,
    secondsPerPage: measuredSeconds / measuredPages,
    pagesPerHour: (measuredPages * 3600) / measuredSeconds,
  };
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(
    null,
  );
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  );
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedShelfBookId, setSelectedShelfBookId] = useState<string | null>(
    null,
  );
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [coverError, setCoverError] = useState('');
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [notice, setNotice] = useState('');
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            books?: Book[];
            sessions?: ReadingSession[];
            activeTimer?: ActiveTimer | null;
            selectedBookId?: string;
          };
          const personalBooks = Array.isArray(parsed.books)
            ? parsed.books.filter((book) => !DEMO_BOOK_IDS.has(book.id))
            : [];
          const personalBookIds = new Set(personalBooks.map((book) => book.id));
          const personalSessions = Array.isArray(parsed.sessions)
            ? parsed.sessions.filter(
                (session) => !DEMO_BOOK_IDS.has(session.bookId),
              )
            : [];
          const savedSelectedBookId =
            typeof parsed.selectedBookId === 'string' &&
            personalBookIds.has(parsed.selectedBookId)
              ? parsed.selectedBookId
              : (personalBooks.find((book) => book.status === 'reading')?.id ??
                '');

          setBooks(personalBooks);
          setSessions(personalSessions);
          setSelectedBookId(savedSelectedBookId);
          if (
            parsed.activeTimer &&
            personalBookIds.has(parsed.activeTimer.bookId)
          ) {
            setActiveTimer(parsed.activeTimer);
          }
        }
      } catch {
        setNotice('No se pudieron recuperar los datos guardados.');
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ books, sessions, activeTimer, selectedBookId }),
      );
    } catch {
      window.setTimeout(
        () =>
          setNotice(
            'No queda espacio para guardar la portada. Prueba con otra imagen.',
          ),
        0,
      );
    }
  }, [activeTimer, books, hydrated, selectedBookId, sessions]);

  useEffect(() => {
    if (!activeTimer) return;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const readingBooks = useMemo(
    () => books.filter((book) => book.status === 'reading'),
    [books],
  );
  const completedBooks = useMemo(
    () => books.filter((book) => book.status === 'completed'),
    [books],
  );
  const currentBook = useMemo(() => {
    const timerBook = activeTimer
      ? readingBooks.find((book) => book.id === activeTimer.bookId)
      : undefined;
    return (
      timerBook ??
      readingBooks.find((book) => book.id === selectedBookId) ??
      readingBooks[0]
    );
  }, [activeTimer, readingBooks, selectedBookId]);
  const currentEstimate = currentBook
    ? getBookEstimate(currentBook, sessions)
    : null;
  const elapsedSeconds = activeTimer
    ? Math.max(0, Math.floor((tick - activeTimer.startedAt) / 1000))
    : 0;
  const progress = currentBook
    ? Math.min(
        100,
        Math.round((currentBook.currentPage / currentBook.totalPages) * 100),
      )
    : 0;

  const todayKey = localDateKey(new Date());
  const todaySeconds = sessions
    .filter((session) => localDateKey(session.endedAt) === todayKey)
    .reduce((sum, session) => sum + session.durationSeconds, 0);
  const now = new Date();
  const monthPages = sessions
    .filter((session) => {
      const endedAt = new Date(session.endedAt);
      return (
        endedAt.getFullYear() === now.getFullYear() &&
        endedAt.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, session) => sum + session.pagesRead, 0);
  const lastSevenDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dateKey = localDateKey(date);
      const daySessions = sessions.filter(
        (session) => localDateKey(session.endedAt) === dateKey,
      );
      const seconds = daySessions.reduce(
        (sum, session) => sum + session.durationSeconds,
        0,
      );
      const weekday = new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
      })
        .format(date)
        .replace('.', '');

      return {
        dateKey,
        day: `${weekday} ${date.getDate()}`,
        pages: daySessions.reduce((sum, session) => sum + session.pagesRead, 0),
        minutes: Math.round(seconds / 6) / 10,
      };
    });
  }, [sessions]);
  const booksReadThisYear = completedBooks.filter((book) => {
    if (!book.completedAt) return false;
    return new Date(book.completedAt).getFullYear() === now.getFullYear();
  }).length;
  const booksReadThisMonth = completedBooks.filter((book) => {
    if (!book.completedAt) return false;
    const completedAt = new Date(book.completedAt);
    return (
      completedAt.getFullYear() === now.getFullYear() &&
      completedAt.getMonth() === now.getMonth()
    );
  }).length;
  const currentMonthName = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
  }).format(now);
  const readingTimeRanking = useMemo(
    () =>
      completedBooks
        .map((book) => ({
          book,
          durationSeconds: sessions
            .filter((session) => session.bookId === book.id)
            .reduce((sum, session) => sum + session.durationSeconds, 0),
        }))
        .filter((item) => item.durationSeconds > 0)
        .sort((a, b) => b.durationSeconds - a.durationSeconds)
        .slice(0, 5),
    [completedBooks, sessions],
  );
  const longestReadingTime = readingTimeRanking[0]?.durationSeconds ?? 0;
  const selectedShelfBook = books.find(
    (book) => book.id === selectedShelfBookId,
  );

  function startReading(bookId: string) {
    setSelectedBookId(bookId);
    setTick(Date.now());
    setActiveTimer({ bookId, startedAt: Date.now() });
    setNotice('Cronómetro iniciado. Que disfrutes la lectura.');
  }

  function stopReading() {
    if (!activeTimer) return;
    const endedAt = Date.now();
    setPendingSession({
      bookId: activeTimer.bookId,
      startedAt: activeTimer.startedAt,
      endedAt,
      durationSeconds: Math.max(
        1,
        Math.round((endedAt - activeTimer.startedAt) / 1000),
      ),
    });
    setActiveTimer(null);
  }

  function resumePendingSession() {
    if (!pendingSession) return;
    setActiveTimer({
      bookId: pendingSession.bookId,
      startedAt: Date.now() - pendingSession.durationSeconds * 1000,
    });
    setPendingSession(null);
  }

  function saveSession(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingSession) return;
    const form = new FormData(event.currentTarget);
    const book = books.find((item) => item.id === pendingSession.bookId);
    if (!book) return;
    const pageReached = Number(form.get('currentPage'));
    const nextPage = Math.min(
      book.totalPages,
      Math.max(
        book.currentPage + 1,
        Number.isFinite(pageReached)
          ? Math.trunc(pageReached)
          : book.currentPage + 1,
      ),
    );
    const validPages = nextPage - book.currentPage;
    const completed = nextPage >= book.totalPages;
    const remainingPages = Math.max(0, book.totalPages - nextPage);
    const pagesPerHour = (validPages * 3600) / pendingSession.durationSeconds;
    const endedAtIso = new Date(pendingSession.endedAt).toISOString();

    setSessions((current) => [
      ...current,
      {
        id: makeId('session'),
        bookId: book.id,
        startedAt: new Date(pendingSession.startedAt).toISOString(),
        endedAt: endedAtIso,
        durationSeconds: pendingSession.durationSeconds,
        pagesRead: validPages,
      },
    ]);
    setBooks((current) =>
      current.map((item) =>
        item.id === book.id
          ? {
              ...item,
              currentPage: nextPage,
              status: completed ? 'completed' : 'reading',
              completedAt: completed ? endedAtIso : item.completedAt,
            }
          : item,
      ),
    );
    if (completed) {
      const nextReadingBook = readingBooks.find((item) => item.id !== book.id);
      setSelectedBookId(nextReadingBook?.id ?? '');
    }
    setSessionSummary({
      bookId: book.id,
      bookTitle: book.title,
      totalPages: book.totalPages,
      currentPage: nextPage,
      pagesRead: validPages,
      durationSeconds: pendingSession.durationSeconds,
      pagesPerHour,
      remainingPages,
      remainingSeconds:
        remainingPages > 0 ? (remainingPages / pagesPerHour) * 3600 : 0,
      completed,
    });
    setPendingSession(null);
  }

  function closeSessionSummary() {
    const shouldShowShelf = sessionSummary?.completed;
    setSessionSummary(null);
    if (shouldShowShelf) {
      window.setTimeout(() => {
        document
          .querySelector('#estanteria')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCoverError('Elige una imagen JPG, PNG o WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCoverError('La imagen debe pesar menos de 10 MB.');
      event.target.value = '';
      return;
    }

    setIsProcessingCover(true);
    try {
      setCoverImage(await prepareCoverImage(file));
      setCoverFileName(file.name);
    } catch {
      setCoverError('No se pudo preparar esta imagen. Prueba con otra.');
      event.target.value = '';
    } finally {
      setIsProcessingCover(false);
    }
  }

  function clearCover() {
    setCoverImage('');
    setCoverFileName('');
    setCoverError('');
    const input = document.querySelector<HTMLInputElement>('#book-cover');
    if (input) input.value = '';
  }

  function resetAddBook() {
    clearCover();
    setIsProcessingCover(false);
  }

  function addBook(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProcessingCover) {
      setNotice('Espera un momento mientras preparamos la portada.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = getFormText(form, 'title');
    const author = getFormText(form, 'author');
    const isbn = normalizeIsbn(getFormText(form, 'isbn'));
    const totalPages = Math.max(1, Number(form.get('totalPages')) || 1);
    const currentPage = Math.min(
      totalPages,
      Math.max(0, Number(form.get('currentPage')) || 0),
    );
    if (!title || !author) return;
    if (isbn && !isValidIsbn(isbn)) {
      setNotice('Revisa el ISBN: debe tener 10 o 13 caracteres.');
      return;
    }
    const completed = currentPage >= totalPages;
    const [color, accent] = BOOK_COLORS[books.length % BOOK_COLORS.length];
    const book: Book = {
      id: makeId('book'),
      title,
      author,
      totalPages,
      currentPage,
      status: completed ? 'completed' : 'reading',
      color,
      accent,
      isbn: isbn || undefined,
      coverImage: coverImage || undefined,
      createdAt: new Date().toISOString(),
      completedAt: completed ? new Date().toISOString() : undefined,
    };

    setBooks((current) => [...current, book]);
    if (!completed) setSelectedBookId(book.id);
    setAddBookOpen(false);
    setNotice(
      completed
        ? 'Libro añadido a la estantería.'
        : 'Libro añadido. Ya puedes iniciar una sesión.',
    );
    event.currentTarget.reset();
    resetAddBook();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <a
            className="flex items-center gap-3"
            href="#inicio"
            aria-label="Mi Estantería, inicio"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Library className="size-4.5" />
            </span>
            <span className="hidden font-serif text-xl font-semibold tracking-tight sm:inline">
              Mi Estantería
            </span>
          </a>
          <nav
            className="hidden items-center gap-1 rounded-full bg-secondary/70 p-1 md:flex"
            aria-label="Principal"
          >
            <a
              className="rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm"
              href="#inicio"
            >
              Leyendo
            </a>
            <a
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="#estanteria"
            >
              Estantería
            </a>
            <a
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="#estadisticas"
            >
              Estadísticas
            </a>
          </nav>
          <Button
            className="h-10 rounded-full px-4 shadow-sm"
            onClick={() => setAddBookOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Añadir libro
          </Button>
        </div>
      </header>

      <div
        id="inicio"
        className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12"
      >
        <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" /> Tu rincón de lectura
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              ¿Seguimos leyendo?
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Cada minuto y cada página cuentan. Hoy llevas{' '}
            <strong className="text-foreground">
              {formatReadingTime(todaySeconds)}
            </strong>
            .
          </p>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            {currentBook ? (
              <article className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_18px_60px_rgba(61,43,31,0.08)]">
                <div className="grid lg:grid-cols-[210px_minmax(0,1fr)]">
                  <div
                    className="book-cover relative min-h-[250px] overflow-hidden p-7 lg:min-h-[390px]"
                    style={{
                      backgroundColor: currentBook.color,
                      color: currentBook.accent,
                    }}
                  >
                    {currentBook.coverImage ? (
                      <>
                        <Image
                          src={currentBook.coverImage}
                          alt={`Portada de ${currentBook.title}`}
                          fill
                          sizes="(min-width: 1024px) 210px, 100vw"
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/5" />
                      </>
                    ) : (
                      <>
                        <span className="absolute -right-16 -top-12 size-52 rounded-full border border-current opacity-20" />
                        <span className="absolute -right-4 top-9 size-32 rounded-full border border-current opacity-25" />
                        <p className="relative text-[10px] font-semibold uppercase tracking-[0.25em] opacity-70">
                          {currentBook.author}
                        </p>
                        <h2 className="relative mt-12 max-w-[160px] font-serif text-3xl leading-[0.98]">
                          {currentBook.title}
                        </h2>
                        <BookOpen
                          className="absolute bottom-7 left-7 size-8 opacity-60"
                          strokeWidth={1.4}
                        />
                      </>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
                    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Badge
                          variant="secondary"
                          className="mb-3 bg-accent text-accent-foreground"
                        >
                          {activeTimer ? 'Leyendo ahora' : 'Próxima lectura'}
                        </Badge>
                        <h2 className="max-w-xl break-words font-serif text-3xl font-medium leading-tight tracking-tight">
                          {currentBook.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currentBook.author}
                        </p>
                        {currentBook.isbn && (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            ISBN {currentBook.isbn}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                        {progress}% completado
                      </span>
                    </div>

                    <Progress value={progress} locale="es-ES" className="gap-2">
                      <ProgressLabel className="text-xs text-muted-foreground">
                        {currentBook.currentPage} de {currentBook.totalPages}{' '}
                        páginas
                      </ProgressLabel>
                      <ProgressValue className="text-xs">
                        {() =>
                          `${currentBook.totalPages - currentBook.currentPage} por leer`
                        }
                      </ProgressValue>
                    </Progress>

                    <div className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-secondary/70 p-4">
                        <Clock3 className="mb-4 size-4 text-primary" />
                        <p className="text-xs text-muted-foreground">
                          Tiempo restante
                        </p>
                        <p className="mt-1 font-serif text-xl font-semibold">
                          {currentEstimate
                            ? formatReadingTime(
                                currentEstimate.remainingSeconds,
                              )
                            : 'Por calcular'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-secondary/70 p-4">
                        <Target className="mb-4 size-4 text-primary" />
                        <p className="text-xs text-muted-foreground">
                          Fecha estimada
                        </p>
                        <p className="mt-1 font-serif text-xl font-semibold">
                          {currentEstimate
                            ? formatShortDate(currentEstimate.finishDate)
                            : 'Tras 1ª sesión'}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-2xl bg-secondary/70 p-4 sm:col-span-1">
                        <Timer className="mb-4 size-4 text-primary" />
                        <p className="text-xs text-muted-foreground">
                          Velocidad media
                        </p>
                        <p className="mt-1 font-serif text-xl font-semibold">
                          {currentEstimate
                            ? `${formatPagesPerHour(currentEstimate.pagesPerHour)} pág./h`
                            : 'Tras 1ª sesión'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center">
                      {activeTimer ? (
                        <Button
                          size="lg"
                          variant="destructive"
                          className="h-12 flex-1 rounded-xl bg-[#b44a42] text-white shadow-[0_10px_24px_rgba(139,47,41,0.18)] hover:bg-[#9f3f38]"
                          onClick={stopReading}
                        >
                          <Square
                            className="fill-current"
                            data-icon="inline-start"
                          />
                          Detener y guardar
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          className="h-12 flex-1 rounded-xl text-base shadow-[0_10px_24px_rgba(44,77,59,0.2)]"
                          onClick={() => startReading(currentBook.id)}
                        >
                          <Play
                            className="fill-current"
                            data-icon="inline-start"
                          />
                          Iniciar lectura
                        </Button>
                      )}
                      <div
                        className={`rounded-xl border px-5 py-2.5 text-center ${activeTimer ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                      >
                        <p className="font-mono text-xl font-semibold tabular-nums">
                          {formatTimer(elapsedSeconds)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              <article className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-border bg-card p-8 text-center">
                <div className="max-w-sm">
                  <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                    <BookOpen className="size-6" />
                  </span>
                  <h2 className="font-serif text-3xl font-semibold">
                    Tu próxima historia empieza aquí
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Añade el libro que estás leyendo y registra tu ritmo página
                    a página.
                  </p>
                  <Button
                    className="mt-6 h-11 rounded-xl px-5"
                    onClick={() => setAddBookOpen(true)}
                  >
                    <Plus data-icon="inline-start" /> Añadir mi primer libro
                  </Button>
                </div>
              </article>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [formatReadingTime(todaySeconds), 'Leídos hoy'],
                [String(monthPages), 'Páginas este mes'],
                [String(sessions.length), 'Sesiones totales'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="font-serif text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {readingBooks.length > 1 && (
              <section
                className="rounded-[24px] border border-border bg-card p-5 sm:p-6"
                aria-labelledby="reading-list-title"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      En lectura
                    </p>
                    <h2
                      id="reading-list-title"
                      className="mt-1 font-serif text-2xl font-semibold"
                    >
                      Tus libros abiertos
                    </h2>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {readingBooks.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {readingBooks.map((book) => {
                    const bookProgress = Math.round(
                      (book.currentPage / book.totalPages) * 100,
                    );
                    const isCurrent = currentBook?.id === book.id;
                    return (
                      <button
                        key={book.id}
                        className={`group flex items-center gap-4 rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-background/40'}`}
                        onClick={() => setSelectedBookId(book.id)}
                        disabled={Boolean(
                          activeTimer && activeTimer.bookId !== book.id,
                        )}
                      >
                        <span
                          className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm shadow-sm"
                          style={{ backgroundColor: book.color }}
                        >
                          {book.coverImage && (
                            <Image
                              src={book.coverImage}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block break-words font-serif text-lg leading-tight">
                            {book.title}
                          </strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {bookProgress}% · pág. {book.currentPage}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside
            id="estanteria"
            className="scroll-mt-24 rounded-[28px] border border-border bg-card p-4 shadow-[0_18px_60px_rgba(61,43,31,0.08)] sm:p-6"
          >
            <div className="mb-5 flex items-end justify-between px-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Tu colección
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  Libros terminados
                </h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {completedBooks.length}{' '}
                {completedBooks.length === 1 ? 'libro' : 'libros'}
              </span>
            </div>

            <div
              className="shelf-scene"
              aria-label={`Estantería con ${completedBooks.length} libros terminados`}
            >
              <Image
                src="/estanteria-vacia.png"
                alt="Estantería de madera"
                width={941}
                height={1672}
                sizes="(min-width: 1280px) 340px, (min-width: 640px) 340px, 300px"
                priority
              />
              {SHELF_BOTTOMS.map((bottom, rowIndex) => {
                const rowBooks = completedBooks.slice(
                  rowIndex * BOOKS_PER_SHELF,
                  rowIndex * BOOKS_PER_SHELF + BOOKS_PER_SHELF,
                );
                if (!rowBooks.length) return null;
                return (
                  <div
                    className="shelf-row"
                    key={bottom}
                    style={{ bottom: `${bottom}%`, height: '10.5%' }}
                  >
                    {rowBooks.map((book, index) => (
                      <button
                        key={book.id}
                        className="shelf-book"
                        style={{
                          backgroundColor: book.color,
                          color: book.accent,
                          height: `${82 + ((index * 7 + rowIndex * 3) % 16)}%`,
                          transform:
                            index % 5 === 3 ? 'rotate(-1.8deg)' : undefined,
                        }}
                        onClick={() => setSelectedShelfBookId(book.id)}
                        aria-label={`${book.title}, de ${book.author}, terminado`}
                      >
                        {book.coverImage ? (
                          <Image
                            src={book.coverImage}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span>{book.title}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              {completedBooks.length
                ? 'Toca un lomo para recordar esa lectura.'
                : 'Cada libro terminado encontrará aquí su sitio.'}
            </p>
          </aside>
        </section>

        <section
          id="estadisticas"
          className="mt-10 scroll-mt-24"
          aria-labelledby="statistics-title"
        >
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <BarChart3 className="size-3.5" /> Tu ritmo
              </p>
              <h2
                id="statistics-title"
                className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Estadísticas de lectura
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Una mirada a tus últimos siete días y a los libros que has
              terminado.
            </p>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <article className="relative overflow-hidden rounded-[24px] border border-border bg-primary p-6 text-primary-foreground shadow-[0_14px_36px_rgba(44,77,59,0.13)]">
              <span className="absolute -right-10 -top-14 size-36 rounded-full border border-white/15" />
              <CalendarDays className="mb-8 size-5 text-[#eadb9c]" />
              <p className="font-serif text-5xl font-semibold tabular-nums">
                {booksReadThisYear}
              </p>
              <p className="mt-2 text-sm text-primary-foreground/75">
                {booksReadThisYear === 1
                  ? 'Libro leído este año'
                  : 'Libros leídos este año'}
              </p>
            </article>
            <article className="relative overflow-hidden rounded-[24px] border border-border bg-card p-6 shadow-[0_14px_36px_rgba(61,43,31,0.06)]">
              <span className="absolute -right-10 -top-14 size-36 rounded-full border border-primary/10" />
              <BookOpen className="mb-8 size-5 text-primary" />
              <p className="font-serif text-5xl font-semibold tabular-nums">
                {booksReadThisMonth}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {booksReadThisMonth === 1
                  ? `Libro leído en ${currentMonthName}`
                  : `Libros leídos en ${currentMonthName}`}
              </p>
            </article>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="min-w-0 rounded-[24px] border border-border bg-card p-5 shadow-[0_14px_36px_rgba(61,43,31,0.06)] sm:p-6">
              <div className="mb-5">
                <h3 className="font-serif text-2xl font-semibold">
                  Páginas leídas
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Totales diarios · últimos 7 días
                </p>
              </div>
              <ChartContainer
                config={PAGES_CHART_CONFIG}
                className="h-[250px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={lastSevenDays}
                  margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="day"
                    interval={0}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.55 }}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="pages"
                    fill="var(--color-pages)"
                    radius={[7, 7, 2, 2]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ChartContainer>
            </article>

            <article className="min-w-0 rounded-[24px] border border-border bg-card p-5 shadow-[0_14px_36px_rgba(61,43,31,0.06)] sm:p-6">
              <div className="mb-5">
                <h3 className="font-serif text-2xl font-semibold">
                  Minutos de lectura
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tiempo diario · últimos 7 días
                </p>
              </div>
              <ChartContainer
                config={MINUTES_CHART_CONFIG}
                className="h-[250px] w-full"
              >
                <AreaChart
                  accessibilityLayer
                  data={lastSevenDays}
                  margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="readingMinutesFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-minutes)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-minutes)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="day"
                    interval={0}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={{ stroke: 'var(--border)' }}
                    content={<ChartTooltipContent />}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="var(--color-minutes)"
                    strokeWidth={2.5}
                    fill="url(#readingMinutesFill)"
                    dot={{ fill: 'var(--color-minutes)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ChartContainer>
            </article>
          </div>

          <article className="mt-6 rounded-[24px] border border-border bg-card p-5 shadow-[0_14px_36px_rgba(61,43,31,0.06)] sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Top 5
                </p>
                <h3 className="mt-1 font-serif text-2xl font-semibold">
                  Libros con más tiempo de lectura
                </h3>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Trophy className="size-5" />
              </span>
            </div>

            {readingTimeRanking.length ? (
              <ol className="grid gap-3">
                {readingTimeRanking.map(({ book, durationSeconds }, index) => (
                  <li
                    key={book.id}
                    className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary/55 p-3 sm:gap-4 sm:p-4"
                  >
                    <span
                      className={`grid size-8 place-items-center rounded-full text-sm font-bold ${index === 0 ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground'}`}
                      aria-label={`Puesto ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className="relative h-14 w-10 overflow-hidden rounded-sm shadow-sm"
                      style={{ backgroundColor: book.color }}
                    >
                      {book.coverImage ? (
                        <Image
                          src={book.coverImage}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span
                          className="absolute inset-1.5 overflow-hidden font-serif text-[7px] leading-tight"
                          style={{ color: book.accent }}
                        >
                          {book.title}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate font-serif text-lg">
                        {book.title}
                      </strong>
                      <span className="block truncate text-xs text-muted-foreground">
                        {book.author}
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-border/70">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(4, (durationSeconds / longestReadingTime) * 100)}%`,
                          }}
                        />
                      </span>
                    </span>
                    <strong className="whitespace-nowrap text-right text-sm tabular-nums sm:text-base">
                      {formatReadingTime(durationSeconds)}
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-secondary/25 p-6 text-center">
                <div>
                  <Trophy className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="font-serif text-lg font-semibold">
                    Tu ranking aparecerá aquí
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Termina libros con tiempo registrado para comparar tus
                    lecturas.
                  </p>
                </div>
              </div>
            )}
          </article>
        </section>

        <footer className="mt-10 border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
          <p>Tu biblioteca se guarda de forma privada en este dispositivo.</p>
        </footer>
      </div>

      <Dialog
        open={addBookOpen}
        onOpenChange={(open) => {
          setAddBookOpen(open);
          if (!open) resetAddBook();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md gap-5 overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-xl bg-secondary text-primary">
              <BookMarked className="size-5" />
            </span>
            <DialogTitle className="font-serif text-2xl">
              Añadir un libro
            </DialogTitle>
            <DialogDescription>
              Añade sus datos y una portada para reconocerlo de un vistazo.
            </DialogDescription>
          </DialogHeader>
          <form id="add-book-form" className="grid gap-4" onSubmit={addBook}>
            <div className="grid gap-2">
              <Label htmlFor="book-title">Título</Label>
              <Input
                id="book-title"
                name="title"
                placeholder="Ej. La amiga estupenda"
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-author">Autor o autora</Label>
              <Input
                id="book-author"
                name="author"
                placeholder="Ej. Elena Ferrante"
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-isbn">ISBN (opcional)</Label>
              <Input
                id="book-isbn"
                name="isbn"
                inputMode="text"
                autoComplete="off"
                maxLength={32}
                placeholder="Ej. 978-84-339-8068-5"
                className="h-10 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Puedes escribirlo con o sin guiones.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="book-pages">Páginas totales</Label>
                <Input
                  id="book-pages"
                  name="totalPages"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="336"
                  required
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="book-current-page">Página actual</Label>
                <Input
                  id="book-current-page"
                  name="currentPage"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-cover">Portada (opcional)</Label>
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/35 p-3">
                <span
                  className="relative grid h-24 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card text-muted-foreground shadow-sm"
                  aria-hidden="true"
                >
                  {coverImage ? (
                    <Image
                      src={coverImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    id="book-cover"
                    name="cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleCoverChange}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Label
                      htmlFor="book-cover"
                      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-secondary"
                    >
                      <ImagePlus className="size-4" />
                      {coverImage ? 'Cambiar' : 'Elegir imagen'}
                    </Label>
                    {coverImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={clearCover}
                        aria-label="Quitar portada"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {isProcessingCover
                      ? 'Preparando portada…'
                      : coverFileName || 'JPG, PNG o WebP · máximo 10 MB'}
                  </p>
                </div>
              </div>
              {coverError && (
                <p className="text-xs text-destructive" role="alert">
                  {coverError}
                </p>
              )}
            </div>
          </form>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-5">
            <Button
              variant="outline"
              type="button"
              onClick={() => setAddBookOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-book-form"
              disabled={isProcessingCover}
            >
              <Plus data-icon="inline-start" /> Añadir libro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingSession)}
        onOpenChange={(open) => {
          if (!open) resumePendingSession();
        }}
      >
        <DialogContent
          className="max-w-md gap-5 rounded-3xl p-6"
          showCloseButton={false}
        >
          <DialogHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-xl bg-secondary text-primary">
              <Timer className="size-5" />
            </span>
            <DialogTitle className="font-serif text-2xl">
              ¡Buena sesión!
            </DialogTitle>
            <DialogDescription>
              Has leído durante{' '}
              <strong className="text-foreground">
                {pendingSession
                  ? formatReadingTime(pendingSession.durationSeconds)
                  : ''}
              </strong>
              . ¿En qué página estás?
            </DialogDescription>
          </DialogHeader>
          <form
            id="save-session-form"
            className="grid gap-3"
            onSubmit={saveSession}
          >
            <Label htmlFor="session-current-page">Página actual</Label>
            <Input
              key={
                pendingSession
                  ? `${pendingSession.bookId}-${pendingSession.startedAt}`
                  : 'no-pending-session'
              }
              id="session-current-page"
              name="currentPage"
              type="number"
              inputMode="numeric"
              min={currentBook ? currentBook.currentPage + 1 : 1}
              max={currentBook?.totalPages}
              defaultValue={
                currentBook
                  ? Math.min(
                      currentBook.currentPage + 10,
                      currentBook.totalPages,
                    )
                  : 1
              }
              required
              className="h-14 text-center font-serif text-2xl font-semibold"
            />
            {currentBook && (
              <p className="text-center text-xs text-muted-foreground">
                Estabas en la página {currentBook.currentPage} de{' '}
                {currentBook.totalPages}.
              </p>
            )}
          </form>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-5">
            <Button
              variant="outline"
              type="button"
              onClick={resumePendingSession}
            >
              Seguir leyendo
            </Button>
            <Button type="submit" form="save-session-form">
              <CheckCircle2 data-icon="inline-start" /> Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(sessionSummary)}
        onOpenChange={(open) => !open && closeSessionSummary()}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-xl gap-0 overflow-y-auto rounded-3xl p-0"
          showCloseButton={false}
        >
          {sessionSummary && (
            <>
              <div className="bg-primary px-6 py-7 text-primary-foreground sm:px-8">
                <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-white/15">
                  <CheckCircle2 className="size-5" />
                </span>
                <DialogHeader className="gap-2 text-left">
                  <DialogTitle className="font-serif text-3xl text-primary-foreground">
                    {sessionSummary.completed
                      ? '¡Libro terminado!'
                      : 'Así ha ido tu lectura'}
                  </DialogTitle>
                  <DialogDescription className="text-primary-foreground/75">
                    Has avanzado {sessionSummary.pagesRead}{' '}
                    {sessionSummary.pagesRead === 1 ? 'página' : 'páginas'} de{' '}
                    <strong className="text-primary-foreground">
                      {sessionSummary.bookTitle}
                    </strong>{' '}
                    en {formatReadingTime(sessionSummary.durationSeconds)}.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="grid gap-5 p-6 sm:p-8">
                <Progress
                  value={Math.round(
                    (sessionSummary.currentPage / sessionSummary.totalPages) *
                      100,
                  )}
                  locale="es-ES"
                  className="gap-2"
                >
                  <ProgressLabel className="text-xs text-muted-foreground">
                    Página {sessionSummary.currentPage} de{' '}
                    {sessionSummary.totalPages}
                  </ProgressLabel>
                  <ProgressValue className="text-xs" />
                </Progress>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-secondary/70 p-4">
                    <Timer className="mb-4 size-4 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Tu velocidad
                    </p>
                    <p className="mt-1 font-serif text-xl font-semibold">
                      {formatPagesPerHour(sessionSummary.pagesPerHour)} pág./h
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      en esta sesión
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 p-4">
                    <BookOpen className="mb-4 size-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Te quedan</p>
                    <p className="mt-1 font-serif text-xl font-semibold">
                      {sessionSummary.remainingPages}{' '}
                      {sessionSummary.remainingPages === 1
                        ? 'página'
                        : 'páginas'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      para terminar
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 p-4">
                    <Clock3 className="mb-4 size-4 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Tiempo aproximado
                    </p>
                    <p className="mt-1 font-serif text-xl font-semibold">
                      {sessionSummary.completed
                        ? 'Completado'
                        : formatReadingTime(sessionSummary.remainingSeconds)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      a tu ritmo de hoy
                    </p>
                  </div>
                </div>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  La estimación se actualizará después de cada sesión según tu
                  ritmo de lectura.
                </p>

                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl"
                  onClick={closeSessionSummary}
                >
                  {sessionSummary.completed
                    ? 'Ver en mi estantería'
                    : 'Continuar'}
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedShelfBook)}
        onOpenChange={(open) => !open && setSelectedShelfBookId(null)}
      >
        <DialogContent className="max-w-md gap-5 rounded-3xl p-6">
          {selectedShelfBook && (
            <>
              <DialogHeader>
                <span
                  className="relative mb-3 h-24 w-16 overflow-hidden rounded-sm shadow-md"
                  style={{ backgroundColor: selectedShelfBook.color }}
                >
                  {selectedShelfBook.coverImage && (
                    <Image
                      src={selectedShelfBook.coverImage}
                      alt={`Portada de ${selectedShelfBook.title}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </span>
                <DialogTitle className="font-serif text-2xl">
                  {selectedShelfBook.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedShelfBook.author}
                  {selectedShelfBook.isbn && (
                    <span className="mt-1 block font-mono text-[11px]">
                      ISBN {selectedShelfBook.isbn}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <BookOpen className="mb-3 size-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Extensión</p>
                  <p className="mt-1 font-serif text-lg font-semibold">
                    {selectedShelfBook.totalPages} páginas
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <CalendarDays className="mb-3 size-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Terminado</p>
                  <p className="mt-1 font-serif text-lg font-semibold">
                    {selectedShelfBook.completedAt
                      ? formatFullDate(selectedShelfBook.completedAt)
                      : 'Completado'}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Tiempo registrado:{' '}
                <strong className="text-foreground">
                  {formatReadingTime(
                    sessions
                      .filter(
                        (session) => session.bookId === selectedShelfBook.id,
                      )
                      .reduce(
                        (sum, session) => sum + session.durationSeconds,
                        0,
                      ),
                  )}
                </strong>
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {notice && (
        <output
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[70] flex w-[min(92vw,520px)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#243e32] px-4 py-3 text-sm text-white shadow-2xl"
        >
          <CheckCircle2 className="size-4 shrink-0 text-[#eadb9c]" />
          <span>{notice}</span>
        </output>
      )}
    </main>
  );
}
