import React, { useEffect, useRef, useState } from 'react';
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
    showFiltered: boolean;
    onToggleSourceCode: () => void;
    onToggleFiltered: () => void;
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
    showFiltered,
    onToggleSourceCode,
    onToggleFiltered,
    sourceCodeAvailable,
    profileType,
}: LegendProps) {
    const legendRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<HTMLDivElement>(null);
    const [legendStyle, setLegendStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        const updateLegendPosition = () => {
            if (!legendRef.current || !controlsRef.current) return;

            // Temporarily remove constraints to measure natural width
            const originalStyle = legendRef.current.style.cssText;
            legendRef.current.style.cssText =
                'position: fixed; left: -9999px; right: auto; max-width: none; transform: none;';

            const legendNaturalWidth = legendRef.current.scrollWidth;
            const controlsWidth = controlsRef.current.offsetWidth;
            const windowWidth = window.innerWidth;
            const padding = 16; // 1rem = 16px for spacing

            // Restore original style
            legendRef.current.style.cssText = originalStyle;

            // Calculate available space for legend
            const availableWidth = windowWidth - controlsWidth - padding * 3; // left + gap + right padding

            // Check if legend can be centered
            const centeredLeftPosition = (windowWidth - legendNaturalWidth) / 2;
            const centeredRightPosition = centeredLeftPosition + legendNaturalWidth;
            const controlsLeftPosition = windowWidth - controlsWidth - padding;

            // If centered legend would overlap with controls, use right-aligned mode
            if (centeredRightPosition + padding > controlsLeftPosition) {
                setLegendStyle({
                    left: 'auto',
                    right: `${controlsWidth + padding * 2}px`,
                    transform: 'none',
                    maxWidth: `${availableWidth}px`,
                });
            } else {
                // Center the legend
                setLegendStyle({
                    left: '50%',
                    right: 'auto',
                    transform: 'translateX(-50%)',
                    maxWidth: `${availableWidth}px`,
                });
            }
        };

        // Update position on mount and when dependencies change
        updateLegendPosition();

        // Update position on window resize
        window.addEventListener('resize', updateLegendPosition);

        return () => {
            window.removeEventListener('resize', updateLegendPosition);
        };
    }, [showFiltered, sourceCodeAvailable, items.length]);

    if (items.length === 0) return null;

    return (
        <>
            {/* Legend items container - dynamic positioning */}
            <div ref={legendRef} className="fixed bottom-4 z-50" style={legendStyle}>
                <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
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
                </div>
            </div>

            {/* Controls container - positioned on the right */}
            <div ref={controlsRef} className="fixed bottom-4 right-4 z-50">
                <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        {/* Filter input - appears when showFiltered is true */}
                        {showFiltered && (
                            <>
                                <input
                                    type="text"
                                    placeholder="Filter"
                                    className="bg-transparent text-white text-xs placeholder-white/60 focus:outline-none w-24"
                                />
                                <div className="h-4 w-px bg-white/30"></div>
                            </>
                        )}

                        {/* Filter toggle button */}
                        <button
                            className={`text-xs px-0.5 py-0 rounded focus:outline-none transition-colors cursor-pointer w-6 ${
                                showFiltered ? 'bg-white/20 text-white' : 'text-white/60'
                            }`}
                            title="Toggle filtered view"
                            onClick={onToggleFiltered}
                        >
                            𝓕
                        </button>

                        {/* Code toggle button */}
                        {sourceCodeAvailable && (
                            <button
                                className={`text-xs px-0.5 py-0 rounded focus:outline-none transition-colors cursor-pointer w-6 ${
                                    showSourceCode ? 'bg-white/20 text-white' : 'text-white/60'
                                }`}
                                onClick={onToggleSourceCode}
                                title="Toggle code view"
                            >
                                &lt;/&gt;
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
