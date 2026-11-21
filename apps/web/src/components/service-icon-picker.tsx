"use client";

import { useId, useMemo, useState, type ChangeEvent } from "react";
import {
  SERVICE_ICONS,
  SERVICE_ICON_CATEGORIES,
  ServiceIcon,
  isImageUrl,
} from "./service-icon";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Link as LinkIcon,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

interface ServiceIconPickerProps {
  label: string;
  defaultValue?: string | null;
  name?: string;
  locale?: string;
}

type TabMode = "vector" | "upload" | "url";

export function ServiceIconPicker({
  label,
  defaultValue = "Globe",
  name = "icon",
  locale = "en",
}: ServiceIconPickerProps) {
  const isBn = locale === "bn";
  const inputId = useId();

  // Determine initial mode based on whether defaultValue is an image URL
  const initialMode: TabMode = useMemo(() => {
    if (!defaultValue) return "vector";
    if (isImageUrl(defaultValue)) {
      return defaultValue.startsWith("http://") || defaultValue.startsWith("https://") ? "url" : "upload";
    }
    return "vector";
  }, [defaultValue]);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<TabMode>(initialMode);
  const [selectedVector, setSelectedVector] = useState<string>(
    defaultValue && !isImageUrl(defaultValue) ? defaultValue : "Globe"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrl, setCustomUrl] = useState(
    defaultValue && isImageUrl(defaultValue) ? defaultValue : ""
  );
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Active value to be displayed in the live preview
  const previewValue = useMemo(() => {
    if (filePreview) return filePreview;
    if (mode === "url" && customUrl.trim()) return customUrl.trim();
    if (mode === "upload" && defaultValue && isImageUrl(defaultValue)) return defaultValue;
    return selectedVector;
  }, [filePreview, mode, customUrl, defaultValue, selectedVector]);

  // Value passed into hidden input for submission
  const hiddenInputValue = useMemo(() => {
    if (filePreview) return ""; // Server action will prioritize uploaded file
    if (mode === "url" && customUrl.trim()) return customUrl.trim();
    if (mode === "upload" && defaultValue && isImageUrl(defaultValue)) return defaultValue;
    return selectedVector;
  }, [filePreview, mode, customUrl, defaultValue, selectedVector]);

  // Display label for the current selection
  const currentDisplayName = useMemo(() => {
    if (fileName) return fileName;
    if (mode === "url" && customUrl.trim()) return customUrl.trim();
    if (mode === "upload" && defaultValue && isImageUrl(defaultValue)) {
      return isBn ? "আপলোডকৃত লোগো" : "Uploaded Logo";
    }
    return selectedVector || "Globe";
  }, [fileName, mode, customUrl, defaultValue, selectedVector, isBn]);

  // Filtered icons
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SERVICE_ICON_CATEGORIES;

    return SERVICE_ICON_CATEGORIES.map((cat) => ({
      name: cat.name,
      icons: cat.icons.filter(
        (icon) =>
          icon.name.toLowerCase().includes(q) ||
          icon.label.toLowerCase().includes(q) ||
          icon.keywords.some((k) => k.toLowerCase().includes(q))
      ),
    })).filter((cat) => cat.icons.length > 0);
  }, [searchQuery]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (filePreview) URL.revokeObjectURL(filePreview);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      setFileName(file.name);
      // Auto-hide the picker panel after selecting the logo file
      setIsOpen(false);
    }
  };

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setFileName(null);
  };

  return (
    <div className="content-field content-field-wide space-y-3">
      {/* Hidden input storing the icon name / URL for form submission */}
      <input type="hidden" id={inputId} name={name} value={hiddenInputValue} />

      {/* Field Label & Trigger Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <label htmlFor={inputId} className="font-semibold text-xs text-foreground uppercase tracking-wider block">
          {label}
        </label>

        {/* Logo Selection Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 transition-all cursor-pointer shadow-sm text-left ${
            isOpen
              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
          }`}
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <ServiceIcon icon={previewValue} className="h-4 w-4" imgClassName="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
                {isBn ? "নির্বাচিত লোগো" : "Selected Logo"}
              </span>
              <span className="block text-xs font-medium text-foreground truncate max-w-[160px] sm:max-w-[200px]">
                {currentDisplayName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
            <span className="text-xs font-semibold text-primary">
              {isOpen
                ? (isBn ? "বন্ধ করুন" : "Close")
                : (isBn ? "লোগো নির্বাচন" : "Choose Logo")}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Collapsible Logo Picker Container */}
      <div
        className={`rounded-2xl border bg-card p-4 space-y-4 shadow-sm transition-all duration-200 ${
          isOpen ? "block animate-in fade-in-50 zoom-in-95" : "hidden"
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {isBn ? "সার্ভিস লোগো বা আইকন বেছে নিন" : "Choose Service Logo or Icon"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isBn ? "(ক্লিক করলেই সেট হবে এবং প্যানেল বন্ধ হবে)" : "(Clicking a logo selects it and closes this panel)"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Mode Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode("vector")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              mode === "vector"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{isBn ? "ভেক্টর আইকন" : "Vector Icons"}</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-mono text-primary font-bold">
              32
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              mode === "upload"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span>{isBn ? "লোগো ফাইল আপলোড" : "Upload Logo"}</span>
            {filePreview && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              mode === "url"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5 text-primary" />
            <span>{isBn ? "ইমেজ লিঙ্ক" : "Image URL"}</span>
          </button>
        </div>

        {/* ──────────────── TAB 1: VECTOR ICON GALLERY ──────────────── */}
        {mode === "vector" && (
          <div className="space-y-4">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? "আইকন সার্চ করুন (যেমন: cloud, ai, code, database)..." : "Search icons (e.g. cloud, ai, code, database)..."}
                className="w-full rounded-xl border bg-background py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Categorized Grid */}
            <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
              {filteredCategories.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <p>{isBn ? "কোনো আইকন পাওয়া যায়নি" : "No matching icons found"}</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {isBn ? "অনুসন্ধান মুছুন" : "Clear search"}
                  </button>
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.name} className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      {cat.name}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {cat.icons.map((item) => {
                        const IconComp = SERVICE_ICONS[item.name];
                        const isSelected = selectedVector === item.name && !filePreview && mode === "vector";
                        if (!IconComp) return null;

                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => {
                              setSelectedVector(item.name);
                              clearFile();
                              // Auto-hide the picker panel after selecting a logo
                              setIsOpen(false);
                            }}
                            className={`group flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm"
                                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <IconComp className="h-5 w-5 transition-transform group-hover:scale-110" />
                            <span className="text-[10px] font-medium leading-tight truncate w-full">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ──────────────── TAB 2: LOGO FILE UPLOAD ──────────────── */}
        {mode === "upload" && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors p-6 text-center bg-muted/10 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-foreground">
                  {isBn ? "কাস্টম সার্ভিস লোগো বা ইমেজ আপলোড করুন" : "Upload Custom Service Logo"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  PNG, WebP, JPEG, AVIF {isBn ? "(সর্বোচ্চ ৫ MB)" : "(Max 5 MB)"}
                </p>
              </div>

              <div className="flex justify-center">
                <label className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity cursor-pointer">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{isBn ? "ফাইল বেছে নিন" : "Choose File"}</span>
                  <input
                    type="file"
                    name="logo_file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Active File Preview */}
            {(filePreview || (defaultValue && isImageUrl(defaultValue))) && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border bg-background overflow-hidden p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview || defaultValue || ""}
                      alt="Logo preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      {fileName || (isBn ? "বর্তমান আপলোডকৃত লোগো" : "Current Uploaded Logo")}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {isBn ? "সংরক্ষণ করতে প্রস্তুত" : "Ready to save"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {filePreview && (
                    <button
                      type="button"
                      onClick={clearFile}
                      className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>{isBn ? "মুছুন" : "Remove"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isBn ? "সম্পন্ন" : "Done"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────── TAB 3: CUSTOM IMAGE URL ──────────────── */}
        {mode === "url" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                {isBn ? "বাহ্যিক লোগো বা SVG লিঙ্ক" : "External Logo or SVG URL"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/logo.svg or /logos/service.png"
                  className="flex-1 rounded-xl border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isBn ? "সেট ও বন্ধ করুন" : "Set & Close"}</span>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {isBn
                  ? "যেকোনো পাবলিক হোস্টেড ইমেজ বা এসভিজি লিঙ্ক প্রদান করুন।"
                  : "Provide any publicly accessible SVG, PNG, or CDN-hosted asset link."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
