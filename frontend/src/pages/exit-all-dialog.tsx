import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExitAllDialogProps {
  open: boolean;
  openCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ExitAllDialog({ open, openCount, onOpenChange, onConfirm }: ExitAllDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit {openCount} open position{openCount !== 1 ? "s" : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            Market exit orders will be placed for all {openCount} open position{openCount !== 1 ? "s" : ""}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { onOpenChange(false); onConfirm(); }}
          >
            Exit All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
