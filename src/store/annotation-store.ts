import { create } from "zustand";

export type AnnotationTool = "select" | "rectangle" | "circle" | "arrow" | "freehand";

export interface LinkedTestCase {
  id: string;
  title: string;
  status: string;
  severity: string;
}

export interface Annotation {
  id: string;
  type: "rectangle" | "circle" | "arrow" | "freehand";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  stroke: string;
  strokeWidth: number;
  testCases?: LinkedTestCase[];  // Many-to-many: an annotation can have multiple test cases
}

// History entry for undo/redo
interface HistoryEntry {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
}

// Maximum number of history entries to keep
const MAX_HISTORY_SIZE = 50;

interface AnnotationState {
  // Tool state
  selectedTool: AnnotationTool;
  strokeColor: string;
  strokeWidth: number;

  // Selection state
  selectedAnnotationId: string | null;

  // Annotations
  annotations: Annotation[];

  // Drawing state
  isDrawing: boolean;
  drawingAnnotation: Annotation | null;

  // View state
  zoom: number;
  panX: number;
  panY: number;

  // Sync state
  isDirty: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;

  // History state for undo/redo
  history: HistoryEntry[];
  future: HistoryEntry[];

  // Actions - Tools
  setTool: (tool: AnnotationTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;

  // Actions - Selection
  selectAnnotation: (id: string | null) => void;

  // Actions - Annotations
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  replaceAnnotationId: (oldId: string, newId: string) => void;

  // Actions - Drawing
  startDrawing: (annotation: Annotation) => void;
  updateDrawing: (updates: Partial<Annotation>) => void;
  finishDrawing: () => Annotation | null;
  cancelDrawing: () => void;

  // Actions - View
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;

  // Actions - Sync
  markAsSynced: () => void;
  markAsDirty: () => void;
  setSyncError: (error: string | null) => void;

  // Actions - History (Undo/Redo)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // Reset
  reset: () => void;
}

const DEFAULT_STROKE_COLOR = "#EF4444"; // Red
const DEFAULT_STROKE_WIDTH = 2;

// Helper to create a deep copy of annotations for history
const cloneAnnotations = (annotations: Annotation[]): Annotation[] => {
  return annotations.map(a => ({
    ...a,
    points: a.points ? [...a.points] : undefined,
    testCases: a.testCases ? [...a.testCases] : undefined,
  }));
};

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  // Initial state
  selectedTool: "select",
  strokeColor: DEFAULT_STROKE_COLOR,
  strokeWidth: DEFAULT_STROKE_WIDTH,
  selectedAnnotationId: null,
  annotations: [],
  isDrawing: false,
  drawingAnnotation: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDirty: false,
  lastSyncedAt: null,
  syncError: null,
  history: [],
  future: [],

  // Tool actions
  setTool: (tool) => {
    set({ selectedTool: tool, selectedAnnotationId: null });
  },

  setStrokeColor: (color) => {
    set({ strokeColor: color });
  },

  setStrokeWidth: (width) => {
    set({ strokeWidth: width });
  },

  // Selection actions
  selectAnnotation: (id) => {
    set({ selectedAnnotationId: id, selectedTool: "select" });
  },

  // Annotation actions
  setAnnotations: (annotations) => {
    // When setting annotations from server, clear history and future
    set({ annotations, isDirty: false, history: [], future: [] });
  },

  addAnnotation: (annotation) => {
    const { annotations, selectedAnnotationId, history } = get();
    // Push current state to history before making changes
    const newHistory = [
      ...history.slice(-MAX_HISTORY_SIZE + 1),
      { annotations: cloneAnnotations(annotations), selectedAnnotationId },
    ];
    set({
      annotations: [...annotations, annotation],
      isDirty: true,
      history: newHistory,
      future: [], // Clear future on new action
    });
  },

  updateAnnotation: (id, updates) => {
    const { annotations, selectedAnnotationId, history } = get();
    // Push current state to history before making changes
    const newHistory = [
      ...history.slice(-MAX_HISTORY_SIZE + 1),
      { annotations: cloneAnnotations(annotations), selectedAnnotationId },
    ];
    set({
      annotations: annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
      isDirty: true,
      history: newHistory,
      future: [], // Clear future on new action
    });
  },

