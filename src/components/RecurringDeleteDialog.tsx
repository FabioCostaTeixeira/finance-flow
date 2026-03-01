import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Layers, Trash2 } from 'lucide-react';

interface RecurringDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteSingle: () => void;
  onDeleteAll: () => void;
}

export function RecurringDeleteDialog({
  open,
  onOpenChange,
  onDeleteSingle,
  onDeleteAll,
}: RecurringDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Excluir Lancamento Recorrente
          </AlertDialogTitle>
          <AlertDialogDescription>
            Este lancamento faz parte de uma serie recorrente. Deseja excluir apenas este ou toda a serie?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDeleteSingle}
            className="bg-destructive hover:bg-destructive/90"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Apenas este
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onDeleteAll}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            <Layers className="w-4 h-4 mr-2" />
            Toda a serie
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
