"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  parseFile,
  validateImportData,
  downloadCSVTemplate,
  downloadExcelTemplate,
  type ValidationResult,
  type RowValidationResult,
} from "@/lib/import-utils";

type Step = "upload" | "preview" | "importing" | "complete";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  moduleName: string;
  onSuccess?: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  moduleId,
  moduleName,
  onSuccess,
}: ImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreateMutation = trpc.testcases.bulkCreate.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setStep("complete");
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} created`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      toast.success(`Successfully imported: ${parts.join(", ")}`);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
      setStep("preview");
    },
  });

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setParseError(null);
    setValidationResult(null);
    setImportProgress(0);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onOpenChange(false);
  }, [handleReset, onOpenChange]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);

    try {
      const rows = await parseFile(selectedFile);

      if (rows.length === 0) {
        setParseError("The file appears to be empty. Please add some data.");
        return;
      }

      const result = validateImportData(rows);
      setValidationResult(result);
      setStep("preview");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse file");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const fileName = droppedFile.name.toLowerCase();
        if (fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          handleFileSelect(droppedFile);
        } else {
          setParseError("Please upload a CSV or Excel (.xlsx) file");
        }
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handleImport = useCallback(async () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      return;
    }

    setStep("importing");
    setImportProgress(0);

    const testCases = validationResult.validRows.map((row) => row.data!);

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      await bulkCreateMutation.mutateAsync({
        moduleId,
        testCases,
      });
    } finally {
      clearInterval(progressInterval);
      setImportProgress(100);
    }
  }, [validationResult, moduleId, bulkCreateMutation]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Test Cases</DialogTitle>
          <DialogDescription>
            Import test cases into <strong>{moduleName}</strong> from a CSV or Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drop a CSV or Excel file here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              </div>

              {/* Parse error */}
              {parseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}

              {/* Template downloads */}
              <div className="flex items-center justify-center gap-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Download template:</span>
                <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadExcelTemplate()}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel Template
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && validationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{file?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.totalRows} rows found
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {validationResult.validRows.length} valid
                  </Badge>
                  {validationResult.invalidRows.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationResult.invalidRows.length} errors
                    </Badge>
                  )}
                </div>
              </div>

              {/* Preview table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead className="w-24">Ref ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-24">Severity</TableHead>
                      <TableHead className="w-24">Priority</TableHead>
                      <TableHead className="w-48">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Show invalid rows first */}
                    {validationResult.invalidRows.map((row) => (
                      <PreviewRow key={`invalid-${row.rowIndex}`} row={row} />
                    ))}
                    {/* Then show valid rows */}
                    {validationResult.validRows.map((row) => (
                      <PreviewRow key={`valid-${row.rowIndex}`} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {validationResult.invalidRows.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Rows with errors will be skipped during import. You can fix them in your file and re-upload.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Importing test cases...</p>
                <p className="text-sm text-muted-foreground">
                  Please wait while we create your test cases.
                </p>
              </div>
              <Progress value={importProgress} className="w-64" />
            </div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && importResult && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Import Complete</p>
                <div className="text-muted-foreground space-y-1">
                  {importResult.created > 0 && (
                    <p>Created <strong>{importResult.created}</strong> new test case{importResult.created !== 1 ? "s" : ""}</p>
                  )}
                  {importResult.updated > 0 && (
                    <p>Updated <strong>{importResult.updated}</strong> existing test case{importResult.updated !== 1 ? "s" : ""}</p>
                  )}
                  {importResult.errors.length > 0 && (
                    <p className="text-destructive">({importResult.errors.length} skipped due to errors)</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validationResult || validationResult.validRows.length === 0}
              >
                Import {validationResult?.validRows.length ?? 0} Test Cases
              </Button>
            </>
          )}

          {step === "importing" && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </Button>
          )}

          {step === "complete" && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PreviewRowProps {
  row: RowValidationResult;
}

function PreviewRow({ row }: PreviewRowProps) {
  const { isValid, errors, rawData, data } = row;

  return (
    <TableRow className={cn(!isValid && "bg-destructive/5")}>
      <TableCell className="font-mono text-sm">{row.rowIndex}</TableCell>
      <TableCell>
        {isValid ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </TableCell>
      <TableCell className="max-w-[100px]">
        <span className="truncate block font-mono text-xs" title={rawData.reference_id || ""}>
          {rawData.reference_id || <span className="text-muted-foreground">-</span>}
        </span>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <span className="truncate block" title={rawData.title || ""}>
          {rawData.title || <span className="text-muted-foreground italic">Missing</span>}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {data?.severity || rawData.severity || "MEDIUM"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {data?.priority || rawData.priority || "MEDIUM"}
        </Badge>
      </TableCell>
      <TableCell>
        {errors.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-destructive text-sm">
                  <AlertCircle className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{errors[0]}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[300px]">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, i) => (
                    <li key={i} className="text-sm">{error}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
    </TableRow>
  );
}
