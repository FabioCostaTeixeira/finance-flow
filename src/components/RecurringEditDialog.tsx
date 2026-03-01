import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Edit, Layers } from 'lucide-react';

interface RecurringEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditSingle: () => void;
  onEditAll: () => void;
}

export function RecurringEditDialog({
  open,
  onOpenChange,
  onEditSingle,
  onEditAll,
}: RecurringEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-primary" />
            Editar Lançamento Recorrente
          </AlertDialogTitle>
          <AlertDialogDescription>
            Este lançamento faz parte de uma série recorrente. Como deseja prosseguir?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onEditSingle}
            className="bg-primary hover:bg-primary/90"
          >
            <Edit className="w-4 h-4 mr-2" />
            Apenas este
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onEditAll}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            <Layers className="w-4 h-4 mr-2" />
            Todos em aberto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
