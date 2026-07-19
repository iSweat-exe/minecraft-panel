import { createCallable } from 'react-call';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface Props {
    title?: string;
    message: string;
}

export const ConfirmDialog = createCallable<Props, boolean>(({ call, title, message }) => {
    return (
        <Modal 
            isOpen={true} 
            onClose={() => call.end(false)} 
            title={title || "Confirm"}
            maxWidth="max-w-sm"
            footer={
                <>
                    <Button variant="ghost" onClick={() => call.end(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => call.end(true)}>
                        Delete
                    </Button>
                </>
            }
        >
            <p className="text-sm text-muted-foreground">{message}</p>
        </Modal>
    );
});
