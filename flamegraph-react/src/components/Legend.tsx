import React from 'react';
import { type LegendItem } from './types';
import './Flamegraph.css';
import { toUnitString } from '../utilities/units';

interface LegendProps {
    items: LegendItem[];
    onModuleVisibilityChange: (moduleName: string, isVisible: boolean) => void;
    hiddenModules: Set<string>;
    moduleSamples: Map<string, number>;
    moduleOwnSamples: Map<string, number>;
    totalSamples: number;
    showSourceCode: boolean;
    onToggleSourceCode: () => void;
    sourceCodeAvailable: boolean;
    profileType: 'py-spy' | 'memray';
}

export function Legend({
    items,
    onModuleVisibilityChange,
    hiddenModules,
    moduleSamples,
    moduleOwnSamples,
    totalSamples,
    showSourceCode,
    onToggleSourceCode,
    sourceCodeAvailable,
    profileType,
}: LegendProps) {
    if (items.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]">
            <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {items.map(({ name, hue }) => {
                            const isHidden = hiddenModules.has(name);
                            const samples = moduleSamples.get(name) || 0;
                            const ownSamples = moduleOwnSamples.get(name) || 0;
                            let title = '';
                            const percentageString = ((samples / totalSamples) * 100).toFixed(1) + '%';
                            const ownPercentageString = ((ownSamples / totalSamples) * 100).toFixed(1) + '%';
                            if (profileType === 'memray') {
                                title = `Memory: ${toUnitString(samples, profileType)} (${percentageString}) / Own memory: ${toUnitString(ownSamples, profileType)}${ownSamples > 0 ? ` (${ownPercentageString})` : ''}`;
                            } else {
                                title = `Time: ${toUnitString(samples, profileType)} (${percentageString}) / Own time: ${toUnitString(ownSamples, profileType)}${ownSamples > 0 ? ` (${ownPercentageString})` : ''}`;
                            }

                            return (
                                <div
                                    key={name}
                                    className="flex items-center gap-1.5"
                                    {...(samples > 0 && totalSamples > 0
                                        ? {
                                              title,
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
                    {sourceCodeAvailable && (
                        <>
                            <div className="h-4 w-px bg-white/30 -mx-1"></div>
                            <button
                                className={`text-xs px-0.5 py-0 rounded focus:outline-none transition-colors cursor-pointer ${
                                    showSourceCode ? 'bg-white/20 text-white' : 'text-white/60'
                                }`}
                                onClick={onToggleSourceCode}
                                title="Toggle code view"
                            >
                                &lt;/&gt;
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
