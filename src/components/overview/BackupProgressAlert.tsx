import React from 'react';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { ProgressBar } from '../ui/ProgressBar';
import { CheckCircle } from 'lucide-react';
import { useBackupStore } from '../../store/backupStore';

export const BackupProgressAlert: React.FC = () => {
    const backupState = useBackupStore();

    if (!backupState.loading && !backupState.success) {
        return null;
    }

    return (
        <Alert 
            variant={backupState.success ? 'success' : 'default'} 
            className="transition-colors duration-500"
            icon={false}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    {backupState.success ? (
                        <CheckCircle className="text-success shrink-0" size={16} />
                    ) : (
                        <Spinner className="text-primary shrink-0" size={16} />
                    )}
                    <span className="font-medium truncate text-sm">
                        {backupState.statusText || 'Transfert en cours...'}
                        {backupState.currentFile ? ` ${backupState.currentFile}` : ''}
                    </span>
                </div>
                {backupState.progress && backupState.progress.total > 0 && (
                    <ProgressBar
                        value={(backupState.progress.written / backupState.progress.total) * 100}
                        variant={backupState.success ? 'success' : 'default'}
                        size="sm"
                        showLabel
                        sublabel={`${(backupState.speed / 1024 / 1024).toFixed(1)} MB/s`}
                    />
                )}
            </div>
        </Alert>
    );
};
