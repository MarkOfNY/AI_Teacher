import { prisma } from '../db/prisma';

export const devSessionService = {
  async ensureUserSession() {
    const user = await prisma.user.upsert({
      where: { googleSubject: 'dev-user' },
      update: {},
      create: {
        googleSubject: 'dev-user',
        email: 'user@example.test',
        displayName: 'Demo User'
      }
    });

    const userProfile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: user.displayName
      }
    });

    return {
      user: { id: userProfile.id, displayName: userProfile.displayName }
    };
  }
};
