import { createCallable } from 'react-call';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface Props {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
}

export const ConfirmDialog = createCallable<Props, boolean>(({ call, title, message, confirmText, cancelText, variant }) => {
    return (
        <Modal 
            isOpen={true} 
            onClose={() => call.end(false)} 
            title={title || "Confirm"}
            maxWidth="max-w-sm"
            footer={
                <>
                    <Button variant="ghost" onClick={() => call.end(false)}>
                        {cancelText || "Cancel"}
                    </Button>
                    <Button variant={variant || "danger"} onClick={() => call.end(true)}>
                        {confirmText || "Delete"}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-muted-foreground">{message}</p>
        </Modal>
    );
});