  deleteAnnotation: (id) => {
    const { annotations, selectedAnnotationId, history } = get();
    // Push current state to history before making changes
    const newHistory = [
      ...history.slice(-MAX_HISTORY_SIZE + 1),
      { annotations: cloneAnnotations(annotations), selectedAnnotationId },
    ];
    set({
      annotations: annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        selectedAnnotationId === id ? null : selectedAnnotationId,
      isDirty: true,
      history: newHistory,
      future: [], // Clear future on new action
    });
  },

  replaceAnnotationId: (oldId, newId) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === oldId ? { ...a, id: newId } : a
      ),
      selectedAnnotationId:
        state.selectedAnnotationId === oldId ? newId : state.selectedAnnotationId,
    }));
  },

  // Drawing actions
  startDrawing: (annotation) => {
    set({
      isDrawing: true,
      drawingAnnotation: annotation,
    });
  },

  updateDrawing: (updates) => {
    const { drawingAnnotation } = get();
    if (drawingAnnotation) {
      set({
        drawingAnnotation: { ...drawingAnnotation, ...updates },
      });
    }
  },

  finishDrawing: () => {
    const { drawingAnnotation, annotations, selectedAnnotationId, history } = get();
    if (drawingAnnotation) {
      // Push current state to history before making changes
      const newHistory = [
        ...history.slice(-MAX_HISTORY_SIZE + 1),
        { annotations: cloneAnnotations(annotations), selectedAnnotationId },
      ];
      set({
        isDrawing: false,
        drawingAnnotation: null,
        annotations: [...annotations, drawingAnnotation],
        selectedAnnotationId: drawingAnnotation.id,
        selectedTool: "select",
        isDirty: true,
        history: newHistory,
        future: [], // Clear future on new action
      });
      return drawingAnnotation;
    }
    return null;
  },

  cancelDrawing: () => {
    set({
      isDrawing: false,
      drawingAnnotation: null,
    });
  },

  // View actions
  setZoom: (zoom) => {
    // Clamp zoom between 0.25 and 4
    const clampedZoom = Math.max(0.25, Math.min(4, zoom));
    set({ zoom: clampedZoom });
  },

  setPan: (x, y) => {
    set({ panX: x, panY: y });
  },

  resetView: () => {
    set({ zoom: 1, panX: 0, panY: 0 });
  },

  // Sync actions
  markAsSynced: () => {
    set({
      isDirty: false,
      lastSyncedAt: Date.now(),
      syncError: null,
    });
  },

  markAsDirty: () => {
    set({ isDirty: true });
  },

  setSyncError: (error) => {
    set({ syncError: error });
  },

  // History actions (Undo/Redo)
  undo: () => {
    const { history, annotations, selectedAnnotationId, future } = get();
    if (history.length === 0) return;

    // Get the last history entry
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    // Push current state to future for redo
    const newFuture = [
      ...future,
      { annotations: cloneAnnotations(annotations), selectedAnnotationId },
    ];

    set({
      annotations: cloneAnnotations(previous.annotations),
      selectedAnnotationId: previous.selectedAnnotationId,
      history: newHistory,
      future: newFuture,
      isDirty: true,
    });
  },

  redo: () => {
    const { future, annotations, selectedAnnotationId, history } = get();
    if (future.length === 0) return;

    // Get the last future entry
    const next = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    // Push current state to history
    const newHistory = [
      ...history,
      { annotations: cloneAnnotations(annotations), selectedAnnotationId },
    ];

    set({
      annotations: cloneAnnotations(next.annotations),
      selectedAnnotationId: next.selectedAnnotationId,
      history: newHistory,
      future: newFuture,
      isDirty: true,
    });
  },

  canUndo: () => {
    return get().history.length > 0;
  },

  canRedo: () => {
    return get().future.length > 0;
  },

  clearHistory: () => {
    set({ history: [], future: [] });
  },

  // Reset all state
  reset: () => {
    set({
      selectedTool: "select",
      strokeColor: DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      selectedAnnotationId: null,
      annotations: [],
      isDrawing: false,
      drawingAnnotation: null,
      zoom: 1,
      panX: 0,
      panY: 0,
      isDirty: false,
      lastSyncedAt: null,
      syncError: null,
      history: [],
      future: [],
    });
  },
}));
