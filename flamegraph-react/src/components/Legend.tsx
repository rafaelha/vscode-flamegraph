import React from 'react';
import { type LegendItem } from './types';
import './Flamegraph.css';

interface LegendProps {
    items: LegendItem[];
    onModuleVisibilityChange: (moduleName: string, isVisible: boolean) => void;
    hiddenModules: Set<string>;
    moduleSamples: Map<string, number>;
    moduleOwnSamples: Map<string, number>;
    totalSamples: number;
}

export function Legend({
    items,
    onModuleVisibilityChange,
    hiddenModules,
    moduleSamples,
    moduleOwnSamples,
    totalSamples,
}: LegendProps) {
    if (items.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]">
            <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
                <div className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {items.map(({ name, hue }) => {
                        const isHidden = hiddenModules.has(name);
                        const samples = moduleSamples.get(name) || 0;
                        const ownSamples = moduleOwnSamples.get(name) || 0;
                        return (
                            <div
                                key={name}
                                className="flex items-center gap-1.5"
                                {...(samples > 0 && totalSamples > 0
                                    ? {
                                          title: `Time: ${samples / 100}s (${((samples / totalSamples) * 100).toFixed(1)}%) / Own time: ${ownSamples / 100}s${ownSamples > 0 ? ` (${((ownSamples / totalSamples) * 100).toFixed(1)}%)` : ''}`,
                                      }
                                    : {})}
                            >
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={!isHidden}
                                        onChange={(e) => onModuleVisibilityChange(name, e.target.checked)}
                                    />
                                    <div
                                        className="w-3 h-3 rounded-sm border border-white/20"
                                        style={{
                                            backgroundColor: isHidden
                                                ? 'white'
                                                : `hsl(${hue}, var(--node-saturation), var(--node-lightness))`,
                                        }}
                                    />
                                </label>
                                <span className="text-xs text-white/80 whitespace-nowrap">{name}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
