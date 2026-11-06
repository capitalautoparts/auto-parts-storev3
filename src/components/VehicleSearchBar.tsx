import { useState, useEffect, useRef } from "react";
import { Search, Car, Package, X, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vehicleApi, type VehicleSearchResult, type VehicleContext } from "@/lib/api";

interface VehicleSearchBarProps {
  appliedQuery?: string;
  onVehicleSelect: (result: VehicleSearchResult) => void;
  onPartSelect?: (result: VehicleSearchResult) => void;
  onCategorySelect?: (result: VehicleSearchResult) => void;
  onTextSearch?: (query: string) => void;
  vehicleContext?: VehicleContext | null;
  className?: string;
}

export function VehicleSearchBar({
  appliedQuery = '',
  onVehicleSelect,
  onPartSelect,
  onCategorySelect,
  onTextSearch,
  vehicleContext,
  className,
}: VehicleSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VehicleSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);
  const submittedQuery = useRef<string | null>(null);
  const suggestionsAllowed = useRef(false);
  useEffect(() => { setQuery(appliedQuery); }, [appliedQuery, vehicleContext]);

  const dismissSuggestions = () => {
    // Let the current request settle, but require fresh intent before reopening.
    suggestionsAllowed.current = false;
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsLoading(false);
    setError('');
  };

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismissSuggestions();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = ++requestVersion.current;
    const searchTimeout = setTimeout(async () => {
      if (!active || requestId !== requestVersion.current) return;
      setError('');
      if (query.trim().length < 2 || submittedQuery.current === query.trim()) {
        setResults([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(suggestionsAllowed.current);
      try {
        let searchResults: VehicleSearchResult[];

        const isYearVehicleQuery = /^\s*\d{4}(?:\s|$)/.test(query);
        if (vehicleContext && !isYearVehicleQuery) {
          // If we have a vehicle selected, search for categories/part types
          searchResults = await vehicleApi.searchCategories(query, vehicleContext);
        } else {
          // Otherwise, search for vehicles
          searchResults = await vehicleApi.search(query);
        }

        if (!active || requestId !== requestVersion.current) return;
        setResults(searchResults);
        setIsOpen(suggestionsAllowed.current && searchResults.length > 0 && submittedQuery.current !== query.trim());
        setHighlightedIndex(-1);
      } catch (error) {
        if (active && requestId === requestVersion.current) {
          setError(suggestionsAllowed.current ? (error as Error).message : '');
          setResults([]);
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      } finally {
        if (active && requestId === requestVersion.current) setIsLoading(false);
      }
    }, 200);

    return () => { active = false; clearTimeout(searchTimeout); };
  }, [query, vehicleContext]);

  const handleSelect = (result: VehicleSearchResult) => {
    requestVersion.current++;
    dismissSuggestions();
    setResults([]);
    if (result.type === "vehicle") {
      onVehicleSelect(result);
    } else if (result.type === "part" && onPartSelect) {
      onPartSelect(result);
    } else if (result.type === "category" && onCategorySelect) {
      onCategorySelect(result);
    }
    submittedQuery.current = null;
    setQuery("");
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || !onTextSearch) return;
    submittedQuery.current = trimmed;
    requestVersion.current++;
    dismissSuggestions();
    setResults([]);
    onTextSearch(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent;
    if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;

    if (e.key === "Escape" || e.key === "Tab") {
      dismissSuggestions();
      return;
    }

    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      suggestionsAllowed.current = true;
      if (results.length > 0 && submittedQuery.current !== query.trim()) {
        setIsOpen(true);
        setHighlightedIndex(e.key === "ArrowDown" ? 0 : results.length - 1);
      }
      return;
    }

    if (!isOpen) {
      if (e.key === "Enter" && query.trim() && onTextSearch) {
        e.preventDefault();
        submitSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        } else if (query.trim() && onTextSearch) {
          submitSearch();
        }
        break;
    }
  };

  const clearSearch = () => {
    submittedQuery.current = null;
    requestVersion.current++;
    setQuery("");
    setResults([]);
    containerRef.current?.querySelector('input')?.focus();
    dismissSuggestions();
    onTextSearch?.('');
  };

  return (
    <div ref={containerRef} className={cn("relative text-brand-ink", className)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismissSuggestions(); }}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="catalog-search"
          aria-label="Search by vehicle or part number"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="catalog-search-results"
          aria-activedescendant={isOpen && results[highlightedIndex] ? `catalog-result-${highlightedIndex}` : undefined}
          maxLength={120}
          type="text"
          value={query}
          placeholder={
            vehicleContext
              ? `Search parts for ${vehicleContext.year} ${vehicleContext.makeName} ${vehicleContext.modelName}...`
              : "Search by vehicle (2010 Hyundai Elantra) or part number..."
          }
          className="pl-10 pr-20 bg-white text-brand-ink border-0 shadow-sm"
          onChange={(e) => {
            requestVersion.current++;
            submittedQuery.current = null;
            suggestionsAllowed.current = true;
            setResults([]);
            setHighlightedIndex(-1);
            setIsOpen(false);
            setIsLoading(false);
            setError('');
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            suggestionsAllowed.current = true;
            if (results.length > 0 && submittedQuery.current !== query.trim()) setIsOpen(true);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Search catalog"
          title="Search"
          disabled={!query.trim() || !onTextSearch}
          onClick={submitSearch}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </Button>
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div id="catalog-search-results" role="listbox" aria-label="Search suggestions" className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-[9999] max-h-80 overflow-auto">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                type="button"
                tabIndex={-1}
                role="option"
                id={`catalog-result-${index}`}
                aria-selected={highlightedIndex === index}
                key={`${result.type}-${result.label}`}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 transition-colors text-gray-900",
                  highlightedIndex === index && "bg-gray-100"
                )}
                onClick={() => handleSelect(result)}
                onPointerDown={(event) => { if (event.button === 0) event.preventDefault(); }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {result.type === "vehicle" ? (
                  <Car className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : result.type === "category" ? (
                  <Wrench className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <Package className="h-4 w-4 text-gray-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {result.label}
                  </div>
                  {result.type === "vehicle" && !result.engineId && (
                    <div className="text-xs text-gray-500">
                      {result.modelId ? "Select engine to see parts" : "Select model"}
                    </div>
                  )}
                  {result.type === "part" && (
                    <div className="text-xs text-gray-500">
                      Part number search
                    </div>
                  )}
                  {result.type === "category" && (
                    <div className="text-xs text-gray-500">
                      Part category
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No results found
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-border p-3 text-sm text-muted-foreground z-50">
          Searching...
        </div>
      )}
      {error && <p role="alert" className="absolute top-full bg-white text-red-700 border rounded p-2 text-xs z-50">{error}</p>}
    </div>
  );
}
