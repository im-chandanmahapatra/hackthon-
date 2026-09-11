import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo, getJobStatus } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { Spinner } from '../components/ui/Spinner';

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const ACCEPTED_TYPES = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE_MB = 500;

export default function Upload() {
  const navigate = useNavigate();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultIncidentIds, setResultIncidentIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll job status once we have a jobId
  const fetcher = useCallback(
    () => (jobId ? getJobStatus(jobId) : Promise.reject('no job')),
    [jobId],
  );
  const { data: statusData } = usePolling(fetcher, 2000, uploadState === 'processing' && !!jobId);

  // React to status polling results
  if (uploadState === 'processing' && statusData) {
    if (statusData.status === 'done') {
      setUploadState('done');
      setResultIncidentIds(statusData.incident_ids);
    } else if (statusData.status === 'failed') {
      setUploadState('error');
      setErrorMessage(statusData.error_message ?? 'Processing failed. Please try again.');
    }
  }

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Invalid file type "${file.type}". Please upload an MP4, AVI, MOV, or MKV file.`;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  }

  function handleFileSelect(file: File) {
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      setSelectedFile(null);
      return;
    }
    setValidationError(null);
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadState('uploading');
    setErrorMessage(null);
    try {
      const { job_id } = await uploadVideo(selectedFile);
      setJobId(job_id);
      setUploadState('processing');
    } catch (err) {
      setUploadState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function reset() {
    setUploadState('idle');
    setSelectedFile(null);
    setValidationError(null);
    setJobId(null);
    setErrorMessage(null);
    setResultIncidentIds([]);
  }

  const isProcessingState = uploadState === 'uploading' || uploadState === 'processing';

  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header__title">
          <h1>Upload Video</h1>
          <span className="page-header__subtitle">
            Submit a pre-recorded clip for PPE &amp; fire/smoke analysis
          </span>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
        {(['Select', 'Upload', 'Analyse', 'Done'] as const).map((step, i) => {
          const stepIdx = ['idle', 'uploading', 'processing', 'done'].indexOf(uploadState);
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <div
              key={step}
              style={{
                flex: 1, textAlign: 'center', fontSize: '0.75rem', fontWeight: 600,
                padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                background: active ? 'rgba(245,158,11,0.12)' : done ? 'rgba(16,185,129,0.08)' : 'var(--bg-elevated)',
                color: active ? 'var(--accent-amber)' : done ? 'var(--color-safe)' : 'var(--text-muted)',
                border: `1px solid ${active ? 'rgba(245,158,11,0.25)' : done ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
                transition: 'all var(--transition-base)',
              }}
            >
              {done ? '✓ ' : ''}{step}
            </div>
          );
        })}
      </div>

      {/* ── Drop Zone ── */}
      {uploadState === 'idle' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Video upload area"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-amber)' : selectedFile ? 'var(--color-safe)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-12) var(--space-8)',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver
              ? 'rgba(245,158,11,0.04)'
              : selectedFile
              ? 'rgba(16,185,129,0.04)'
              : 'var(--bg-elevated)',
            transition: 'all var(--transition-base)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 'var(--space-4)',
          }}
        >
          <span style={{ fontSize: '3rem' }}>{selectedFile ? '🎬' : '📁'}</span>
          {selectedFile ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-safe)' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB · Click to change
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                Drag &amp; drop a video file, or click to browse
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Supported: MP4, AVI, MOV, MKV · Max {MAX_FILE_SIZE_MB} MB
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/avi,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.avi,.mov,.mkv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            id="video-file-input"
          />
        </div>
      )}

      {/* ── Validation Error ── */}
      {validationError && (
        <div
          role="alert"
          style={{
            marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}
        >
          ⚠️ {validationError}
        </div>
      )}

      {/* ── Upload Button ── */}
      {uploadState === 'idle' && selectedFile && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn--primary btn--lg" onClick={handleUpload} id="start-analysis-btn">
            🚀 Start Analysis
          </button>
        </div>
      )}

      {/* ── Processing State ── */}
      {isProcessingState && (
        <div
          className="card"
          style={{
            textAlign: 'center', padding: 'var(--space-12)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)',
          }}
        >
          <Spinner size="lg" />
          <div>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>
              {uploadState === 'uploading' ? 'Uploading video…' : 'Analysing frames…'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 340 }}>
              {uploadState === 'uploading'
                ? 'Transferring file to server'
                : 'Running PPE & fire/smoke detection on sampled frames. This may take a moment.'}
            </p>
          </div>
          <div
            style={{
              fontSize: '0.8125rem', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}
          >
            <span className="pulse-dot pulse-dot--amber" />
            Polling for results every 2s…
          </div>
        </div>
      )}

      {/* ── Done State ── */}
      {uploadState === 'done' && (
        <div
          className="card fade-in"
          style={{
            textAlign: 'center', padding: 'var(--space-10)',
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)',
          }}
        >
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            ✅
          </div>
          <div>
            <h3 style={{ color: 'var(--color-safe)', marginBottom: 'var(--space-2)' }}>
              Analysis Complete
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {resultIncidentIds.length > 0
                ? `${resultIncidentIds.length} incident${resultIncidentIds.length > 1 ? 's' : ''} detected`
                : 'No incidents detected in this clip'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              className="btn btn--primary"
              onClick={() => navigate('/')}
              id="view-results-btn"
            >
              View Dashboard →
            </button>
            <button className="btn btn--ghost" onClick={reset}>
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error State ── */}
      {uploadState === 'error' && (
        <div
          className="card fade-in"
          style={{
            textAlign: 'center', padding: 'var(--space-10)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)',
          }}
        >
          <span style={{ fontSize: '2.5rem' }}>❌</span>
          <div>
            <h3 style={{ color: 'var(--color-critical)', marginBottom: 'var(--space-2)' }}>
              Processing Failed
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 380 }}>
              {errorMessage}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={reset}>↩ Try Again</button>
        </div>
      )}

      {/* ── Info Card ── */}
      {uploadState === 'idle' && (
        <div className="card" style={{ marginTop: 'var(--space-8)', background: 'var(--bg-overlay)' }}>
          <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
            What happens next?
          </h4>
          <ol
            style={{
              paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column',
              gap: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--text-muted)',
            }}
          >
            <li>Frames are sampled at 2 FPS from your video</li>
            <li>Each frame is analysed for PPE violations &amp; fire/smoke</li>
            <li>A 2-of-3 frame debounce rule filters false positives</li>
            <li>Confirmed detections appear on the Dashboard as incidents</li>
          </ol>
        </div>
      )}
    </div>
  );
}
