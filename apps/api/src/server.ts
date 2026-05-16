import { createApp } from './app';
import { env } from './config/env';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`AI Teacher API listening on http://localhost:${env.PORT}`);
});
