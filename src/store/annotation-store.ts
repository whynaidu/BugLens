import { create } from "zustand";

export type AnnotationTool = "select" | "rectangle" | "circle" | "arrow" | "freehand";

export interface LinkedBug {
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
  bugs?: LinkedBug[];  // Many-to-many: an annotation can have multiple bugs
}

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

  // Reset
  reset: () => void;
}

const DEFAULT_STROKE_COLOR = "#EF4444"; // Red
const DEFAULT_STROKE_WIDTH = 2;

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
    set({ annotations, isDirty: false });
  },

  addAnnotation: (annotation) => {
    set((state) => ({
      annotations: [...state.annotations, annotation],
      isDirty: true,
    }));
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
      isDirty: true,
    }));
  },

  deleteAnnotation: (id) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
      isDirty: true,
    }));
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
    const { drawingAnnotation, annotations } = get();
    if (drawingAnnotation) {
      set({
        isDrawing: false,
        drawingAnnotation: null,
        annotations: [...annotations, drawingAnnotation],
        selectedAnnotationId: drawingAnnotation.id,
        selectedTool: "select",
        isDirty: true,
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
    });
  },
}));
