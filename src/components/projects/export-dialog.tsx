"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Image,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Bug status and severity options
const bugStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "WONT_FIX",
] as const;

const bugSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface ExportDialogProps {
  projectId: string;
  projectName: string;
  trigger?: React.ReactNode;
}

type ExportFormat = "pdf" | "excel";
type JobStatus = "idle" | "pending" | "processing" | "completed" | "failed";

interface ExportJob {
  id: string;
  status: JobStatus;
  progress: number;
  fileUrl?: string;
  error?: string;
}

export function ExportDialog({
  projectId,
  projectName,
  trigger,
}: ExportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Format selection
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");

  // Filters
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d" | "90d" | "custom">("all");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [includeScreenshots, setIncludeScreenshots] = useState(true);

  // Job state
  const [job, setJob] = useState<ExportJob | null>(null);

  // Calculate actual date range based on selection
  const getDateFilters = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        return { dateFrom: subDays(now, 7).toISOString(), dateTo: now.toISOString() };
      case "30d":
        return { dateFrom: subDays(now, 30).toISOString(), dateTo: now.toISOString() };
      case "90d":
        return { dateFrom: subDays(now, 90).toISOString(), dateTo: now.toISOString() };
      case "custom":
        return {
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        };
      default:
        return {};
    }
  }, [dateRange, dateFrom, dateTo]);

  // Extract job properties for dependency tracking
  const jobId = job?.id;
  const jobStatus = job?.status;

  // Poll for job status
  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed" || jobStatus === "idle") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/export/status?jobId=${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to get status");
        }

        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                progress: data.progress,
                fileUrl: data.fileUrl,
                error: data.error,
              }
            : null
        );

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(pollInterval);
        }
      } catch {
        // Keep polling on error
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [jobId, jobStatus]);

  const handleExport = async () => {
    try {
      const filters = {
        ...getDateFilters(),
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        severity: selectedSeverities.length > 0 ? selectedSeverities : undefined,
        includeScreenshots: exportFormat === "pdf" ? includeScreenshots : false,
      };

      const endpoint = exportFormat === "pdf" ? "/api/export/pdf" : "/api/export/excel";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filters }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start export");
      }

      setJob({
        id: data.jobId,
        status: "pending",
        progress: 0,
      });

      toast({
        title: "Export started",
        description: `Your ${exportFormat.toUpperCase()} export is being generated...`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!job?.fileUrl) return;

    // Create a download link
    const link = document.createElement("a");
    link.href = job.fileUrl;
    link.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}-export-${exportFormat === "pdf" ? "report.pdf" : "data.xlsx"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download started",
      description: "Your export file is being downloaded.",
    });
  };

  const handleReset = () => {
    setJob(null);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  const isProcessing = job?.status === "pending" || job?.status === "processing";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Bugs</DialogTitle>
          <DialogDescription>
            Export bug data from {projectName} as PDF or Excel.
          </DialogDescription>
        </DialogHeader>

        {job?.status === "completed" ? (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Export Complete!</h3>
              <p className="text-muted-foreground text-sm">
                Your {exportFormat.toUpperCase()} file is ready for download.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Export Another
              </Button>
            </div>
          </div>
        ) : job?.status === "failed" ? (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Export Failed</h3>
              <p className="text-muted-foreground text-sm">
                {job.error || "An unknown error occurred."}
              </p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              Try Again
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="py-8 space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Generating Export...</h3>
              <p className="text-muted-foreground text-sm">
                Please wait while we prepare your {exportFormat.toUpperCase()} file.
              </p>
            </div>
            <Progress value={job?.progress || 0} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {job?.progress || 0}% complete
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-6 py-4">
              {/* Format Selection */}
              <div className="space-y-3">
                <Label>Export Format</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setExportFormat("pdf")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors",
                      exportFormat === "pdf"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <FileText
                      className={cn(
                        "h-8 w-8",
                        exportFormat === "pdf" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-medium">PDF Report</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Visual report with screenshots
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat("excel")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors",
                      exportFormat === "excel"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <FileSpreadsheet
                      className={cn(
                        "h-8 w-8",
                        exportFormat === "excel" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-medium">Excel Spreadsheet</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Data for analysis
                    </span>
                  </button>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-3">
                <Label>Date Range</Label>
                <Select
                  value={dateRange}
                  onValueChange={(v) => setDateRange(v as typeof dateRange)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>

                {dateRange === "custom" && (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 justify-start text-left font-normal"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 justify-start text-left font-normal"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-3">
                <Label>Status Filter</Label>
                <div className="flex flex-wrap gap-2">
                  {bugStatuses.map((status) => (
                    <Badge
                      key={status}
                      variant={selectedStatuses.includes(status) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(status)}
                    >
                      <Checkbox
                        checked={selectedStatuses.includes(status)}
                        className="mr-1.5 h-3 w-3"
                      />
                      {status.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
                {selectedStatuses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No filter applied - all statuses will be included
                  </p>
                )}
              </div>

              {/* Severity Filter */}
              <div className="space-y-3">
                <Label>Severity Filter</Label>
                <div className="flex flex-wrap gap-2">
                  {bugSeverities.map((severity) => (
                    <Badge
                      key={severity}
                      variant={selectedSeverities.includes(severity) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSeverity(severity)}
                    >
                      <Checkbox
                        checked={selectedSeverities.includes(severity)}
                        className="mr-1.5 h-3 w-3"
                      />
                      {severity}
                    </Badge>
                  ))}
                </div>
                {selectedSeverities.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No filter applied - all severities will be included
                  </p>
                )}
              </div>

              {/* Screenshots Toggle (PDF only) */}
              {exportFormat === "pdf" && (
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Image className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="screenshots" className="cursor-pointer">
                        Include Screenshots
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Add annotated screenshots to the PDF report
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="screenshots"
                    checked={includeScreenshots}
                    onCheckedChange={setIncludeScreenshots}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                {exportFormat === "pdf" ? (
                  <FileText className="h-4 w-4 mr-2" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Generate {exportFormat.toUpperCase()}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
