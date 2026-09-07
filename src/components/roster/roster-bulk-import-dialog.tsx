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

import { useState } from "react";
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
  Upload,
  UserCheck,
  UserPlus,
  Users,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [step, setStep] = useState<"input" | "preview" | "results">("input");
  const [inputTab, setInputTab] = useState<string>("paste");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
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

  function handleReset() {
    setStep("input");
    setRawText("");
    setFileName(null);
    setParsedResult(null);
    setSelectedIndices(new Set());
    setIsSubmitting(false);
    setImportSummary(null);
    setError(null);
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  }

  function handleLoadSample() {
    const sample = generateSampleRosterCsv(context);
    setRawText(sample);
    setInputTab("paste");
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
      setError("Please paste or upload roster data before continuing.");
      return;
    }

    const res = parseRosterInput(rawText, { context });
    if (res.rows.length === 0) {
      setError("No valid roster rows found. Check your CSV or text format.");
      return;
    }

    setParsedResult(res);
    // Select all valid rows by default
    const validIndices = new Set<number>();
    res.rows.forEach((row, idx) => {
      if (row.valid) {
        validIndices.add(idx);
      }
    });
    setSelectedIndices(validIndices);
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
      setError("Please select at least one row to import.");
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
      toast.success(
        `Bulk import complete: ${summary.addedCount} added, ${summary.invitedCount} invited.`
      );
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl sm:max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Bulk import {isTeam ? "team players" : "school roster"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Import multiple athletes into {targetName} via CSV spreadsheet
                or pasted text.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Dialog body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: INPUT */}
          {step === "input" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Choose input method
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    CSV Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadSample}
                    className="h-7 text-xs"
                  >
                    Load sample data
                  </Button>
                </div>
              </div>

              <Tabs
                value={inputTab}
                onValueChange={(val) => {
                  if (val) setInputTab(val);
                }}
              >
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="paste" className="text-xs">
                    Paste text or CSV
                  </TabsTrigger>
                  <TabsTrigger value="file" className="text-xs">
                    Upload file
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="mt-3 space-y-2">
                  <Textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={
                      isTeam
                        ? "email,name,jersey,position,role\nalex@college.edu,Alex Morgan,12,OH,player\nsam@college.edu,Sam Lee,5,Setter,captain"
                        : "email,name,role,jersey,position,title\nalex@college.edu,Alex Morgan,member,12,OH,\nsam@college.edu,Sam Lee,officer,5,Setter,Vice President"
                    }
                    className="min-h-52 font-mono text-xs leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Accepts CSV, TSV (pasted from Excel or Google Sheets), or a
                    list of emails separated by commas or line breaks.
                  </p>
                </TabsContent>

                <TabsContent value="file" className="mt-3 space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">
                        Click to select or drag and drop a file
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Supports .csv, .tsv, and .txt files
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {fileName && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{fileName}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">
                        ({rawText.split("\n").filter(Boolean).length} lines)
                      </span>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === "preview" && parsedResult && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                  <div className="text-lg font-bold">
                    {parsedResult.totalRows}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Total parsed
                  </div>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 text-center text-success">
                  <div className="text-lg font-bold">
                    {parsedResult.validRows}
                  </div>
                  <div className="text-[11px]">Ready to import</div>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-center text-warning">
                  <div className="text-lg font-bold">
                    {parsedResult.invalidRows}
                  </div>
                  <div className="text-[11px]">Need attention</div>
                </div>
              </div>

              {parsedResult.duplicateEmails.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {parsedResult.duplicateEmails.length} duplicate email(s)
                    found in file. Only the first entry will be processed.
                  </span>
                </div>
              )}

              {/* Parsed rows table */}
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
                    {parsedResult.rows.map((row, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      return (
                        <TableRow
                          key={idx}
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
                              onCheckedChange={() => toggleRow(idx)}
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

          {/* STEP 3: RESULTS SUMMARY */}
          {step === "results" && importSummary && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 text-center text-success">
                  <div className="text-lg font-bold">
                    {importSummary.addedCount}
                  </div>
                  <div className="text-[11px]">Added</div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-center text-primary">
                  <div className="text-lg font-bold">
                    {importSummary.invitedCount}
                  </div>
                  <div className="text-[11px]">Invites sent</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-2.5 text-center text-muted-foreground">
                  <div className="text-lg font-bold">
                    {importSummary.skippedCount}
                  </div>
                  <div className="text-[11px]">Skipped</div>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-center text-destructive">
                  <div className="text-lg font-bold">
                    {importSummary.failedCount}
                  </div>
                  <div className="text-[11px]">Failed</div>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-xs font-semibold">
                  Row-by-row outcome
                </div>
                <div className="divide-y max-h-60 overflow-y-auto">
                  {importSummary.results.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.status === "added" && (
                          <UserCheck className="h-4 w-4 text-success shrink-0" />
                        )}
                        {item.status === "invited" && (
                          <Mail className="h-4 w-4 text-primary shrink-0" />
                        )}
                        {item.status === "skipped" && (
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {item.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <span className="font-mono text-[11px] truncate">
                          {item.email}
                        </span>
                        {item.fullName && (
                          <span className="text-muted-foreground truncate hidden sm:inline">
                            ({item.fullName})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground text-right shrink-0">
                        {item.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dialog footer */}
        <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
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
                className="text-xs"
              >
                Preview & Validate
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("input")}
                disabled={isSubmitting}
                className="text-xs"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to edit
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
                    Importing {selectedCount} athletes...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Import {selectedCount} {isTeam ? "players" : "members"}
                  </>
                )}
              </Button>
            </>
          )}

          {step === "results" && (
            <div className="w-full flex justify-end">
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
