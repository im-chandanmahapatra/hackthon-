import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { UploadCloud, AlertCircle, ArrowRight } from 'lucide-react';
import { uploadVideo, getJobStatus } from '../api/client';
import type { JobStatusResponse } from '../api/types';
import { Card } from '../components/ui/Card';
import { OrbitalSpinner } from '../components/ui/OrbitalSpinner';
import { AnimatedCheckmark } from '../components/ui/AnimatedCheckmark';

type Step = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const STAGE_LABELS: Record<string, { title: string; description: string }> = {
  uploading: {
    title: 'Uploading Footage…',
    description: 'Transferring file to secure spatial telemetry cluster.',
  },
  processing: {
    title: 'Executing Inference…',
    description: 'Running YOLOv8n spatial intelligence and temporal violation indexing.',
  },
};

export default function Upload() {
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [_jobId, setJobId] = useState<string | null>(null);
  const [resultIncidents, setResultIncidents] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res: JobStatusResponse = await getJobStatus(id);
      if (res.status === 'done') {
        setResultIncidents(res.incident_ids || []);
        setStep('done');
      } else if (res.status === 'failed') {
        setStep('error');
        setErrorMsg('Processing failed on the server.');
      } else {
        setTimeout(() => pollStatus(id), 2000);
      }
    } catch (err) {
      setStep('error');
      setErrorMsg('Failed to check job status.');
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setStep('error');
      setErrorMsg('Please select a valid video file (MP4, WebM, AVI).');
      return;
    }

    setFileName(file.name);
    setStep('uploading');
    setErrorMsg('');
    
    try {
      await new Promise(r => setTimeout(r, 800));
      const res = await uploadVideo(file);
      setJobId(res.job_id);
      setStep('processing');
      pollStatus(res.job_id);
    } catch (err) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const stage = STAGE_LABELS[step] || STAGE_LABELS.processing;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[580px] mx-auto mt-6">
      
      <div className="text-center mb-1">
        <h1 className="font-display text-[28px] sm:text-[30px] font-bold tracking-[-0.03em] text-primary">
          Upload Footage
        </h1>
        <p className="font-body text-[14px] text-secondary mt-1.5 leading-relaxed max-w-md mx-auto">
          Upload video files for high-precision PPE detection and fire/smoke hazard analysis.
        </p>
      </div>

      <Card className="overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* ── Idle: Drop Zone ── */}
          {step === 'idle' && (
            <motion.div 
              key="idle" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0, scale: 0.98 }} 
              className="p-8"
            >
              <div 
                className={`
                  relative border-2 border-dashed rounded-[var(--radius-md)] p-12 sm:p-14 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer
                  ${dragActive 
                    ? 'border-brand-accent bg-brand-accent-subtle scale-[1.01]' 
                    : 'border-default bg-surface/40 hover:border-hover hover:bg-surface-hover/60'
                  }
                `}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />

                <motion.div 
                  className="w-14 h-14 rounded-full bg-surface border border-default flex items-center justify-center text-muted mb-4 shadow-xs"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <UploadCloud size={22} className="text-brand-accent" />
                </motion.div>

                <h3 className="font-display text-[16px] font-semibold text-primary mb-1 tracking-[-0.015em]">
                  Drop your footage here
                </h3>
                <p className="font-body text-[13px] text-muted leading-relaxed">
                  Supports MP4, WebM, or AVI · Max 500MB
                </p>
                <span className="mt-4 px-3 py-1 rounded-full bg-surface border border-border-subtle font-mono text-[11px] text-muted font-medium">
                  SELECT FROM COMPUTER
                </span>
              </div>
            </motion.div>
          )}

          {/* ── Processing ── */}
          {(step === 'uploading' || step === 'processing') && (
            <motion.div 
              key="processing" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }} 
              className="p-14 flex flex-col items-center text-center"
            >
              <OrbitalSpinner size={56} className="mb-8" />
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                >
                  <h3 className="font-display text-[17px] font-bold tracking-[-0.02em] text-primary mb-2">
                    {stage.title}
                  </h3>
                  <p className="font-body text-[13px] text-secondary mb-2 max-w-[320px] leading-relaxed">
                    {stage.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {fileName && (
                <div className="mt-4 px-3 py-1.5 rounded-full bg-surface border border-border-subtle font-mono text-[11px] font-medium text-muted">
                  {fileName}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <motion.div 
              key="done" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="p-14 flex flex-col items-center text-center"
            >
              <AnimatedCheckmark size={64} className="text-status-success mb-6" />
              
              <h3 className="font-display text-[20px] font-bold tracking-[-0.025em] text-primary mb-2">
                Analysis Complete
              </h3>
              <p className="font-body text-[14px] text-secondary mb-8 leading-relaxed">
                Processed successfully. Detected <strong className="text-brand-accent font-semibold font-display">{resultIncidents.length}</strong> incidents.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setStep('idle'); setJobId(null); setResultIncidents([]); setFileName(''); }}
                  className="px-4 py-2.5 bg-surface border border-default text-primary rounded-[var(--radius-sm)] font-body text-[13px] font-medium hover:bg-surface-hover hover:border-hover transition-all shadow-xs active:scale-[0.97]"
                >
                  Upload Another
                </button>
                <Link 
                  to="/"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary text-inverse rounded-[var(--radius-sm)] font-body text-[13px] font-medium transition-all active:scale-[0.97] shadow-xs hover:opacity-90"
                >
                  View Dashboard <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <motion.div 
              key="error" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-14 flex flex-col items-center text-center"
            >
              <motion.div 
                className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/15 flex items-center justify-center text-status-danger mb-5"
                animate={{ x: [0, -4, 4, -2, 2, 0] }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <AlertCircle size={22} />
              </motion.div>
              <h3 className="font-display text-[16px] font-bold tracking-[-0.02em] text-primary mb-2">
                Analysis Failed
              </h3>
              <p className="font-body text-[13px] text-muted mb-8 max-w-[300px] leading-relaxed">{errorMsg}</p>
              
              <button 
                onClick={() => setStep('idle')}
                className="px-4 py-2.5 bg-surface border border-default text-primary rounded-[var(--radius-sm)] font-body text-[13px] font-medium hover:bg-surface-hover hover:border-hover transition-all shadow-xs active:scale-[0.97]"
              >
                Try Again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </Card>
    </div>
  );
}
