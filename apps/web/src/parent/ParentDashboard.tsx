interface MaterialSummary {
  id: string;
  title: string;
  status: string;
  finalBestScore: number | null;
}

interface ParentDashboardProps {
  materials: MaterialSummary[];
  onSelectMaterial?: (materialId: string) => void;
  onEditMaterial?: (materialId: string) => void;
  onDeleteMaterial?: (materialId: string) => void;
}

function statusLabel(status: string) {
  if (status === 'complete') return 'Complete';
  if (status === 'inProgress') return 'In Progress';
  return 'Not Started';
}

export function ParentDashboard({ materials, onSelectMaterial, onEditMaterial, onDeleteMaterial }: ParentDashboardProps) {
  return (
    <section aria-label="Parent dashboard" className="materials-section">
      <div className="section-heading">
        <h2>Student Materials</h2>
        <p>Track lesson status and final summary mastery.</p>
      </div>
      {materials.length > 0 ? (
        <ul className="material-list">
          {materials.map((material) => (
            <li key={material.id} className="material-row">
              <button
                type="button"
                className="material-open-button"
                aria-label={`Open ${material.title}`}
                onClick={() => onSelectMaterial?.(material.id)}
              >
                {material.title}
              </button>
              <span>{statusLabel(material.status)}</span>
              <span>{material.finalBestScore === null ? 'No final score' : `${material.finalBestScore}%`}</span>
              <div className="material-actions">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  aria-label={`Edit ${material.title}`}
                  onClick={() => onEditMaterial?.(material.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondary-button compact-button danger-button"
                  aria-label={`Delete ${material.title}`}
                  onClick={() => onDeleteMaterial?.(material.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <strong>No materials yet</strong>
          <p>Create a lesson from pasted text to see it here.</p>
        </div>
      )}
    </section>
  );
}
