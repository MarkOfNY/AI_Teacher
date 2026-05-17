import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import {
  fetchCourses,
  fetchAssignments,
  importFromClassroom,
  type GoogleCourse,
  type GoogleAssignment
} from '../api/classroomClient';

interface ClassroomImporterProps {
  onImport: (input: { title: string; text: string }) => void;
}

type ImporterStep =
  | { name: 'idle' }
  | { name: 'loading'; message: string }
  | { name: 'courses'; token: string; courses: GoogleCourse[] }
  | { name: 'assignments'; token: string; courseId: string; courseName: string; courses: GoogleCourse[]; assignments: GoogleAssignment[] }
  | { name: 'error'; message: string; back: ImporterStep };

export function ClassroomImporter({ onImport }: ClassroomImporterProps) {
  const [step, setStep] = useState<ImporterStep>({ name: 'idle' });

  const login = useGoogleLogin({
    scope: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ].join(' '),
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setStep({ name: 'loading', message: 'Loading your Google Classroom courses...' });
      try {
        const courses = await fetchCourses(token);
        if (courses.length === 0) {
          setStep({
            name: 'error',
            message: 'No active Classroom courses found for your Google account.',
            back: { name: 'idle' }
          });
          return;
        }
        setStep({ name: 'courses', token, courses });
      } catch (err) {
        setStep({
          name: 'error',
          message: err instanceof Error ? err.message : 'Failed to load courses.',
          back: { name: 'idle' }
        });
      }
    },
    onError: () => {
      setStep({
        name: 'error',
        message: 'Google sign-in was cancelled or failed.',
        back: { name: 'idle' }
      });
    }
  });

  async function handleSelectCourse(course: GoogleCourse) {
    if (step.name !== 'courses') return;
    const { token, courses } = step;
    setStep({ name: 'loading', message: `Loading assignments for ${course.name}...` });
    try {
      const assignments = await fetchAssignments(token, course.id);
      if (assignments.length === 0) {
        setStep({
          name: 'error',
          message: 'No published assignments found in this course.',
          back: { name: 'courses', token, courses }
        });
        return;
      }
      setStep({ name: 'assignments', token, courseId: course.id, courseName: course.name, courses, assignments });
    } catch (err) {
      setStep({
        name: 'error',
        message: err instanceof Error ? err.message : 'Failed to load assignments.',
        back: { name: 'courses', token, courses }
      });
    }
  }

  async function handleSelectAssignment(assignment: GoogleAssignment) {
    if (step.name !== 'assignments') return;
    const { token, courseId, courses, courseName } = step;
    const prevStep: ImporterStep = { name: 'assignments', token, courseId, courseName, courses, assignments: step.assignments };
    setStep({ name: 'loading', message: `Importing "${assignment.title}"...` });
    try {
      const result = await importFromClassroom(token, courseId, assignment.id);
      onImport({ title: result.title, text: result.text });
      setStep({ name: 'idle' });
    } catch (err) {
      setStep({
        name: 'error',
        message: err instanceof Error ? err.message : 'Import failed.',
        back: prevStep
      });
    }
  }

  if (step.name === 'idle') {
    return (
      <button
        type="button"
        className="classroom-import-btn"
        onClick={() => login()}
      >
        <BookOpen size={15} aria-hidden="true" />
        Import from Google Classroom
      </button>
    );
  }

  if (step.name === 'loading') {
    return (
      <div className="classroom-panel">
        <div className="classroom-loading">
          <span className="loading-dot" aria-hidden="true" />
          <span>{step.message}</span>
        </div>
      </div>
    );
  }

  if (step.name === 'error') {
    return (
      <div className="classroom-panel">
        <p className="upload-error" role="alert" style={{ margin: 0 }}>{step.message}</p>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => setStep(step.back)}
        >
          Back
        </button>
      </div>
    );
  }

  if (step.name === 'courses') {
    return (
      <div className="classroom-panel">
        <div className="classroom-panel-header">
          <span className="classroom-panel-title">Select a course</span>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => setStep({ name: 'idle' })}
          >
            Cancel
          </button>
        </div>
        <ul className="classroom-list" role="list">
          {step.courses.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className="classroom-list-item"
                onClick={() => void handleSelectCourse(course)}
              >
                <span>{course.name}{course.section ? ` · ${course.section}` : ''}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // assignments step
  return (
    <div className="classroom-panel">
      <div className="classroom-panel-header">
        <button
          type="button"
          className="classroom-back-btn"
          onClick={() => setStep({ name: 'courses', token: step.token, courses: step.courses })}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          {step.courseName}
        </button>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => setStep({ name: 'idle' })}
        >
          Cancel
        </button>
      </div>
      <p className="classroom-panel-hint">Select an assignment to import its text as a lesson.</p>
      <ul className="classroom-list" role="list">
        {step.assignments.map((assignment) => (
          <li key={assignment.id}>
            <button
              type="button"
              className="classroom-list-item"
              onClick={() => void handleSelectAssignment(assignment)}
            >
              <span className="classroom-item-title">{assignment.title}</span>
              <span className="classroom-badge">
                {assignment.hasDriveAttachment ? 'Doc' : 'Description'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
