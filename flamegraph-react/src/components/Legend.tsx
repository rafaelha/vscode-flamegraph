import { type LegendItem } from './types';
import './Legend.css';

interface LegendProps {
    items: LegendItem[];
}

export function Legend({ items }: LegendProps) {
    if (items.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]">
            <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
                <div className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {items.map(({ name, color }) => (
                        <div key={name} className="flex items-center gap-1.5">
                            <div 
                                className="w-3 h-3 rounded-sm" 
                                style={{ 
                                    backgroundColor: `hsl(${color.match(/\d+/)![0]}, var(--legend-saturation), var(--legend-lightness))` 
                                }} 
                            />
                            <span className="text-xs text-white/80 whitespace-nowrap">{name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
