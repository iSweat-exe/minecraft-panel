import React, { useState, useRef, useEffect } from 'react';
import { createCallable } from 'react-call';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
    title: string;
    defaultValue?: string;
}

export const PromptDialog = createCallable<Props, string | null>(({ call, title, defaultValue }) => {
    const [value, setValue] = useState(defaultValue || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        call.end(value);
    };

    return (
        <Modal
            isOpen={true}
            onClose={() => call.end(null)}
            title={title}
            maxWidth="max-w-sm"
            footer={
                <>
                    <Button variant="ghost" onClick={() => call.end(null)}>
                        Cancel
                    </Button>
                    <Button type="submit" form="prompt-form" variant="primary">
                        Confirm
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} id="prompt-form">
                <Input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full"
                />
            </form>
        </Modal>
    );
});
