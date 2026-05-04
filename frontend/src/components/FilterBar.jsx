'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';

export default function FilterBar({
  searchValue,
  onSearchChange,
  filters,
  onFilterChange,
  placeholder = 'Buscar...',
  clearable = true,
}) {
  const [focused, setFocused] = useState(false);

  const handleClear = () => {
    onSearchChange('');
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={20} />
        </div>

        <input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full pl-12 pr-10 py-3 rounded-xl border-2 transition-all duration-200 font-medium
            ${
              focused
                ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }
            text-gray-900 placeholder:text-gray-400 outline-none`}
        />

        {clearable && searchValue && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Filters */}
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`px-4 py-2 rounded-full font-semibold transition-all duration-200 text-sm
                ${
                  filter.active
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
