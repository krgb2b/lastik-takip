"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  className = "",
  inputClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOptions = useMemo(() => {
    return options.filter((option) => values.includes(option.value));
  }, [options, values]);

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return "";
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    if (selectedOptions.length === 2) {
      return `${selectedOptions[0].label}, ${selectedOptions[1].label}`;
    }
    return `${selectedOptions[0].label}, ${selectedOptions[1].label} +${
      selectedOptions.length - 2
    }`;
  }, [selectedOptions]);

  const filteredOptions = useMemo(() => {
    const sourceText = query.trim();
    if (!sourceText) return options;

    const q = normalizeText(sourceText);
    return options.filter((option) => normalizeText(option.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((x) => x !== value));
    } else {
      onChange([...values, value]);
    }
  }

  function handleFocus() {
    setOpen(true);
    setQuery("");
  }

  function handleChange(nextValue: string) {
    setQuery(nextValue);
    if (!open) setOpen(true);
  }

  const resolvedInputClassName = inputClassName
    ? `filter-control border-slate-200 bg-slate-50/80 pr-12 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:bg-white focus:ring-4 focus:ring-slate-200/60 ${inputClassName}`
    : "filter-control border-slate-200 bg-slate-50/80 pr-12 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:bg-white focus:ring-4 focus:ring-slate-200/60";

  return (
    <div
      ref={wrapperRef}
      className={`relative ${open ? "z-30" : "z-0"} ${className}`}
    >
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : displayText}
          placeholder={selectedOptions.length === 0 ? placeholder : ""}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          className={resolvedInputClassName}
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm leading-none text-slate-400"
          aria-hidden="true"
        >
          ⌄
        </span>
      </div>

      {open ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl ring-1 ring-slate-900/5 backdrop-blur">
          <div className="max-h-64 overflow-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="rounded-xl px-3 py-2 text-xs text-slate-500">
                Kayıt bulunamadı
              </div>
            ) : (
              filteredOptions.map((option) => {
                const checked = values.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${
                      checked
                        ? "bg-slate-100/80 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-300"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}