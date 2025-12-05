import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Command } from 'lucide-react';

export interface MessageShortcut {
  id: string;
  trigger: string;
  content: string;
  created_at: string;
  created_by: string | null;
}

interface MessageShortcutsProps {
  isOpen: boolean;
  searchText: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function MessageShortcuts({ isOpen, searchText, onSelect, onClose }: MessageShortcutsProps) {
  const [shortcuts, setShortcuts] = useState<MessageShortcut[]>([]);
  const [filteredShortcuts, setFilteredShortcuts] = useState<MessageShortcut[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShortcuts();
  }, []);

  useEffect(() => {
    if (searchText) {
      const search = searchText.toLowerCase().replace('/', '');
      const filtered = shortcuts.filter(
        s => s.trigger.toLowerCase().includes(search) || 
             s.content.toLowerCase().includes(search)
      );
      setFilteredShortcuts(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredShortcuts(shortcuts);
      setSelectedIndex(0);
    }
  }, [searchText, shortcuts]);

  const fetchShortcuts = async () => {
    const { data } = await supabase
      .from('message_shortcuts')
      .select('*')
      .order('trigger', { ascending: true });
    
    if (data) {
      setShortcuts(data as MessageShortcut[]);
      setFilteredShortcuts(data as MessageShortcut[]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredShortcuts.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredShortcuts[selectedIndex]) {
          onSelect(filteredShortcuts[selectedIndex].content);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredShortcuts, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && isOpen) {
      const selectedElement = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen || filteredShortcuts.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-scale-in"
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Command className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Atalhos de Mensagem</span>
        <span className="text-xs text-muted-foreground ml-auto">↑↓ navegar • Enter selecionar • Esc fechar</span>
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        {filteredShortcuts.map((shortcut, index) => (
          <button
            key={shortcut.id}
            data-index={index}
            onClick={() => onSelect(shortcut.content)}
            className={cn(
              'w-full text-left px-4 py-3 transition-colors border-b border-border/50 last:border-0',
              index === selectedIndex 
                ? 'bg-primary/20' 
                : 'hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-primary font-mono text-sm">/{shortcut.trigger}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {shortcut.content}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}