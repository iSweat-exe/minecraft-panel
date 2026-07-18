import { createCallable } from 'react-call';

interface Props {
    title?: string;
    message: string;
}

export const ConfirmDialog = createCallable<Props, boolean>(({ call, title, message }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title || "Confirm"}</h3>
                    <p className="text-sm text-zinc-400">{message}</p>
                </div>
                <div className="p-4 bg-zinc-950/50 flex justify-end gap-3 border-t border-zinc-800">
                    <button
                        onClick={() => call.end(false)}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => call.end(true)}
                        className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
});
