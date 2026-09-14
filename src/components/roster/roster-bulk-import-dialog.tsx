"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VOLLEYBALL_POSITION_LABELS } from "@/lib/constants/profile";
import {
  generateSampleRosterCsv,
  parseRosterInput,
  type ParseRosterResult,
} from "@/lib/roster/bulk-import-parser";
import type {
  BulkImportRowInput,
  BulkImportSummaryResult,
} from "@/lib/api/queries/roster-bulk-import";
import { cn } from "@/lib/utils";

interface RosterBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "school" | "team";
  targetId: string;
  targetName: string;
  onImport: (
    targetId: string,
    rows: BulkImportRowInput[]
  ) => Promise<BulkImportSummaryResult>;
  onSuccess?: () => void;
}

const STEPS = ["Paste", "Review", "Done"] as const;

export function RosterBulkImportDialog({
  open,
  onOpenChange,
  context,
  targetId,
  targetName,
  onImport,
  onSuccess,
}: RosterBulkImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"input" | "preview" | "results">("input");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParseRosterResult | null>(
    null
  );
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSummary, setImportSummary] =
    useState<BulkImportSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTeam = context === "team";
  const stepIndex = step === "input" ? 0 : step === "preview" ? 1 : 2;

  function handleReset() {
    setStep("input");
    setRawText("");
    setFileName(null);
    setIsDragging(false);
    setShowInvalidOnly(false);
    setParsedResult(null);
    setSelectedIndices(new Set());
    setIsSubmitting(false);
    setImportSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (step === "results") {
        router.refresh();
      }
      handleReset();
    }
    onOpenChange(nextOpen);
  }

  function applyFile(file: File) {
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function clearFile() {
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadTemplate() {
    const csvContent = generateSampleRosterCsv(context);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${context === "team" ? "team" : "school"}-roster-template.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePreview() {
    setError(null);
    if (!rawText.trim()) {
      setError("Paste roster data or attach a CSV before continuing.");
      return;
    }

    const res = parseRosterInput(rawText, { context });
    if (res.rows.length === 0) {
      setError("No roster rows found. Check the format and try again.");
      return;
    }

    setParsedResult(res);
    const validIndices = new Set<number>();
    res.rows.forEach((row, idx) => {
      if (row.valid) validIndices.add(idx);
    });
    setSelectedIndices(validIndices);
    setShowInvalidOnly(res.validRows === 0 && res.invalidRows > 0);
    setStep("preview");
  }

  function toggleRow(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!parsedResult) return;
    if (checked) {
      const allValid = new Set<number>();
      parsedResult.rows.forEach((r, idx) => {
        if (r.valid) allValid.add(idx);
      });
      setSelectedIndices(allValid);
    } else {
      setSelectedIndices(new Set());
    }
  }

  async function handleExecuteImport() {
    if (!parsedResult) return;

    const rowsToImport: BulkImportRowInput[] = [];
    parsedResult.rows.forEach((row, idx) => {
      if (selectedIndices.has(idx) && row.valid) {
        rowsToImport.push({
          email: row.email,
          fullName: row.fullName,
          jerseyNumber: row.jerseyNumber,
          volleyballPosition: row.volleyballPosition,
          role: row.role,
          title: row.title,
        });
      }
    });

    if (rowsToImport.length === 0) {
      setError("Select at least one row to import.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const summary = await onImport(targetId, rowsToImport);
      setIsSubmitting(false);

      if (!summary.success && summary.error) {
        setError(summary.error);
        toast.error(summary.error);
        return;
      }

      setImportSummary(summary);
      setStep("results");
      onSuccess?.();
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Bulk import failed";
      setError(msg);
      toast.error(msg);
    }
  }

  const selectedCount = selectedIndices.size;
  const allValidSelected =
    parsedResult !== null &&
    parsedResult.validRows > 0 &&
    selectedCount === parsedResult.validRows;

  const visibleRows =
    parsedResult?.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => (showInvalidOnly ? !row.valid : true)) ?? [];

  const placeholder = isTeam
    ? "email, name, jersey, position, role\nalex@college.edu, Alex Morgan, 12, OH, player"
    : "email, name, role, jersey, position, title\nalex@college.edu, Alex Morgan, member, 12, OH,";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl sm:max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-3 p-5 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold">
                Bulk import {isTeam ? "players" : "roster"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add multiple athletes to {targetName} from a spreadsheet or
                pasted list.
              </DialogDescription>
            </div>
          </div>
          <ol className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {STEPS.map((label, index) => (
              <li key={label} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <span
                  className={cn(
                    index === stepIndex && "font-semibold text-foreground",
                    index < stepIndex && "text-foreground/70"
                  )}
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "input" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  CSV, TSV from Sheets/Excel, or a list of emails.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Template
                </Button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={cn(
                  "rounded-xl border transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <Textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    if (fileName) clearFile();
                  }}
                  placeholder={placeholder}
                  className="min-h-52 border-0 bg-transparent font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  Attach file
                </Button>
                {fileName ? (
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">{fileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearFile();
                        setRawText("");
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="Remove attached file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Or drop a .csv / .tsv / .txt onto the field above
                  </span>
                )}
              </div>
            </div>
          )}

          {step === "preview" && parsedResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {parsedResult.validRows}
                  </span>{" "}
                  ready
                  {parsedResult.invalidRows > 0 ? (
                    <>
                      {" · "}
                      <span className="font-medium text-warning">
                        {parsedResult.invalidRows}
                      </span>{" "}
                      need attention
                    </>
                  ) : null}
                  {" · "}
                  {selectedCount} selected
                </p>
                {parsedResult.invalidRows > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowInvalidOnly((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {showInvalidOnly ? "Show all rows" : "Show problems only"}
                  </button>
                ) : null}
              </div>

              {parsedResult.duplicateEmails.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {parsedResult.duplicateEmails.length} duplicate email
                    {parsedResult.duplicateEmails.length === 1 ? "" : "s"} in
                    the file — only the first of each is kept.
                  </span>
                </div>
              )}

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-[11px]">
                      <TableHead className="w-10 p-2 text-center">
                        <Checkbox
                          checked={allValidSelected}
                          onCheckedChange={(checked) =>
                            toggleAll(Boolean(checked))
                          }
                          aria-label="Select all valid rows"
                        />
                      </TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-20">Role</TableHead>
                      <TableHead className="w-16">Jersey</TableHead>
                      <TableHead className="w-24">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map(({ row, index }) => {
                      const isSelected = selectedIndices.has(index);
                      return (
                        <TableRow
                          key={index}
                          className={cn(
                            "text-xs transition-colors",
                            !row.valid && "opacity-60 bg-muted/10",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <TableCell className="p-2 text-center">
                            <Checkbox
                              checked={isSelected}
                              disabled={!row.valid}
                              onCheckedChange={() => toggleRow(index)}
                              aria-label={`Select ${row.email}`}
                            />
                          </TableCell>
                          <TableCell>
                            {row.valid ? (
                              <Badge
                                variant="outline"
                                className="bg-success/10 text-success border-success/30 text-[10px] px-1.5 py-0"
                              >
                                Ready
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0"
                              >
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] truncate max-w-[180px]">
                            {row.email}
                            {row.errors.length > 0 && (
                              <p className="text-[10px] text-destructive mt-0.5">
                                {row.errors[0]}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="truncate max-w-[120px]">
                            {row.fullName || "—"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {row.role}
                            {row.title && (
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {row.title}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.jerseyNumber !== null
                              ? `#${row.jerseyNumber}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {row.volleyballPosition
                              ? VOLLEYBALL_POSITION_LABELS[
                                  row.volleyballPosition
                                ] || row.volleyballPosition
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === "results" && importSummary && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <p className="text-sm">
                <span className="font-medium text-success">
                  {importSummary.addedCount} added
                </span>
                {" · "}
                <span className="font-medium text-primary">
                  {importSummary.invitedCount} invited
                </span>
                {importSummary.skippedCount > 0 ? (
                  <>
                    {" · "}
                    <span className="text-muted-foreground">
                      {importSummary.skippedCount} skipped
                    </span>
                  </>
                ) : null}
                {importSummary.failedCount > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">
                      {importSummary.failedCount} failed
                    </span>
                  </>
                ) : null}
              </p>

              <div className="rounded-lg border overflow-hidden">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {importSummary.results.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {item.status === "added" && (
                          <UserCheck className="h-4 w-4 shrink-0 text-success" />
                        )}
                        {item.status === "invited" && (
                          <Mail className="h-4 w-4 shrink-0 text-primary" />
                        )}
                        {item.status === "skipped" && (
                          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {item.status === "failed" && (
                          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <span className="truncate font-mono text-[11px]">
                          {item.email}
                        </span>
                        {item.fullName ? (
                          <span className="hidden truncate text-muted-foreground sm:inline">
                            ({item.fullName})
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                        {item.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/10 p-4 flex items-center justify-between sm:justify-between">
          {step === "input" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePreview}
                disabled={!rawText.trim()}
                className="text-xs"
              >
                Review
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setStep("input");
                }}
                disabled={isSubmitting}
                className="text-xs"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteImport}
                disabled={isSubmitting || selectedCount === 0}
                className="text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Importing {selectedCount}…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Import {selectedCount}
                  </>
                )}
              </Button>
            </>
          )}

          {step === "results" && (
            <div className="flex w-full justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
