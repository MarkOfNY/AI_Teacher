import { prisma } from '../db/prisma';

export const devSessionService = {
  async ensureParentSession() {
    const parent = await prisma.user.upsert({
      where: { googleSubject: 'dev-parent' },
      update: {},
      create: {
        googleSubject: 'dev-parent',
        email: 'parent@example.test',
        displayName: 'Demo Parent',
        role: 'parent'
      }
    });

    const studentUser = await prisma.user.upsert({
      where: { googleSubject: 'dev-student' },
      update: {},
      create: {
        googleSubject: 'dev-student',
        email: 'student@example.test',
        displayName: 'Demo Student',
        role: 'student'
      }
    });

    const student = await prisma.studentProfile.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        userId: studentUser.id,
        displayName: 'Demo Student'
      }
    });

    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: student.id
        }
      },
      update: {},
      create: {
        parentId: parent.id,
        studentId: student.id
      }
    });

    return {
      parent: { id: parent.id, displayName: parent.displayName },
      student: { id: student.id, displayName: student.displayName }
    };
  }
};
